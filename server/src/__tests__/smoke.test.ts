import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../index.js';
import { issueToken } from '../services/auth.service.js';

describe('server foundation', () => {
  it('returns standard 404 envelope for unknown API route', async () => {
    const response = await request(createApp()).get('/api/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /api/missing not found' },
    });
  });

  it('rejects state-changing requests without matching Origin', async () => {
    const response = await request(createApp()).post('/api/missing').send({ value: 'secret' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('validates signup input before the database is queried', async () => {
    const response = await request(createApp())
      .post('/api/auth/signup')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires an auth cookie for the current-user route', async () => {
    const response = await request(createApp()).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('signs the authenticated user ID as JWT subject', () => {
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-thirty-two-characters';
    const token = issueToken('6adf980a2a5c4ee3bc6d5461', 0, false);

    expect(jwt.decode(token)).toMatchObject({ sub: '6adf980a2a5c4ee3bc6d5461', tv: 0, pa: false });
  });
});
