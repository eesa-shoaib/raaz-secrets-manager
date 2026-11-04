import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../middleware/authenticate.middleware.js', () => ({ authenticate: (req: Request, _res: Response, next: NextFunction) => { req.user = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'test@example.com', isPlatformAdmin: false, isActive: true, createdAt: new Date(), updatedAt: new Date() }; next(); } }));
vi.mock('../middleware/require-project-role.middleware.js', () => ({ requireProjectRole: () => (_req: Request, _res: Response, next: NextFunction) => next() }));
vi.mock('../middleware/require-project-status.middleware.js', () => ({ requireProjectStatus: (_req: Request, _res: Response, next: NextFunction) => next() }));
vi.mock('../middleware/rate-limiters.middleware.js', () => ({ revealLimiter: (_req: Request, _res: Response, next: NextFunction) => next() }));
vi.mock('../services/secrets.service.js', () => ({
  createSecret: vi.fn(async () => ({ _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', key: 'API_KEY', environment: 'development', createdAt: new Date(), updatedAt: new Date(), ciphertext: 'must-not-leak' })),
  listSecretsForUser: vi.fn(), editSecret: vi.fn(), deleteSecret: vi.fn(), getSecretMetadata: vi.fn(), revealSecret: vi.fn(),
}));

import { errorHandler } from '../middleware/error.middleware.js';
import { secretRoutes } from './secret.routes.js';

describe('secret creation route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/projects', secretRoutes);
  app.use(errorHandler);
  it('creates a secret at the documented path without exposing storage fields', async () => {
    const response = await request(app).post('/api/projects/aaaaaaaaaaaaaaaaaaaaaaaa/secrets').send({ key: 'API_KEY', environment: 'development', value: 'example' });
    expect(response.status).toBe(201);
    expect(response.body.maskedValue).toBe('••••••••');
    expect(response.body).not.toHaveProperty('ciphertext');
    expect(response.body).not.toHaveProperty('value');
  });
  it('rejects invalid project IDs before the controller', async () => {
    const response = await request(app).post('/api/projects/invalid/secrets').send({ key: 'API_KEY', environment: 'development', value: 'example' });
    expect(response.status).toBe(422);
  });
  it('explains invalid fields without reflecting submitted values', async () => {
    const response = await request(app).post('/api/projects/aaaaaaaaaaaaaaaaaaaaaaaa/secrets').send({ key: 'bad-key', environment: 'invalid-env', value: 'sensitive-input' });
    expect(response.status).toBe(422);
    expect(response.body.error.message).toContain('key must contain');
    expect(response.body.error.message).toContain('environment must be');
    expect(JSON.stringify(response.body)).not.toContain('bad-key');
    expect(JSON.stringify(response.body)).not.toContain('invalid-env');
    expect(JSON.stringify(response.body)).not.toContain('sensitive-input');
  });
});
