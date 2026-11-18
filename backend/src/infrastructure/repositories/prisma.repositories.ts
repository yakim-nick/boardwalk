import {
  PrismaClient,
  User as PrismaUser,
  Board as PrismaBoard,
  Task as PrismaTask,
} from '@prisma/client';
import { Board, BoardWithDetails, Column, Task, User } from '../../domain/entities';
import { BoardRepository, UserRepository } from '../../domain/repositories';

/**
 * Prisma-backed implementations of the repository ports.
 * Each method maps a Prisma row to the corresponding domain entity so the
 * rest of the application never depends on Prisma types.
 */

/** Maps a Prisma user row to the domain `User` entity. */
function toUser(row: PrismaUser): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** User persistence backed by Prisma. */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Inserts a new user row. */
  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const row = await this.db.user.create({
      data: { name: data.name, email: data.email, passwordHash: data.passwordHash },
    });
    return toUser(row);
  }

  /** Looks up a user by unique email. */
  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? toUser(row) : null;
  }

  /** Looks up a user by primary key. */
  async findById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  }
}

/** Maps a Prisma board row to the domain `Board` entity. */
function toBoard(row: PrismaBoard): Board {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Board persistence backed by Prisma. */
export class PrismaBoardRepository implements BoardRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Inserts a bare board row. */
  async create(data: { name: string; ownerId: string }): Promise<Board> {
    const row = await this.db.board.create({ data });
    return toBoard(row);
  }

  /** Inserts a board together with its initial columns in one transaction. */
  async createWithDefaultColumns(data: {
    name: string;
    ownerId: string;
    columns: Array<{ title: string; order: number }>;
  }): Promise<Board> {
    const row = await this.db.board.create({
      data: {
        name: data.name,
        ownerId: data.ownerId,
        columns: { create: data.columns },
      },
    });
    return toBoard(row);
  }

  /** Looks up a board by primary key. */
  async findById(id: string): Promise<Board | null> {
    const row = await this.db.board.findUnique({ where: { id } });
    return row ? toBoard(row) : null;
  }

  /** Lists a user's boards, newest first. */
  async listByOwner(ownerId: string): Promise<Board[]> {
    const rows = await this.db.board.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toBoard);
  }

  /** Loads a board with columns and tasks, both in display order. */
  async findWithColumnsAndTasks(id: string): Promise<BoardWithDetails | null> {
    const row = await this.db.board.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: { tasks: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!row) return null;
    return {
      ...toBoard(row),
      columns: row.columns.map((c) => ({
        id: c.id,
        title: c.title,
        order: c.order,
        boardId: c.boardId,
        tasks: c.tasks.map(toTask),
      })),
    };
  }

  /** Inserts a column row. */
  async addColumn(data: { title: string; order: number; boardId: string }): Promise<Column> {
    const row = await this.db.column.create({ data });
    return {
      id: row.id,
      title: row.title,
      order: row.order,
      boardId: row.boardId,
    };
  }

  /** Inserts a task row. */
  async createTask(data: {
    title: string;
    description: string | null;
    order: number;
    columnId: string;
    boardId: string;
  }): Promise<Task> {
    const row = await this.db.task.create({ data });
    return toTask(row);
  }

  /** Applies a partial update to a task row. */
  async updateTask(
    id: string,
    data: Partial<Pick<Task, 'title' | 'description' | 'order' | 'columnId'>>
  ): Promise<Task | null> {
    const row = await this.db.task.update({ where: { id }, data });
    return row ? toTask(row) : null;
  }

  /** Looks up a task by primary key. */
  async findTaskById(id: string): Promise<Task | null> {
    const row = await this.db.task.findUnique({ where: { id } });
    return row ? toTask(row) : null;
  }

  /** Deletes a task row. */
  async deleteTask(id: string): Promise<void> {
    await this.db.task.delete({ where: { id } });
  }

  /** Returns the highest task `order` in a column, or -1 when empty. */
  async maxTaskOrder(columnId: string): Promise<number> {
    const agg = await this.db.task.aggregate({ where: { columnId }, _max: { order: true } });
    return agg._max.order ?? -1;
  }

  /** Rewrites a column's task orders to 0..n-1 in the current display order. */
  async normalizeColumnOrders(columnId: string): Promise<void> {
    const tasks = await this.db.task.findMany({
      where: { columnId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    for (let index = 0; index < tasks.length; index += 1) {
      await this.db.task.update({ where: { id: tasks[index].id }, data: { order: index } });
    }
  }

  /** Runs `work` atomically on a repository bound to the same DB transaction. */
  async runInTransaction<T>(work: (repo: BoardRepository) => Promise<T>): Promise<T> {
    return this.db.$transaction(async (tx) =>
      work(new PrismaBoardRepository(tx as unknown as PrismaClient))
    );
  }
}

/** Maps a Prisma task row to the domain `Task` entity. */
function toTask(row: PrismaTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    order: row.order,
    columnId: row.columnId,
    boardId: row.boardId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
