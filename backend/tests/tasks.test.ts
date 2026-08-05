import request from 'supertest';
import { buildTestApp, registerUser, createBoard, resetDb, AUTH_HEADER, TestContext } from './helpers';

interface ColumnRef {
  id: string;
  title: string;
  tasks: Array<{ id: string; title: string; description: string | null }>;
}

async function getColumns(ctx: TestContext, token: string, boardId: string): Promise<ColumnRef[]> {
  const res = await request(ctx.app).get(`/api/v1/boards/${boardId}`).set(AUTH_HEADER(token)).expect(200);
  return res.body.data.board.columns;
}

describe('Tasks API', () => {
  let ctx: TestContext;
  let token: string;
  let boardId: string;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    token = (await registerUser(ctx)).token;
    ({ boardId } = await createBoard(ctx, token));
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates a task in a column', async () => {
    const columns = await getColumns(ctx, token, boardId);
    const backlog = columns[0];

    const res = await request(ctx.app)
      .post(`/api/v1/boards/${boardId}/tasks`)
      .set(AUTH_HEADER(token))
      .send({ title: 'Write the README', columnId: backlog.id })
      .expect(201);

    expect(res.body.data.task.title).toBe('Write the README');
    expect(res.body.data.task.columnId).toBe(backlog.id);
  });

  it('orders new tasks at the end of a column', async () => {
    const columns = await getColumns(ctx, token, boardId);
    const backlog = columns[0];

    for (let i = 0; i < 3; i++) {
      await request(ctx.app)
        .post(`/api/v1/boards/${boardId}/tasks`)
        .set(AUTH_HEADER(token))
        .send({ title: `Task ${i}`, columnId: backlog.id })
        .expect(201);
    }

    const updated = await getColumns(ctx, token, boardId);
    expect(updated[0].tasks.map((t: { title: string }) => t.title)).toEqual(['Task 0', 'Task 1', 'Task 2']);
  });

  it('rejects a task with an empty title', async () => {
    const columns = await getColumns(ctx, token, boardId);
    const res = await request(ctx.app)
      .post(`/api/v1/boards/${boardId}/tasks`)
      .set(AUTH_HEADER(token))
      .send({ title: '   ', columnId: columns[0].id })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a task referencing a column from another board', async () => {
    const other = await registerUser(ctx);
    const otherBoard = await createBoard(ctx, other.token, 'Elsewhere');
    const otherColumns = await getColumns(ctx, other.token, otherBoard.boardId);

    const res = await request(ctx.app)
      .post(`/api/v1/boards/${boardId}/tasks`)
      .set(AUTH_HEADER(token))
      .send({ title: 'Sneaky', columnId: otherColumns[0].id })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('moves a task between columns and updates its order', async () => {
    const columns = await getColumns(ctx, token, boardId);
    const created = await request(ctx.app)
      .post(`/api/v1/boards/${boardId}/tasks`)
      .set(AUTH_HEADER(token))
      .send({ title: 'Move me', columnId: columns[0].id })
      .expect(201);

    const taskId = created.body.data.task.id;
    const res = await request(ctx.app)
      .patch(`/api/v1/boards/${boardId}/tasks/${taskId}`)
      .set(AUTH_HEADER(token))
      .send({ columnId: columns[2].id, order: 0 })
      .expect(200);

    expect(res.body.data.task.columnId).toBe(columns[2].id);
    expect(res.body.data.task.order).toBe(0);
  });

  it('updates the task title and description', async () => {
    const columns = await getColumns(ctx, token, boardId);
    const created = await request(ctx.app)
      .post(`/api/v1/boards/${boardId}/tasks`)
      .set(AUTH_HEADER(token))
      .send({ title: 'Original', description: 'Before', columnId: columns[0].id })
      .expect(201);

    const taskId = created.body.data.task.id;
    const res = await request(ctx.app)
      .patch(`/api/v1/boards/${boardId}/tasks/${taskId}`)
      .set(AUTH_HEADER(token))
      .send({ title: 'Updated', description: 'After' })
      .expect(200);

    expect(res.body.data.task.title).toBe('Updated');
    expect(res.body.data.task.description).toBe('After');
  });

  it('cannot move or update a task from another board', async () => {
    const other = await registerUser(ctx);
    const otherBoard = await createBoard(ctx, other.token, 'Theirs');
    const otherColumns = await getColumns(ctx, other.token, otherBoard.boardId);
    const theirTask = await request(ctx.app)
      .post(`/api/v1/boards/${otherBoard.boardId}/tasks`)
      .set(AUTH_HEADER(other.token))
      .send({ title: 'Theirs', columnId: otherColumns[0].id })
      .expect(201);

    const res = await request(ctx.app)
      .patch(`/api/v1/boards/${boardId}/tasks/${theirTask.body.data.task.id}`)
      .set(AUTH_HEADER(token))
      .send({ title: 'Hacked' })
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('deletes a task', async () => {
    const columns = await getColumns(ctx, token, boardId);
    const created = await request(ctx.app)
      .post(`/api/v1/boards/${boardId}/tasks`)
      .set(AUTH_HEADER(token))
      .send({ title: 'Delete me', columnId: columns[0].id })
      .expect(201);

    await request(ctx.app)
      .delete(`/api/v1/boards/${boardId}/tasks/${created.body.data.task.id}`)
      .set(AUTH_HEADER(token))
      .expect(204);

    const after = await getColumns(ctx, token, boardId);
    expect(after.flatMap((c) => c.tasks)).toHaveLength(0);
  });

  it('does not delete a task from another board', async () => {
    const other = await registerUser(ctx);
    const otherBoard = await createBoard(ctx, other.token, 'Theirs');
    const otherColumns = await getColumns(ctx, other.token, otherBoard.boardId);
    const theirTask = await request(ctx.app)
      .post(`/api/v1/boards/${otherBoard.boardId}/tasks`)
      .set(AUTH_HEADER(other.token))
      .send({ title: 'Keep me', columnId: otherColumns[0].id })
      .expect(201);

    const res = await request(ctx.app)
      .delete(`/api/v1/boards/${boardId}/tasks/${theirTask.body.data.task.id}`)
      .set(AUTH_HEADER(token))
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
