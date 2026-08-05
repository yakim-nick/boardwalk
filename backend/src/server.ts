import http from 'http';
import { WebSocketServer } from 'ws';
import { loadEnv } from './config/env';
import { prisma } from './infrastructure/database/prisma';
import { RedisProvider } from './infrastructure/redis/redis';
import { PrismaUserRepository, PrismaBoardRepository } from './infrastructure/repositories/prisma.repositories';
import { AuthServiceImpl } from './application/services/auth.service';
import { BoardServiceImpl } from './application/services/board.service';
import { RealtimeHub } from './infrastructure/websocket/realtime';
import { requireAuth } from './api/middleware/auth';
import { createApiRouter } from './api/routes';
import { createApp } from './app';
import pino from 'pino';

const WS_SUBPROTOCOL = 'flowboard';
const MAX_WS_PAYLOAD = 16 * 1024;

/**
 * Composition root. All dependencies are constructed and wired here
 * (dependency injection without a framework).
 */

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = pino({ level: env.logLevel, base: { service: 'flowboard-bootstrap' } });

  const redis = new RedisProvider(env);
  await redis.connect();

  const userRepo = new PrismaUserRepository(prisma);
  const boardRepo = new PrismaBoardRepository(prisma);

  const auth = new AuthServiceImpl(userRepo, env);
  const boards = new BoardServiceImpl(boardRepo);

  const authMiddleware = requireAuth(auth);

  const server = http.createServer();

  const allowOrigins = env.corsOrigin === '*' ? [] : env.corsOrigin.split(',');
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: MAX_WS_PAYLOAD,
    handleProtocols: (protocols, request) => {
      const offered = Array.from(protocols);
      if (!offered.includes(WS_SUBPROTOCOL)) return false;
      const token = offered.find((p) => p !== WS_SUBPROTOCOL);
      if (token) {
        (request as unknown as { flowboardToken?: string }).flowboardToken = token;
      }
      return WS_SUBPROTOCOL;
    },
  });
  Object.assign(wss.options, { allowOrigins });

  const realtime = new RealtimeHub(wss, redis.client, redis.subscriber, auth, boards);
  realtime.start();

  const api = createApiRouter({
    auth,
    boards,
    realtime,
    redis: redis.client,
    authMiddleware,
  });

  const app = createApp({ env, api });
  server.on('request', app);

  server.listen(env.port, env.host, () => {
    logger.info(`FlowBoard API listening on http://${env.host}:${env.port} (${env.nodeEnv})`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    // Terminate upgraded WebSocket sockets first so server.close can complete.
    for (const client of wss.clients) {
      try {
        client.terminate();
      } catch {
        /* already closed */
      }
    }
    wss.close(() => {
      server.close(async () => {
        await redis.disconnect();
        await prisma.$disconnect();
        process.exit(0);
      });
    });

    setTimeout(() => {
      logger.error('shutdown timed out; forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
