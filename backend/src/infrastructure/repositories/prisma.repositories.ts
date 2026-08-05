import { PrismaClient, User as PrismaUser, Board as PrismaBoard, Task as PrismaTask } from '@prisma/client';
import { Board, BoardWithDetails, Column, Task, User } from '../../domain/entities';
import { BoardRepository, UserRepository } from '../../domain/repositories';

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

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const row = await this.db.user.create({
      data: { name: data.name, email: data.email, passwordHash: data.passwordHash },
    });
    return toUser(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  }
}

function toBoard(row: PrismaBoard): Board {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaBoardRepository implements BoardRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: { name: string; ownerId: string }): Promise<Board> {
    const row = await this.db.board.create({ data });
    return toBoard(row);
  }

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

  async findById(id: string): Promise<Board | null> {
    const row = await this.db.board.findUnique({ where: { id } });
    return row ? toBoard(row) : null;
  }

  async listByOwner(ownerId: string): Promise<Board[]> {
    const rows = await this.db.board.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toBoard);
  }

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

  async addColumn(data: { title: string; order: number; boardId: string }): Promise<Column> {
    const row = await this.db.column.create({ data });
    return {
      id: row.id,
      title: row.title,
      order: row.order,
      boardId: row.boardId,
    };
  }

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

  async updateTask(
    id: string,
    data: Partial<Pick<Task, 'title' | 'description' | 'order' | 'columnId'>>
  ): Promise<Task | null> {
    const row = await this.db.task.update({ where: { id }, data });
    return row ? toTask(row) : null;
  }

  async findTaskById(id: string): Promise<Task | null> {
    const row = await this.db.task.findUnique({ where: { id } });
    return row ? toTask(row) : null;
  }

  async deleteTask(id: string): Promise<void> {
    await this.db.task.delete({ where: { id } });
  }

  async maxTaskOrder(columnId: string): Promise<number> {
    const agg = await this.db.task.aggregate({ where: { columnId }, _max: { order: true } });
    return agg._max.order ?? -1;
  }

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

  async runInTransaction<T>(work: (repo: BoardRepository) => Promise<T>): Promise<T> {
    return this.db.$transaction(async (tx) => work(new PrismaBoardRepository(tx as unknown as PrismaClient)));
  }
}

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
