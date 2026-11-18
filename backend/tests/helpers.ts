import request from 'supertest';
import { Express } from 'express';
import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { loadEnv, Env } from '../src/config/env';
import { prisma } from '../src/infrastructure/database/prisma';
import { RedisProvider } from '../src/infrastructure/redis/redis';
import {
  PrismaUserRepository,
  PrismaBoardRepository,
} from '../src/infrastructure/repositories/prisma.repositories';
import { AuthServiceImpl } from '../src/application/services/auth.service';
import { BoardServiceImpl } from '../src/application/services/board.service';
import { RealtimeHub } from '../src/infrastructure/websocket/realtime';
import { requireAuth } from '../src/api/middleware/auth';
import { createApiRouter } from '../src/api/routes';
import { createApp } from '../src/app';

export interface TestContext {
  app: Express;
  env: Env;
  redis: RedisProvider | null;
  httpServer: Server;
  wss: WebSocketServer;
  realtime: RealtimeHub;
  close: () => Promise<void>;
}

export async function buildTestApp(): Promise<TestContext> {
  const env = loadEnv();

  let redis: RedisProvider | null = null;
  try {
    redis = new RedisProvider(env);
    await redis.connect();
  } catch {
    redis = null;
  }

  const userRepo = new PrismaUserRepository(prisma);
  const boardRepo = new PrismaBoardRepository(prisma);

  const auth = new AuthServiceImpl(userRepo, env);
  const boards = new BoardServiceImpl(boardRepo);

  const httpServer = new Server();
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const realtime = new RealtimeHub(
    wss,
    redis?.client ?? (null as never),
    redis?.subscriber ?? (null as never),
    auth,
    boards
  );

  const app = createApp({
    env,
    api: createApiRouter({
      auth,
      boards,
      realtime,
      redis: redis?.client ?? null,
      authMiddleware: requireAuth(auth),
    }),
  });

  return {
    app,
    env,
    redis,
    httpServer,
    wss,
    realtime,
    close: async () => {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await redis?.disconnect();
      await prisma.$disconnect();
    },
  };
}

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "tasks", "columns", "boards", "users" RESTART IDENTITY CASCADE'
  );
}

export async function registerUser(
  ctx: TestContext,
  overrides: { name?: string; email?: string; password?: string } = {}
): Promise<{ token: string; userId: string; email: string }> {
  const name = overrides.name ?? 'Test User';
  const email =
    overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = overrides.password ?? 'Password123';

  const res = await request(ctx.app)
    .post('/api/v1/auth/register')
    .send({ name, email, password })
    .expect(201);

  return { token: res.body.data.token, userId: res.body.data.user.id, email };
}

export async function createBoard(
  ctx: TestContext,
  token: string,
  name = 'My Board'
): Promise<{ boardId: string }> {
  const res = await request(ctx.app)
    .post('/api/v1/boards')
    .set('Authorization', `Bearer ${token}`)
    .send({ name })
    .expect(201);

  return { boardId: res.body.data.board.id };
}

export const AUTH_HEADER = (token: string) => ({ Authorization: `Bearer ${token}` });
