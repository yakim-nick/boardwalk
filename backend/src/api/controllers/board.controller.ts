import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { BoardService } from '../../domain/services/board.service';
import { RealtimeEventPublisher } from '../../domain/services/realtime-publisher';
import { AuthenticatedRequest } from '../middleware/auth';

const boardIdSchema = z.object({ boardId: z.string().uuid('Invalid board id') });
const taskIdSchema = z.object({ boardId: z.string().uuid(), taskId: z.string().uuid() });

const createBoardSchema = z.object({ name: z.string().min(1).max(80) });
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  columnId: z.string().uuid('Invalid column id'),
});
const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  order: z.number().int().nonnegative().optional(),
  columnId: z.string().uuid('Invalid column id').optional(),
});
const addColumnSchema = z.object({ title: z.string().min(1).max(60) });

/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * Express error middleware instead of crashing the process.
 */
function asyncHandler(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  };
}

/** HTTP handlers for the board endpoints. */
export class BoardController {
  constructor(
    private readonly boards: BoardService,
    private readonly realtime: RealtimeEventPublisher
  ) {}

  /** POST /boards — creates a board owned by the authenticated user. */
  createBoard = asyncHandler(async (req, res) => {
    const input = createBoardSchema.parse(req.body);
    const board = await this.boards.createBoard({ name: input.name, ownerId: req.userId! });
    res.status(201).json({ data: { board } });
  });

  /** GET /boards — lists the authenticated user's boards. */
  listBoards = asyncHandler(async (req, res) => {
    const boards = await this.boards.listBoards(req.userId!);
    res.json({ data: { boards } });
  });

  /** GET /boards/:boardId — loads a board with columns and tasks. */
  getBoard = asyncHandler(async (req, res) => {
    const { boardId } = boardIdSchema.parse(req.params);
    const board = await this.boards.getBoard(boardId, req.userId!);
    res.json({ data: { board } });
  });

  /** POST /boards/:boardId/columns — appends a column and broadcasts the event. */
  addColumn = asyncHandler(async (req, res) => {
    const { boardId } = boardIdSchema.parse(req.params);
    const input = addColumnSchema.parse(req.body);
    const { board, event } = await this.boards.addColumn(boardId, req.userId!, input.title);
    this.realtime.publish(event);
    res.status(201).json({ data: { board } });
  });

  /** POST /boards/:boardId/tasks — creates a task and broadcasts the event. */
  createTask = asyncHandler(async (req, res) => {
    const { boardId } = boardIdSchema.parse(req.params);
    const input = createTaskSchema.parse(req.body);
    const { task, event } = await this.boards.createTask(boardId, req.userId!, input);
    this.realtime.publish(event);
    res.status(201).json({ data: { task } });
  });

  /** PATCH /boards/:boardId/tasks/:taskId — updates a task and broadcasts the event. */
  updateTask = asyncHandler(async (req, res) => {
    const { boardId, taskId } = taskIdSchema.parse(req.params);
    const input = updateTaskSchema.parse(req.body);
    const { task, event } = await this.boards.updateTask(boardId, req.userId!, taskId, input);
    this.realtime.publish(event);
    res.json({ data: { task } });
  });

  /** DELETE /boards/:boardId/tasks/:taskId — deletes a task and broadcasts the event. */
  deleteTask = asyncHandler(async (req, res) => {
    const { boardId, taskId } = taskIdSchema.parse(req.params);
    const { event } = await this.boards.deleteTask(boardId, req.userId!, taskId);
    this.realtime.publish(event);
    res.status(204).send();
  });
}