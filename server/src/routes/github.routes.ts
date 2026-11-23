import {
    githubImportInputSchema,
    githubPageQuerySchema,
    githubRepositoriesQuerySchema,
    githubStartInputSchema,
} from '@raaz/shared-schemas';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as controller from '../controllers/github.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);
router.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 60,
        keyGenerator: (req) => req.user!.id,
        handler: (_req, res) =>
            res.status(429).json({
                error: {
                    code: 'RATE_LIMITED',
                    message: 'Too many GitHub requests. Try again later.',
                },
            }),
    }),
);
// Provider and database exceptions must never reach the generic error logger.
const handle = (handler: Parameters<typeof asyncHandler>[0]) =>
    asyncHandler(async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            throw error instanceof AppError
                ? error
                : new AppError(500, 'INTERNAL_ERROR', 'Unable to complete GitHub request');
        }
    });
router.get('/', handle(controller.githubStatusController));
router.post(
    '/start',
    validate(z.object({ body: githubStartInputSchema })),
    handle(controller.githubStartController),
);
router.get(
    '/callback',
    validate(
        z.object({
            query: z.object({
                state: z.string().min(1).max(256),
                code: z.string().min(1).max(4096).optional(),
                error: z.string().max(256).optional(),
            }),
        }),
    ),
    handle(controller.githubCallbackController),
);
router.delete('/', handle(controller.githubDisconnectController));
router.get(
    '/installations',
    validate(z.object({ query: githubPageQuerySchema })),
    handle(controller.githubInstallationsController),
);
router.get(
    '/repositories',
    validate(z.object({ query: githubRepositoriesQuerySchema })),
    handle(controller.githubRepositoriesController),
);
router.post(
    '/import',
    validate(z.object({ body: githubImportInputSchema })),
    handle(controller.githubImportController),
);
export const githubRoutes = router;
