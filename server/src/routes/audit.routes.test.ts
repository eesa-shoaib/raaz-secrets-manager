import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../middleware/authenticate.middleware.js', () => ({
    authenticate: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../middleware/require-project-role.middleware.js', () => ({
    requireProjectRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../middleware/require-project-status.middleware.js', () => ({
    requireProjectStatus: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../services/audit.service.js', () => ({ listProjectAuditEntries: vi.fn(async () => []) }));
import { errorHandler } from '../middleware/error.middleware.js';
import { listProjectAuditEntries } from '../services/audit.service.js';
import { auditRoutes } from './audit.routes.js';

describe('project audit route', () => {
    const app = express();
    app.use('/api/projects/:projectId/audit-log', auditRoutes);
    app.use(errorHandler);
    it('passes valid filters and a numeric limit to the service', async () => {
        const response = await request(app).get(
            '/api/projects/aaaaaaaaaaaaaaaaaaaaaaaa/audit-log?environment=production&limit=10',
        );
        expect(response.status).toBe(200);
        expect(listProjectAuditEntries).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaa', {
            environment: 'production',
            limit: 10,
        });
    });
    it('rejects unsupported filters and excessive limits', async () => {
        expect(
            (await request(app).get('/api/projects/aaaaaaaaaaaaaaaaaaaaaaaa/audit-log?page=2'))
                .status,
        ).toBe(422);
        expect(
            (await request(app).get('/api/projects/aaaaaaaaaaaaaaaaaaaaaaaa/audit-log?limit=101'))
                .status,
        ).toBe(422);
    });
});
