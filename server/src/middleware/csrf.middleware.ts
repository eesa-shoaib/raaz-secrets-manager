import type { Request, Response, NextFunction } from 'express';
import { getClientOrigin } from '../config/index.js';

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
        const origin = req.headers.origin;
        const expected = getClientOrigin();
        if (origin !== expected) {
            res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid origin' } });
            return;
        }
    }
    next();
}
