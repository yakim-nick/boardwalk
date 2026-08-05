import { Board, BoardWithDetails, Column, Task, User } from '../entities';

/**
 * Ports (interfaces) for the persistence layer.
 * Implementing these in Prisma keeps services free of infrastructure
 * details and enables dependency inversion + trivial mocking in tests.
 */

export interface UserRepository {
  create(data: { name: string; email: string; passwordHash: string }): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

export interface BoardRepository {
  create(data: { name: string; ownerId: string }): Promise<Board>;
  createWithDefaultColumns(data: {
    name: string;
    ownerId: string;
    columns: Array<{ title: string; order: number }>;
  }): Promise<Board>;
  findById(id: string): Promise<Board | null>;
  listByOwner(ownerId: string): Promise<Board[]>;
  findWithColumnsAndTasks(id: string): Promise<BoardWithDetails | null>;
  addColumn(data: { title: string; order: number; boardId: string }): Promise<Column>;
  createTask(data: {
    title: string;
    description: string | null;
    order: number;
    columnId: string;
    boardId: string;
  }): Promise<Task>;
  updateTask(
    id: string,
    data: Partial<Pick<Task, 'title' | 'description' | 'order' | 'columnId'>>
  ): Promise<Task | null>;
  findTaskById(id: string): Promise<Task | null>;
  deleteTask(id: string): Promise<void>;
  /** Highest task `order` currently used in a column (-1 when empty). */
  maxTaskOrder(columnId: string): Promise<number>;
  /** Rewrites a column's task orders to 0..n-1 in the current display order. */
  normalizeColumnOrders(columnId: string): Promise<void>;
  /** Runs `work` atomically on a repository bound to the same DB transaction. */
  runInTransaction<T>(work: (repo: BoardRepository) => Promise<T>): Promise<T>;
}
