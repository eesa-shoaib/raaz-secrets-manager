import { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { UserModel, type UserDoc } from '../models/User.js';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { getJwtSecret, getCookieOptions, logger } from './boot-validation.service.js';

const DUMMY_HASH = '$2b$10$dummyhashdummyhashdummyh';

export async function signup(email: string, password: string): Promise<UserDoc> {
  const existing = await UserModel.findOne({ email: email.toLowerCase() }).lean();
  if (existing) {
    throw new Error('CONFLICT:already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = new UserModel({
    email: email.toLowerCase(),
    passwordHash,
    isPlatformAdmin: false,
    isActive: true,
    tokenVersion: 0,
  });

  await user.save();
  return user;
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: UserDoc; token: string } | null> {
  const user = await UserModel.findOne({ email: email.toLowerCase() })
    .select('+passwordHash')
    .lean();
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;

  const isValid = await bcrypt.compare(password, hashToCompare);
  if (!isValid || !user || !user.isActive) {
    return null;
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(
    { sub: user.id, tv: user.tokenVersion, pa: user.isPlatformAdmin },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: expiresIn as jwt.SignOptions['expiresIn'] },
  );

  const userWithoutHash = { ...user, passwordHash: undefined } as unknown as UserDoc;
  return { user: userWithoutHash, token };
}

export async function bootstrapPlatformAdmin(): Promise<void> {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!email || !password) return;

  if (password.length < 8 || password.length > 72) {
    throw new Error('PLATFORM_ADMIN_PASSWORD must be 8-72 characters');
  }

  const existingAdmin = await UserModel.findOne({ isPlatformAdmin: true }).lean();
  if (existingAdmin) return;

  let user = (await UserModel.findOne({ email }).lean()) as UserDoc | null;
  const passwordHash = await bcrypt.hash(password, 10);

  if (user) {
    await UserModel.findByIdAndUpdate(user.id, {
      passwordHash,
      isPlatformAdmin: true,
      isActive: true,
      $inc: { tokenVersion: 1 },
    }).exec();
  } else {
    const created = await UserModel.create({
      email,
      passwordHash,
      isPlatformAdmin: true,
      isActive: true,
      tokenVersion: 0,
    });
    user = created.toObject() as UserDoc;
  }

  await PlatformConfigModel.findOneAndUpdate(
    { _id: 'singleton' },
    { $setOnInsert: { activePlatformAdminCount: 1 } },
    { upsert: true, new: true },
  ).exec();
}

export function issueToken(userId: string, tokenVersion: number, isPlatformAdmin: boolean): string {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ sub: userId, tv: tokenVersion, pa: isPlatformAdmin }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): { sub: string; tv: number; pa: boolean } | null {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as {
      sub: string;
      tv: number;
      pa: boolean;
    };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, getCookieOptions());
}

export function clearAuthCookie(res: Response): void {
  const opts = getCookieOptions();
  res.clearCookie('token', { ...opts, maxAge: 0 });
}
