export interface User {
  id: string;
  name: string;
  email: string;
}

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

export interface Column {
  id: string;
  title: string;
  order: number;
  boardId: string;
  tasks: Task[];
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardWithColumns extends Board {
  columns: Column[];
}

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
