import type { Request, Response, NextFunction } from 'express';

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user!.isPlatformAdmin) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Platform admin required' } });
    return;
  }
  next();
}