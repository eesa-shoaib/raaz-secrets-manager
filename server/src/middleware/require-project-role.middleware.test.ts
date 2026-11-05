import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/membership.service.js', () => ({ getUserRole: vi.fn() }));
vi.mock('../services/secrets.service.js', () => ({ getSecretAuditMetadata: vi.fn() }));
vi.mock('../services/audit.service.js', () => ({ writeDeniedAuditEntry: vi.fn() }));
import { writeDeniedAuditEntry } from '../services/audit.service.js';
import { getUserRole } from '../services/membership.service.js';
import { getSecretAuditMetadata } from '../services/secrets.service.js';
import { errorHandler } from './error.middleware.js';
import { requireProjectRole } from './require-project-role.middleware.js';

describe('secret authorization denial', () => {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = {
            id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            email: 'actor@example.com',
            isPlatformAdmin: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        next();
    });
    app.post(
        '/projects/:projectId/secrets/:secretId/reveal',
        requireProjectRole('projectAdmin', 'developer'),
        (_req, res) => res.sendStatus(200),
    );
    app.use(errorHandler);
    beforeEach(() => {
        vi.resetAllMocks();
    });
    const path = '/projects/bbbbbbbbbbbbbbbbbbbbbbbb/secrets/cccccccccccccccccccccccc/reveal';

    it('hides the project from a non-member without an audit entry', async () => {
        vi.mocked(getUserRole).mockResolvedValue(null);
        expect((await request(app).post(path)).status).toBe(404);
        expect(writeDeniedAuditEntry).not.toHaveBeenCalled();
    });
    it('records denied auditor reveal with project-scoped environment and key', async () => {
        vi.mocked(getUserRole).mockResolvedValue('auditor');
        vi.mocked(getSecretAuditMetadata).mockResolvedValue({
            _id: { toString: () => 'cccccccccccccccccccccccc' },
            key: 'API_KEY',
            environment: 'production',
        } as never);
        expect((await request(app).post(path)).status).toBe(403);
        expect(getSecretAuditMetadata).toHaveBeenCalledWith(
            'bbbbbbbbbbbbbbbbbbbbbbbb',
            'cccccccccccccccccccccccc',
        );
        expect(writeDeniedAuditEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'reveal',
                environment: 'production',
                secretKey: 'API_KEY',
            }),
        );
    });
    it('returns 500 if writing the denied audit entry fails', async () => {
        vi.mocked(getUserRole).mockResolvedValue('auditor');
        vi.mocked(getSecretAuditMetadata).mockResolvedValue(null);
        vi.mocked(writeDeniedAuditEntry).mockRejectedValue(new Error('audit unavailable'));
        expect((await request(app).post(path)).status).toBe(500);
    });
});
