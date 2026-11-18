import request from 'supertest';
import {
  buildTestApp,
  registerUser,
  createBoard,
  resetDb,
  AUTH_HEADER,
  TestContext,
} from './helpers';

describe('Boards API', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  beforeEach(async () => {
    await resetDb();
    token = (await registerUser(ctx)).token;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('creates a board with three default columns', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/boards')
      .set(AUTH_HEADER(token))
      .send({ name: 'Sprint 42' })
      .expect(201);

    const boardId = res.body.data.board.id;
    const detail = await request(ctx.app)
      .get(`/api/v1/boards/${boardId}`)
      .set(AUTH_HEADER(token))
      .expect(200);
    const titles = detail.body.data.board.columns.map((c: { title: string }) => c.title);
    expect(titles).toEqual(['Backlog', 'In Progress', 'Done']);
  });

  it('lists only the authenticated user’s boards', async () => {
    const other = await registerUser(ctx);
    await createBoard(ctx, token, 'Mine');
    await createBoard(ctx, other.token, 'Theirs');

    const res = await request(ctx.app).get('/api/v1/boards').set(AUTH_HEADER(token)).expect(200);
    const names = res.body.data.boards.map((b: { name: string }) => b.name);
    expect(names).toEqual(['Mine']);
  });

  it('rejects access to another user’s board', async () => {
    const other = await registerUser(ctx);
    const { boardId } = await createBoard(ctx, other.token, 'Private');
    const res = await request(ctx.app)
      .get(`/api/v1/boards/${boardId}`)
      .set(AUTH_HEADER(token))
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for a nonexistent board', async () => {
    const missing = '00000000-0000-0000-0000-000000000000';
    const res = await request(ctx.app)
      .get(`/api/v1/boards/${missing}`)
      .set(AUTH_HEADER(token))
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('adds a column', async () => {
    const { boardId } = await createBoard(ctx, token);
    const res = await request(ctx.app)
      .post(`/api/v1/boards/${boardId}/columns`)
      .set(AUTH_HEADER(token))
      .send({ title: 'Review' })
      .expect(201);

    const titles = res.body.data.board.columns.map((c: { title: string }) => c.title);
    expect(titles).toContain('Review');
  });
});
