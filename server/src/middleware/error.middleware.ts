import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../services/boot-validation.service.js';
import { AppError } from '../utils/app-error.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    logger.error('Response validation failed');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred' },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (isDuplicateKeyError(err)) {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with those values already exists' },
    });
    return;
  }

  logger.error({ err }, 'Unhandled request error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred' },
  });
};

function isDuplicateKeyError(err: unknown): err is { code: number } {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}
