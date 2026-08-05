import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import pino from 'pino';
import { Env } from './config/env';
import { createApiRouter } from './api/routes';
import { errorHandler } from './api/middleware/errors';

export interface AppDeps {
  env: Env;
  api: ReturnType<typeof createApiRouter>;
}

export function createApp({ env, api }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const logger = pino({ level: env.logLevel, base: { service: 'flowboard-api' } });

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(','),
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '64kb' }));

  app.use('/api/v1', api);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use(errorHandler);

  return app;
}
