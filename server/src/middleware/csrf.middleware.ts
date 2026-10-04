import type { Request, Response, NextFunction } from 'express';

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    const expected = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    if (origin !== expected) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid origin' } });
      return;
    }
  }
  next();
}
