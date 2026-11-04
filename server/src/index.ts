import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Express } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import { getClientOrigin, getPort } from './config/index.js';
import { csrfMiddleware } from './middleware/csrf.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiRoutes } from './routes/index.js';
import { bootstrapPlatformAdmin } from './services/auth.service.js';
import { validateBootConfig, logger } from './services/boot-validation.service.js';
import { connectMongo, disconnectMongo } from './services/mongo.service.js';

dotenv.config();

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: getClientOrigin(),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(requestLogger);
  app.use(csrfMiddleware);
  app.use('/api', apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function start(): Promise<void> {
  validateBootConfig();
  await connectMongo(process.env.MONGO_URI!);
  await bootstrapPlatformAdmin();

  const app = createApp();
  const server = app.listen(getPort(), () => {
    logger.info({ port: getPort() }, 'Server listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down server');
    server.close(async () => {
      await disconnectMongo();
      process.exit(0);
    });
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

const entrypoint = process.argv[1];
if (entrypoint && fileURLToPath(import.meta.url) === entrypoint) {
  start().catch((err: unknown) => {
    logger.fatal({ err }, 'Server failed to start');
    process.exit(1);
  });
}

function requestLogger(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const startedAt = performance.now();

  res.on('finish', () => {
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'Request completed',
    );
  });

  next();
}
