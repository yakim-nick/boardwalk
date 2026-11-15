/**
 * Domain entities — the shape of data as it flows through the application.
 * These are plain interfaces (no ORM types) so the domain layer stays
 * independent of the persistence implementation.
 */

/** A registered user account. `passwordHash` must never leave the API layer. */
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

/** User shape that is safe to expose to clients (no password material). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

/** A kanban board owned by a single user. */
export interface Board {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A vertical lane on a board; `order` controls left-to-right placement. */
export interface Column {
  id: string;
  title: string;
  order: number;
  boardId: string;
}

/** A card inside a column; `order` controls top-to-bottom placement. */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  order: number;
  columnId: string;
  boardId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A board with its columns and tasks eagerly loaded, in display order. */
export interface BoardWithDetails extends Board {
  columns: Array<Column & { tasks: Task[] }>;
}
