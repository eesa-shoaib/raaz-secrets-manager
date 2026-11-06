import type { Request, Response, NextFunction } from 'express';
import { findAuthenticatedUser, verifyToken } from '../services/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const authenticate = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const token = req.cookies?.token;
        if (!token) {
            res.status(401).json({
                error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid auth cookie' },
            });
            return;
        }

        const payload = verifyToken(token);
        if (!payload) {
            res.status(401).json({
                error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid auth cookie' },
            });
            return;
        }

        const user = await findAuthenticatedUser(payload.sub, payload.tv);
        if (!user) {
            res.status(401).json({
                error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid auth cookie' },
            });
            return;
        }

        req.user = user;
        next();
    },
);
