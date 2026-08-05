import { Board, BoardWithDetails, Task } from '../entities';

export interface CreateBoardInput {
  name: string;
  ownerId: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  columnId: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  order?: number;
  columnId?: string;
}

export interface RealtimeEvent {
  type: 'task.created' | 'task.updated' | 'task.deleted' | 'column.added';
  boardId: string;
  data: unknown;
  at: string;
}

export interface BoardService {
  createBoard(input: CreateBoardInput): Promise<Board>;
  listBoards(ownerId: string): Promise<Board[]>;
  getBoard(boardId: string, userId: string): Promise<BoardWithDetails>;
  addColumn(boardId: string, userId: string, title: string): Promise<{ board: BoardWithDetails; event: RealtimeEvent }>;
  createTask(
    boardId: string,
    userId: string,
    input: CreateTaskInput
  ): Promise<{ task: Task; event: RealtimeEvent }>;
  updateTask(
    boardId: string,
    userId: string,
    taskId: string,
    input: UpdateTaskInput
  ): Promise<{ task: Task; event: RealtimeEvent }>;
  deleteTask(
    boardId: string,
    userId: string,
    taskId: string
  ): Promise<{ event: RealtimeEvent }>;
}
