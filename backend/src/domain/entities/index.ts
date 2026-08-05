export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: string;
  title: string;
  order: number;
  boardId: string;
}

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

export interface BoardWithDetails extends Board {
  columns: Array<Column & { tasks: Task[] }>;
}
