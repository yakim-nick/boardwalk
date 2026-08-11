import { Router } from 'express';
import { BoardController } from '../controllers/board.controller';
import { createApiRateLimiter } from '../middleware/rate-limiter';
import { BoardService } from '../../domain/services/board.service';
import { RealtimeEventPublisher } from '../../domain/services/realtime-publisher';
import { Redis } from 'ioredis';
import { RequestHandler } from 'express';

/** Builds the `/boards` router; every route requires authentication. */
export function createBoardRouter(
  boards: BoardService,
  realtime: RealtimeEventPublisher,
  redis: Redis | null,
  authMiddleware: RequestHandler
): Router {
  const router = Router();
  const controller = new BoardController(boards, realtime);

  router.use(createApiRateLimiter(redis));

  router.post('/', authMiddleware, controller.createBoard);
  router.get('/', authMiddleware, controller.listBoards);
  router.get('/:boardId', authMiddleware, controller.getBoard);
  router.post('/:boardId/columns', authMiddleware, controller.addColumn);
  router.post('/:boardId/tasks', authMiddleware, controller.createTask);
  router.patch('/:boardId/tasks/:taskId', authMiddleware, controller.updateTask);
  router.delete('/:boardId/tasks/:taskId', authMiddleware, controller.deleteTask);

  return router;
}