import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../index.js';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { ProjectModel } from '../models/Project.js';
import { SecretModel } from '../models/Secret.js';
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

describe('.env Import & Decrypted Export Security Integration', () => {
    let db: TestDbHandle;

    beforeAll(async () => {
        process.env.CLIENT_ORIGIN = ORIGIN;
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.MASTER_KEY = MASTER_KEY;
        process.env.MASTER_KEY_VERSION = '1';
        db = await connectDisposableTestDb('envio');
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

    it('enforces RBAC, AAD/IV encryption, skip_existing/overwrite modes, and transactional audit on import and export', async () => {
        if (!db.connected) return;
        const app = createApp();

        const [admin, dev, auditor, outsider] = await UserModel.create([
            {
                email: 'io_admin@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'io_dev@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'io_auditor@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'io_outsider@example.com',
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
            .send({ name: 'Vault Core' })
            .expect(201);
        const projA = projARes.body.id as string;

        const projBRes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Isolated App' })
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

        // Missing Origin fails CSRF with 403
        await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [{ key: 'API_KEY', value: 'v1' }],
            })
            .expect(403);

        // Validation error never leaks submitted secret values
        const badImport = await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [{ key: 'bad-key', value: 'TOP_SECRET_PLAIN_123' }],
            });
        expect(badImport.status).toBe(422);
        expect(JSON.stringify(badImport.body)).not.toContain('TOP_SECRET_PLAIN_123');

        // Duplicate keys in same import batch -> 422
        await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                mode: 'overwrite',
                entries: [
                    { key: 'DUP_KEY', value: 'a' },
                    { key: 'DUP_KEY', value: 'b' },
                ],
            })
            .expect(422);

        // Developer imports into development -> 200
        const devImport = await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [
                    { key: 'DB_URL', value: 'postgres://localhost/db' },
                    { key: 'GREETING', value: 'hello world #dev' },
                ],
            });
        expect(devImport.status).toBe(200);
        expect(devImport.body).toEqual({ created: 2, updated: 0, skipped: 0, total: 2 });

        const originalDbSecret = await SecretModel.findOne({ projectId: projA, key: 'DB_URL' })
            .select('+iv +ciphertext +authTag')
            .exec();
        expect(originalDbSecret?.iv.length).toBe(12);

        // skip_existing skips DB_URL and creates NEW_KEY
        const skipImport = await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [
                    { key: 'DB_URL', value: 'should-not-overwrite' },
                    { key: 'NEW_KEY', value: 'fresh-value' },
                ],
            });
        expect(skipImport.status).toBe(200);
        expect(skipImport.body).toEqual({ created: 1, updated: 0, skipped: 1, total: 2 });

        // overwrite updates DB_URL with a fresh IV and writes an edit audit entry
        const overwriteImport = await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                mode: 'overwrite',
                entries: [{ key: 'DB_URL', value: 'postgres://updated/db' }],
            });
        expect(overwriteImport.status).toBe(200);
        expect(overwriteImport.body).toEqual({ created: 0, updated: 1, skipped: 0, total: 1 });

        const updatedDbSecret = await SecretModel.findOne({ projectId: projA, key: 'DB_URL' })
            .select('+iv')
            .exec();
        expect(updatedDbSecret?.iv.equals(originalDbSecret!.iv)).toBe(false);

        // Developer importing into staging/production -> 403 + denied audit with environment
        await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({
                environment: 'staging',
                mode: 'skip_existing',
                entries: [{ key: 'STAGE_KEY', value: 'nope' }],
            })
            .expect(403);

        await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({
                environment: 'production',
                mode: 'skip_existing',
                entries: [{ key: 'PROD_KEY', value: 'nope' }],
            })
            .expect(403);

        // Auditor importing -> 403 + denied create audit entry
        await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', auditorCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [{ key: 'AUD_KEY', value: 'nope' }],
            })
            .expect(403);

        // Non-member Platform Admin -> 404 (no audit entry)
        const outsiderAuditBefore = await AuditLogEntryModel.countDocuments({
            userId: outsider._id,
        });
        await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', outsiderCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [{ key: 'NOPE', value: '1' }],
            })
            .expect(404);
        expect(await AuditLogEntryModel.countDocuments({ userId: outsider._id })).toBe(
            outsiderAuditBefore,
        );

        // Admin imports into production and projB to test export & isolation
        await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'production',
                mode: 'skip_existing',
                entries: [{ key: 'PROD_STRIPE_KEY', value: 'sk_live_abc123' }],
            })
            .expect(200);

        await request(app)
            .post(`/api/projects/${projB}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [{ key: 'OTHER_PROJECT_SECRET', value: 'isolated-val' }],
            })
            .expect(200);

        // Export development as developer -> 200 with Cache-Control: no-store, updated lastAccessedAt, reveal audits
        const devExport = await request(app)
            .post(`/api/projects/${projA}/secrets/export`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({ environment: 'development', confirm: false });
        expect(devExport.status).toBe(200);
        expect(devExport.headers['cache-control']).toContain('no-store');
        expect(devExport.body.filename).toBe('.env.development');
        expect(devExport.body.count).toBe(3);
        expect(devExport.body.content).toContain('DB_URL=postgres://updated/db');
        expect(devExport.body.content).toContain('GREETING="hello world #dev"');
        expect(devExport.body.content).toContain('NEW_KEY=fresh-value');
        expect(devExport.body.content).not.toContain('OTHER_PROJECT_SECRET');
        expect(devExport.body.content).not.toContain('PROD_STRIPE_KEY');

        const touchedSecret = await SecretModel.findOne({ projectId: projA, key: 'DB_URL' }).lean();
        expect(touchedSecret?.lastAccessedAt).toBeTruthy();
        expect(touchedSecret?.lastAccessedBy?.toString()).toBe(dev._id.toString());

        // Production export without confirm: true -> 422 and NOT logged as denied
        const deniedBeforeProd422 = await AuditLogEntryModel.countDocuments({
            projectId: projA,
            action: 'reveal',
            result: 'denied',
        });
        await request(app)
            .post(`/api/projects/${projA}/secrets/export`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({ environment: 'production', confirm: false })
            .expect(422);
        expect(
            await AuditLogEntryModel.countDocuments({
                projectId: projA,
                action: 'reveal',
                result: 'denied',
            }),
        ).toBe(deniedBeforeProd422);

        // Production export with confirm: true -> 200
        const prodExport = await request(app)
            .post(`/api/projects/${projA}/secrets/export`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({ environment: 'production', confirm: true });
        expect(prodExport.status).toBe(200);
        expect(prodExport.body.content).toContain('PROD_STRIPE_KEY=sk_live_abc123');

        // Auditor export -> 403 + denied reveal audit entry with environment populated
        await request(app)
            .post(`/api/projects/${projA}/secrets/export`)
            .set('Origin', ORIGIN)
            .set('Cookie', auditorCookie)
            .send({ environment: 'production', confirm: true })
            .expect(403);

        // Non-member export -> 404
        await request(app)
            .post(`/api/projects/${projA}/secrets/export`)
            .set('Origin', ORIGIN)
            .set('Cookie', outsiderCookie)
            .send({ environment: 'development', confirm: false })
            .expect(404);

        // Verify all expected audit entries
        const audits = await AuditLogEntryModel.find({ projectId: projA }).lean();
        expect(
            audits.some(
                (a) =>
                    a.userId.toString() === dev._id.toString() &&
                    a.action === 'create' &&
                    a.environment === 'staging' &&
                    a.result === 'denied',
            ),
        ).toBe(true);
        expect(
            audits.some(
                (a) =>
                    a.userId.toString() === dev._id.toString() &&
                    a.action === 'create' &&
                    a.environment === 'production' &&
                    a.result === 'denied',
            ),
        ).toBe(true);
        expect(
            audits.some(
                (a) =>
                    a.userId.toString() === auditor._id.toString() &&
                    a.action === 'create' &&
                    a.environment === 'development' &&
                    a.result === 'denied',
            ),
        ).toBe(true);
        expect(
            audits.some(
                (a) =>
                    a.userId.toString() === auditor._id.toString() &&
                    a.action === 'reveal' &&
                    a.environment === 'production' &&
                    a.result === 'denied',
            ),
        ).toBe(true);
        expect(
            audits.some(
                (a) =>
                    a.userId.toString() === admin._id.toString() &&
                    a.action === 'edit' &&
                    a.secretKey === 'DB_URL' &&
                    a.result === 'allowed',
            ),
        ).toBe(true);
        expect(
            audits.some(
                (a) =>
                    a.userId.toString() === dev._id.toString() &&
                    a.action === 'reveal' &&
                    a.secretKey === 'PROD_STRIPE_KEY' &&
                    a.environment === 'production' &&
                    a.result === 'allowed',
            ),
        ).toBe(true);

        // Archived project rejects both import and export with 403
        await ProjectModel.updateOne({ _id: projA }, { $set: { status: 'archived' } });
        await request(app)
            .post(`/api/projects/${projA}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [{ key: 'ARCHIVED_KEY', value: '1' }],
            })
            .expect(403);
        await request(app)
            .post(`/api/projects/${projA}/secrets/export`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ environment: 'development', confirm: false })
            .expect(403);
    }, 30000);

    it('rolls back entire import and export transactions when an audit write fails', async () => {
        if (!db.connected) return;
        const app = createApp();

        const [admin] = await UserModel.create([
            {
                email: 'rollback_admin@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
        ]);
        const adminCookie = signAuthCookie(admin._id.toString());

        const projRes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Rollback Guard' })
            .expect(201);
        const projectId = projRes.body.id as string;

        // Fail audit write on the 2nd entry during a 2-secret import -> neither secret may persist
        let saveCount = 0;
        const originalSave = AuditLogEntryModel.prototype.save;
        const importSpy = vi
            .spyOn(AuditLogEntryModel.prototype, 'save')
            .mockImplementation(async function (this: unknown, ...args: unknown[]) {
                saveCount += 1;
                if (saveCount === 2) {
                    throw new Error('Simulated audit failure on second entry');
                }
                return originalSave.apply(this, args as Parameters<typeof originalSave>);
            });

        const failedImport = await request(app)
            .post(`/api/projects/${projectId}/secrets/import`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                mode: 'skip_existing',
                entries: [
                    { key: 'ROLLBACK_ONE', value: 'one' },
                    { key: 'ROLLBACK_TWO', value: 'two' },
                ],
            });
        importSpy.mockRestore();

        expect(failedImport.status).toBe(500);
        expect(await SecretModel.countDocuments({ projectId })).toBe(0);

        // Create one real secret so we can verify export transaction rollback as well
        await request(app)
            .post(`/api/projects/${projectId}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ key: 'PERSISTED_KEY', environment: 'development', value: 'keep-safe' })
            .expect(201);

        const exportSpy = vi
            .spyOn(AuditLogEntryModel.prototype, 'save')
            .mockRejectedValueOnce(new Error('Simulated export audit failure'));

        const failedExport = await request(app)
            .post(`/api/projects/${projectId}/secrets/export`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ environment: 'development', confirm: false });
        exportSpy.mockRestore();

        expect(failedExport.status).toBe(500);
        const secretAfterFailedExport = await SecretModel.findOne({
            projectId,
            key: 'PERSISTED_KEY',
        }).lean();
        expect(secretAfterFailedExport?.lastAccessedAt).toBeNull();
    }, 25000);
});
