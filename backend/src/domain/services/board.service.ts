import { Board, BoardWithDetails, Task } from '../entities';

/** Input for creating a board. */
export interface CreateBoardInput {
  name: string;
  ownerId: string;
}

/** Input for creating a task inside a column. */
export interface CreateTaskInput {
  title: string;
  description?: string;
  columnId: string;
}

/** Partial input for updating a task; only provided fields are changed. */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  order?: number;
  columnId?: string;
}

/**
 * A domain event broadcast to connected clients after a mutation.
 * `data` carries the event-specific payload (e.g. the created task).
 */
export interface RealtimeEvent {
  type: 'task.created' | 'task.updated' | 'task.deleted' | 'column.added';
  boardId: string;
  data: unknown;
  at: string;
}

/**
 * Port for board operations.
 * Implemented by `BoardServiceImpl`; the API layer depends on this interface
 * so it can be swapped or mocked in tests.
 */
export interface BoardService {
  createBoard(input: CreateBoardInput): Promise<Board>;
  listBoards(ownerId: string): Promise<Board[]>;
  getBoard(boardId: string, userId: string): Promise<BoardWithDetails>;
  addColumn(
    boardId: string,
    userId: string,
    title: string
  ): Promise<{ board: BoardWithDetails; event: RealtimeEvent }>;
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
  deleteTask(boardId: string, userId: string, taskId: string): Promise<{ event: RealtimeEvent }>;
}
