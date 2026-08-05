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

export class BoardController {
  constructor(
    private readonly boards: BoardService,
    private readonly realtime: RealtimeEventPublisher
  ) {}

  createBoard = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createBoardSchema.parse(req.body);
      const board = await this.boards.createBoard({ name: input.name, ownerId: req.userId! });
      res.status(201).json({ data: { board } });
    } catch (err) {
      next(err);
    }
  };

  listBoards = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const boards = await this.boards.listBoards(req.userId!);
      res.json({ data: { boards } });
    } catch (err) {
      next(err);
    }
  };

  getBoard = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId } = boardIdSchema.parse(req.params);
      const board = await this.boards.getBoard(boardId, req.userId!);
      res.json({ data: { board } });
    } catch (err) {
      next(err);
    }
  };

  addColumn = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId } = boardIdSchema.parse(req.params);
      const input = addColumnSchema.parse(req.body);
      const { board, event } = await this.boards.addColumn(boardId, req.userId!, input.title);
      this.realtime.publish(event);
      res.status(201).json({ data: { board } });
    } catch (err) {
      next(err);
    }
  };

  createTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId } = boardIdSchema.parse(req.params);
      const input = createTaskSchema.parse(req.body);
      const { task, event } = await this.boards.createTask(boardId, req.userId!, input);
      this.realtime.publish(event);
      res.status(201).json({ data: { task } });
    } catch (err) {
      next(err);
    }
  };

  updateTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, taskId } = taskIdSchema.parse(req.params);
      const input = updateTaskSchema.parse(req.body);
      const { task, event } = await this.boards.updateTask(boardId, req.userId!, taskId, input);
      this.realtime.publish(event);
      res.json({ data: { task } });
    } catch (err) {
      next(err);
    }
  };

  deleteTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, taskId } = taskIdSchema.parse(req.params);
      const { event } = await this.boards.deleteTask(boardId, req.userId!, taskId);
      this.realtime.publish(event);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
