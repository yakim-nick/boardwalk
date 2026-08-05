import { Board, BoardWithDetails, Task } from '../../domain/entities';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors';
import { BoardRepository } from '../../domain/repositories';
import { BoardService, CreateTaskInput, RealtimeEvent, UpdateTaskInput } from '../../domain/services/board.service';

export const DEFAULT_COLUMNS = [
  { title: 'Backlog', order: 0 },
  { title: 'In Progress', order: 1 },
  { title: 'Done', order: 2 },
];

export class BoardServiceImpl implements BoardService {
  constructor(private readonly boards: BoardRepository) {}

  async createBoard(input: { name: string; ownerId: string }): Promise<Board> {
    const name = input.name.trim();
    if (name.length === 0) {
      throw new ValidationError('Board name cannot be empty');
    }
    if (name.length > 80) {
      throw new ValidationError('Board name must be 80 characters or fewer');
    }
    return this.boards.createWithDefaultColumns({ ...input, name, columns: DEFAULT_COLUMNS });
  }

  listBoards(ownerId: string): Promise<Board[]> {
    return this.boards.listByOwner(ownerId);
  }

  async getBoard(boardId: string, userId: string): Promise<BoardWithDetails> {
    const board = await this.boards.findWithColumnsAndTasks(boardId);
    if (!board) {
      throw new NotFoundError('Board not found');
    }
    this.assertOwnership(board, userId);
    return board;
  }

  async addColumn(
    boardId: string,
    userId: string,
    title: string
  ): Promise<{ board: BoardWithDetails; event: RealtimeEvent }> {
    const clean = title.trim();
    if (clean.length === 0) {
      throw new ValidationError('Column title cannot be empty');
    }
    if (clean.length > 60) {
      throw new ValidationError('Column title must be 60 characters or fewer');
    }

    const board = await this.boards.findById(boardId);
    if (!board) {
      throw new NotFoundError('Board not found');
    }
    this.assertOwnership(board, userId);

    const current = await this.boards.findWithColumnsAndTasks(boardId);
    const order = current ? current.columns.length : 0;
    await this.boards.addColumn({ title: clean, order, boardId });

    const updated = await this.boards.findWithColumnsAndTasks(boardId);
    if (!updated) {
      throw new NotFoundError('Board not found');
    }
    return {
      board: updated,
      event: { type: 'column.added', boardId, data: { title: clean }, at: new Date().toISOString() },
    };
  }

  async createTask(
    boardId: string,
    userId: string,
    input: CreateTaskInput
  ): Promise<{ task: Task; event: RealtimeEvent }> {
    const title = input.title.trim();
    if (title.length === 0) {
      throw new ValidationError('Task title cannot be empty');
    }
    if (title.length > 200) {
      throw new ValidationError('Task title must be 200 characters or fewer');
    }
    if (input.description && input.description.length > 2000) {
      throw new ValidationError('Task description must be 2000 characters or fewer');
    }

    const board = await this.boards.findById(boardId);
    if (!board) {
      throw new NotFoundError('Board not found');
    }
    this.assertOwnership(board, userId);

    const current = await this.boards.findWithColumnsAndTasks(boardId);
    const column = current?.columns.find((c) => c.id === input.columnId);
    if (!column) {
      throw new ValidationError('Invalid column');
    }

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
      event: { type: 'task.created', boardId, data: { task }, at: new Date().toISOString() },
    };
  }

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

    const board = await this.boards.findById(boardId);
    if (!board) {
      throw new NotFoundError('Board not found');
    }
    this.assertOwnership(board, userId);

    const task = await this.boards.findTaskById(taskId);
    if (!task || task.boardId !== boardId) {
      throw new NotFoundError('Task not found in this board');
    }

    const targetColumnId = input.columnId ?? task.columnId;
    if (input.columnId) {
      const current = await this.boards.findWithColumnsAndTasks(boardId);
      const targetColumn = current?.columns.find((c) => c.id === input.columnId);
      if (!targetColumn) {
        throw new ValidationError('Invalid column');
      }
    }

    const patch: Partial<Pick<Task, 'title' | 'description' | 'order' | 'columnId'>> = {};
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.description !== undefined) {
      patch.description = input.description === null ? null : input.description.trim() || null;
    }
    if (input.order !== undefined) patch.order = input.order;
    if (input.columnId !== undefined) patch.columnId = input.columnId;

    const updated = await this.boards.runInTransaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.updateTask(taskId, patch);
      }
      const affected = new Set<string>([task.columnId]);
      if (targetColumnId !== task.columnId) affected.add(targetColumnId);
      for (const columnId of affected) {
        await tx.normalizeColumnOrders(columnId);
      }
      const fresh = await tx.findTaskById(taskId);
      if (!fresh) {
        throw new NotFoundError('Task not found');
      }
      return fresh;
    });

    return {
      task: updated,
      event: { type: 'task.updated', boardId, data: { task: updated }, at: new Date().toISOString() },
    };
  }

  async deleteTask(boardId: string, userId: string, taskId: string): Promise<{ event: RealtimeEvent }> {
    const board = await this.boards.findById(boardId);
    if (!board) {
      throw new NotFoundError('Board not found');
    }
    this.assertOwnership(board, userId);

    const task = await this.boards.findTaskById(taskId);
    if (!task || task.boardId !== boardId) {
      throw new NotFoundError('Task not found in this board');
    }

    await this.boards.runInTransaction(async (tx) => {
      await tx.deleteTask(taskId);
      await tx.normalizeColumnOrders(task.columnId);
    });

    return {
      event: {
        type: 'task.deleted',
        boardId,
        data: { taskId, columnId: task.columnId },
        at: new Date().toISOString(),
      },
    };
  }

  private assertOwnership(board: { ownerId: string }, userId: string): void {
    if (board.ownerId !== userId) {
      throw new ForbiddenError('You do not own this board');
    }
  }
}
