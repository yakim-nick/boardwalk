/**
 * Shared frontend types mirroring the backend API responses.
 * Dates arrive as ISO-8601 strings over the wire.
 */

/** A registered user as returned by the API (no password material). */
export interface User {
  id: string;
  name: string;
  email: string;
}

/** A task card inside a column. */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  order: number;
  columnId: string;
  boardId: string;
  createdAt: string;
  updatedAt: string;
}

/** A column with its tasks, in display order. */
export interface Column {
  id: string;
  title: string;
  order: number;
  boardId: string;
  tasks: Task[];
}

/** A board without its contents. */
export interface Board {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** A board with its columns and tasks eagerly loaded. */
export interface BoardWithColumns extends Board {
  columns: Column[];
}

/**
 * Messages exchanged over the WebSocket.
 * Server-pushed domain events carry a `boardId` and event-specific `data`;
 * control messages (`connected`, `subscribed`, `pong`, `reconnected`) do not.
 */
export type RealtimeEvent =
  | { type: 'connected' }
  | { type: 'subscribed'; boardId: string }
  | { type: 'pong' }
  | { type: 'reconnected' }
  | { type: 'task.created'; boardId: string; data: { task: Task } }
  | { type: 'task.updated'; boardId: string; data: { task: Task } }
  | { type: 'task.deleted'; boardId: string; data: { taskId: string; columnId: string } }
  | { type: 'column.added'; boardId: string; data: { title: string } }
  | { type: 'error'; message: string };