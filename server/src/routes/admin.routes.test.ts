import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../middleware/authenticate.middleware.js', () => ({
    authenticate: (req: Request, _res: Response, next: NextFunction) => {
        req.user = {
            id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            email: 'user@example.com',
            isPlatformAdmin: req.get('x-admin') === 'yes',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        next();
    },
}));
vi.mock('../services/admin.service.js', () => ({
    listUsers: vi.fn(async (page: number, limit: number) => ({ data: [], page, limit, total: 0 })),
    listUsersCursor: vi.fn(async (_cursor: string | undefined, limit: number) => ({
        data: [],
        nextCursor: null,
        hasMore: false,
        limit,
    })),
    updateUser: vi.fn(async () => ({ id: 'bbbbbbbbbbbbbbbbbbbbbbbb' })),
}));
vi.mock('../services/audit.service.js', () => ({
    listPlatformAuditEntriesCursor: vi.fn(async (q: { limit?: number }) => ({
        data: [],
        nextCursor: null,
        hasMore: false,
        limit: q.limit ?? 25,
    })),
}));
import { errorHandler } from '../middleware/error.middleware.js';
import { adminRoutes } from './admin.routes.js';

describe('platform admin routes', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use(errorHandler);
    it('rejects non-admins before exposing user data', async () => {
        expect((await request(app).get('/api/admin/users')).status).toBe(403);
        expect((await request(app).get('/api/admin/audit-log')).status).toBe(403);
    });
    it('validates pagination', async () => {
        expect(
            (await request(app).get('/api/admin/users?limit=101').set('x-admin', 'yes')).status,
        ).toBe(422);
        expect(
            (await request(app).get('/api/admin/users?page=2&limit=10').set('x-admin', 'yes')).body,
        ).toEqual({ data: [], page: 2, limit: 10, total: 0 });
    });
    it('rejects invalid user IDs and empty updates', async () => {
        expect(
            (
                await request(app)
                    .patch('/api/admin/users/invalid')
                    .set('x-admin', 'yes')
                    .send({ isActive: false })
            ).status,
        ).toBe(422);
        expect(
            (
                await request(app)
                    .patch('/api/admin/users/bbbbbbbbbbbbbbbbbbbbbbbb')
                    .set('x-admin', 'yes')
                    .send({})
            ).status,
        ).toBe(422);
    });
});
