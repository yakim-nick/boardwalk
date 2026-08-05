import { Router } from 'express';
import { createAuthRouter } from './auth.routes';
import { createBoardRouter } from './board.routes';
import { AuthService } from '../../domain/services/auth.service';
import { BoardService } from '../../domain/services/board.service';
import { RealtimeEventPublisher } from '../../domain/services/realtime-publisher';
import { Redis } from 'ioredis';
import { RequestHandler } from 'express';

export interface ApiDependencies {
  auth: AuthService;
  boards: BoardService;
  realtime: RealtimeEventPublisher;
  redis: Redis | null;
  authMiddleware: RequestHandler;
}

export function createApiRouter(deps: ApiDependencies): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'flowboard-api', time: new Date().toISOString() });
  });

  router.use('/auth', createAuthRouter(deps.auth, deps.redis));
  router.use('/boards', createBoardRouter(deps.boards, deps.realtime, deps.redis, deps.authMiddleware));

  return router;
}
