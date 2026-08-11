import { Board, BoardWithDetails, Column, Task } from '../../domain/entities';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors';
import { BoardRepository } from '../../domain/repositories';
import {
  BoardService,
  CreateTaskInput,
  RealtimeEvent,
  UpdateTaskInput,
} from '../../domain/services/board.service';

/** Columns created automatically with every new board. */
export const DEFAULT_COLUMNS = [
  { title: 'Backlog', order: 0 },
  { title: 'In Progress', order: 1 },
  { title: 'Done', order: 2 },
];

/**
 * Concrete board service backed by a `BoardRepository`.
 * Owns all business rules: ownership checks, input validation, task ordering,
 * and the realtime events emitted after each mutation.
 */
export class BoardServiceImpl implements BoardService {
  constructor(private readonly boards: BoardRepository) {}

  /** Creates a board with the default column set. */
  async createBoard(input: { name: string; ownerId: string }): Promise<Board> {
    const name = assertValidTitle(input.name, 80, 'Board name');
    return this.boards.createWithDefaultColumns({ ...input, name, columns: DEFAULT_COLUMNS });
  }

  /** Lists all boards owned by the given user, newest first. */
  listBoards(ownerId: string): Promise<Board[]> {
    return this.boards.listByOwner(ownerId);
  }

  /** Loads a board with columns/tasks, enforcing ownership. */
  async getBoard(boardId: string, userId: string): Promise<BoardWithDetails> {
    const board = await this.boards.findWithColumnsAndTasks(boardId);
    if (!board) {
      throw new NotFoundError('Board not found');
    }
    this.assertOwnership(board, userId);
    return board;
  }

  /** Appends a column to the end of a board and emits a `column.added` event. */
  async addColumn(
    boardId: string,
    userId: string,
    title: string
  ): Promise<{ board: BoardWithDetails; event: RealtimeEvent }> {
    const clean = assertValidTitle(title, 60, 'Column title');

    const board = await requireBoard(this.boards, boardId);
    this.assertOwnership(board, userId);

    const current = await this.boards.findWithColumnsAndTasks(boardId);
    const order = current ? current.columns.length : 0;
    await this.boards.addColumn({ title: clean, order, boardId });

    const updated = await requireBoardWithDetails(this.boards, boardId);
    return {
      board: updated,
      event: makeEvent('column.added', boardId, { title: clean }),
    };
  }

  /** Creates a task at the end of a column and emits a `task.created` event. */
  async createTask(
    boardId: string,
    userId: string,
    input: CreateTaskInput
  ): Promise<{ task: Task; event: RealtimeEvent }> {
    const title = assertValidTitle(input.title, 200, 'Task title');
    if (input.description && input.description.length > 2000) {
      throw new ValidationError('Task description must be 2000 characters or fewer');
    }

    const board = await requireBoard(this.boards, boardId);
    this.assertOwnership(board, userId);

    const column = await requireColumn(this.boards, boardId, input.columnId);

    const task = await this.boards.runInTransaction(async (tx) => {
      const order = (await tx.maxTaskOrder(column.id)) + 1;
      const created = await tx.createTask({
        title,
        description: input.description?.trim() || null,
        order,
        columnId: column.id,
        boardId,
      });
      await tx.normalizeColumnOrders(column.id);
      return created;
    });

    return {
      task,
      event: makeEvent('task.created', boardId, { task }),
    };
  }

  /** Applies a partial update to a task and emits a `task.updated` event. */
  async updateTask(
    boardId: string,
    userId: string,
    taskId: string,
    input: UpdateTaskInput
  ): Promise<{ task: Task; event: RealtimeEvent }> {
    if (input.title !== undefined && input.title.trim().length === 0) {
      throw new ValidationError('Task title cannot be empty');
    }
    if (input.order !== undefined && (!Number.isInteger(input.order) || input.order < 0)) {
      throw new ValidationError('Order must be a non-negative integer');
    }

    const board = await requireBoard(this.boards, boardId);
    this.assertOwnership(board, userId);

    const task = await requireTaskInBoard(this.boards, taskId, boardId);

    const targetColumnId = input.columnId ?? task.columnId;
    if (input.columnId) {
      await requireColumn(this.boards, boardId, input.columnId);
    }

    const patch = buildTaskPatch(input);
    const updated = await this.boards.runInTransaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.updateTask(taskId, patch);
      }
      // Re-index both the source and destination columns so orders stay dense.
      const affected = new Set<string>([task.columnId]);
      if (targetColumnId !== task.columnId) affected.add(targetColumnId);
      await normalizeOrdersForColumns(tx, affected);

      const fresh = await tx.findTaskById(taskId);
      if (!fresh) {
        throw new NotFoundError('Task not found');
      }
      return fresh;
    });

    return {
      task: updated,
      event: makeEvent('task.updated', boardId, { task: updated }),
    };
  }

  /** Deletes a task and emits a `task.deleted` event. */
  async deleteTask(boardId: string, userId: string, taskId: string): Promise<{ event: RealtimeEvent }> {
    const board = await requireBoard(this.boards, boardId);
    this.assertOwnership(board, userId);

    const task = await requireTaskInBoard(this.boards, taskId, boardId);

    await this.boards.runInTransaction(async (tx) => {
      await tx.deleteTask(taskId);
      await tx.normalizeColumnOrders(task.columnId);
    });

    return {
      event: makeEvent('task.deleted', boardId, { taskId, columnId: task.columnId }),
    };
  }

  /** Throws `ForbiddenError` unless the user owns the board. */
  private assertOwnership(board: { ownerId: string }, userId: string): void {
    if (board.ownerId !== userId) {
      throw new ForbiddenError('You do not own this board');
    }
  }
}

/**
 * Trims `title` and validates its length, returning the cleaned value.
 * Throws a `ValidationError` with a field-specific message when invalid.
 */
function assertValidTitle(title: string, maxLength: number, fieldName: string): string {
  const clean = title.trim();
  if (clean.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
  if (clean.length > maxLength) {
    throw new ValidationError(`${fieldName} must be ${maxLength} characters or fewer`);
  }
  return clean;
}

/** Loads a board by id or throws `NotFoundError`. */
async function requireBoard(boards: BoardRepository, boardId: string): Promise<Board> {
  const board = await boards.findById(boardId);
  if (!board) {
    throw new NotFoundError('Board not found');
  }
  return board;
}

/** Loads a board with columns/tasks or throws `NotFoundError`. */
async function requireBoardWithDetails(boards: BoardRepository, boardId: string): Promise<BoardWithDetails> {
  const board = await boards.findWithColumnsAndTasks(boardId);
  if (!board) {
    throw new NotFoundError('Board not found');
  }
  return board;
}

/** Loads a task and verifies it belongs to the given board. */
async function requireTaskInBoard(
  boards: BoardRepository,
  taskId: string,
  boardId: string
): Promise<Task> {
  const task = await boards.findTaskById(taskId);
  if (!task || task.boardId !== boardId) {
    throw new NotFoundError('Task not found in this board');
  }
  return task;
}

/** Loads a column and verifies it belongs to the given board. */
async function requireColumn(
  boards: BoardRepository,
  boardId: string,
  columnId: string
): Promise<Column> {
  const current = await boards.findWithColumnsAndTasks(boardId);
  const column = current?.columns.find((c) => c.id === columnId);
  if (!column) {
    throw new ValidationError('Invalid column');
  }
  return column;
}

/** Builds the partial task update from the fields the client provided. */
function buildTaskPatch(input: UpdateTaskInput): Partial<Pick<Task, 'title' | 'description' | 'order' | 'columnId'>> {
  const patch: Partial<Pick<Task, 'title' | 'description' | 'order' | 'columnId'>> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) {
    patch.description = input.description === null ? null : input.description.trim() || null;
  }
  if (input.order !== undefined) patch.order = input.order;
  if (input.columnId !== undefined) patch.columnId = input.columnId;
  return patch;
}

/** Rewrites task orders to 0..n-1 for every affected column. */
async function normalizeOrdersForColumns(tx: BoardRepository, columnIds: Set<string>): Promise<void> {
  for (const columnId of columnIds) {
    await tx.normalizeColumnOrders(columnId);
  }
}

/** Builds a realtime event stamped with the current time. */
function makeEvent(
  type: RealtimeEvent['type'],
  boardId: string,
  data: unknown
): RealtimeEvent {
  return { type, boardId, data, at: new Date().toISOString() };
}