import { config } from 'dotenv';
import pino from 'pino';

config();

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'MASTER_KEY', 'MASTER_KEY_VERSION'] as const;

export function validateBootConfig(): void {
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const masterKey = Buffer.from(process.env.MASTER_KEY!, 'base64');
  if (masterKey.length !== 32) {
    throw new Error('MASTER_KEY must be 32 bytes (base64-encoded)');
  }

  const masterKeyVersion = Number.parseInt(process.env.MASTER_KEY_VERSION!, 10);
  if (!Number.isInteger(masterKeyVersion) || masterKeyVersion <= 0) {
    throw new Error('MASTER_KEY_VERSION must be a positive integer');
  }

  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  const sameSite = process.env.COOKIE_SAMESITE;
  if (sameSite && !['Strict', 'Lax', 'None'].includes(sameSite)) {
    throw new Error('COOKIE_SAMESITE must be one of: Strict, Lax, None');
  }

  if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN) {
    throw new Error('CLIENT_ORIGIN is required in production');
  }
}

export const getMasterKey = (): Buffer => {
  return Buffer.from(process.env.MASTER_KEY!, 'base64');
};

export const getMasterKeyVersion = (): number => {
  return Number.parseInt(process.env.MASTER_KEY_VERSION!, 10);
};

export const getJwtSecret = (): string => {
  return process.env.JWT_SECRET!;
};

export const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite =
    (process.env.COOKIE_SAMESITE?.toLowerCase() as 'strict' | 'lax' | 'none') ||
    (isProd ? 'none' : 'lax');

  return {
    httpOnly: true,
    secure: isProd,
    sameSite,
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

const logger = pino.default({ level: process.env.LOG_LEVEL || 'info' });
export { logger };
