import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service.js';
import { UserModel } from '../models/User.js';
import { Types } from 'mongoose';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.token;
  if (!token) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid auth cookie' } });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid auth cookie' } });
    return;
  }

  const user = await UserModel.findById(payload.sub).lean();
  if (!user || user.tokenVersion !== payload.tv || !user.isActive) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid auth cookie' } });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    isPlatformAdmin: user.isPlatformAdmin,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  next();
}
