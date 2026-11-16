import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { ProjectModel } from '../models/Project.js';
import { UserModel } from '../models/User.js';
import { connectDisposableTestDb, type TestDbHandle } from './test-db.js';

const ORIGIN = 'http://localhost:5173';
const JWT_SECRET = '0123456789abcdef0123456789abcdef';
const MASTER_KEY = Buffer.alloc(32, 9).toString('base64');
const DUMMY_HASH = '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8';

function signAuthCookie(userId: string, tokenVersion = 0, isPlatformAdmin = false): string {
    const token = jwt.sign({ sub: userId, tv: tokenVersion, pa: isPlatformAdmin }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
    });
    return `token=${token}`;
}

describe('GET /api/projects/:projectId/audit-log/export', () => {
    let db: TestDbHandle;

    beforeAll(async () => {
        process.env.CLIENT_ORIGIN = ORIGIN;
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.MASTER_KEY = MASTER_KEY;
        process.env.MASTER_KEY_VERSION = '1';
        db = await connectDisposableTestDb('auditexp');
        if (db.connected) {
            createApp();
            await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
        }
    }, 30000);

    beforeEach(async () => {
        if (db?.connected) {
            await db.clearCollections();
        }
    });

    afterAll(async () => {
        if (db?.connected) {
            await db.disconnect();
        }
    }, 30000);

    it('exports filtered CSV (with formula neutralization) and JSON for projectAdmin and auditor, and enforces RBAC/isolation', async () => {
        if (!db.connected) return;
        const app = createApp();

        const [admin, dev, auditor, outsider] = await UserModel.create([
            {
                email: 'audit_admin@example.com',
                username: 'audit_admin',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'audit_dev@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'audit_auditor@example.com',
                username: 'sec_auditor',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'audit_pa@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: true,
            },
        ]);

        const adminCookie = signAuthCookie(admin._id.toString());
        const devCookie = signAuthCookie(dev._id.toString());
        const auditorCookie = signAuthCookie(auditor._id.toString());
        const outsiderCookie = signAuthCookie(outsider._id.toString(), 0, true);

        const projARes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Audit Export Project' })
            .expect(201);
        const projA = projARes.body.id as string;

        const projBRes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Other Project' })
            .expect(201);
        const projB = projBRes.body.id as string;

        await request(app)
            .post(`/api/projects/${projA}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ email: dev.email, role: 'developer' })
            .expect(201);
        await request(app)
            .post(`/api/projects/${projA}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ email: auditor.email, role: 'auditor' })
            .expect(201);

        // Create secrets & denied attempt so we have rich audit records + formula-injection test record
        await request(app)
            .post(`/api/projects/${projA}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ key: 'PROD_API_KEY', environment: 'production', value: 'prod-secret-val' })
            .expect(201);

        await request(app)
            .post(`/api/projects/${projB}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ key: 'PROJ_B_SECRET', environment: 'production', value: 'b-val' })
            .expect(201);

        // Seed an audit entry with a formula-like secretKey to verify CSV neutralization end-to-end
        await AuditLogEntryModel.create({
            userId: admin._id,
            projectId: new mongoose.Types.ObjectId(projA),
            secretKey: '=HYPERLINK("http://evil.example")',
            environment: 'production',
            action: 'reveal',
            result: 'denied',
        });

        // Project Admin exports CSV filtered by environment=production&result=denied
        const adminCsv = await request(app)
            .get(
                `/api/projects/${projA}/audit-log/export?format=csv&environment=production&result=denied`,
            )
            .set('Cookie', adminCookie);
        expect(adminCsv.status).toBe(200);
        expect(adminCsv.headers['content-type']).toContain('text/csv');
        expect(adminCsv.headers['content-disposition']).toContain(`audit-log-${projA}.csv`);
        expect(adminCsv.headers['cache-control']).toContain('no-store');
        expect(adminCsv.text).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
        expect(adminCsv.text).not.toContain('PROD_API_KEY');
        expect(adminCsv.text).not.toContain('PROJ_B_SECRET');
        expect(adminCsv.text).not.toContain('prod-secret-val');

        // Auditor exports JSON filtered by environment=production
        const auditorJson = await request(app)
            .get(`/api/projects/${projA}/audit-log/export?format=json&environment=production`)
            .set('Cookie', auditorCookie);
        expect(auditorJson.status).toBe(200);
        expect(auditorJson.headers['content-type']).toContain('application/json');
        expect(auditorJson.headers['content-disposition']).toContain(`audit-log-${projA}.json`);
        const parsed = JSON.parse(auditorJson.text) as {
            projectId: string;
            count: number;
            entries: Array<{ action: string; result: string; secretKey?: string }>;
        };
        expect(parsed.projectId).toBe(projA);
        expect(parsed.count).toBe(2);
        expect(parsed.entries.map((e) => e.action).sort()).toEqual(['create', 'reveal']);
        expect(auditorJson.text).not.toContain('PROJ_B_SECRET');

        // Developer is forbidden (403)
        await request(app)
            .get(`/api/projects/${projA}/audit-log/export?format=csv`)
            .set('Cookie', devCookie)
            .expect(403);

        // Non-member Platform Admin gets 404
        await request(app)
            .get(`/api/projects/${projA}/audit-log/export?format=json`)
            .set('Cookie', outsiderCookie)
            .expect(404);

        // Invalid or missing format -> 422
        await request(app)
            .get(`/api/projects/${projA}/audit-log/export`)
            .set('Cookie', adminCookie)
            .expect(422);
        await request(app)
            .get(`/api/projects/${projA}/audit-log/export?format=xml`)
            .set('Cookie', adminCookie)
            .expect(422);

        // Archived project -> 403 for members, 404 for non-member
        await ProjectModel.updateOne({ _id: projA }, { $set: { status: 'archived' } });
        await request(app)
            .get(`/api/projects/${projA}/audit-log/export?format=csv`)
            .set('Cookie', auditorCookie)
            .expect(403);
        await request(app)
            .get(`/api/projects/${projA}/audit-log/export?format=csv`)
            .set('Cookie', outsiderCookie)
            .expect(404);
    }, 25000);
});
