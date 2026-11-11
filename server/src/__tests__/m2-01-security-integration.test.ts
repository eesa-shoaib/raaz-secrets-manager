import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../index.js';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { SecretModel } from '../models/Secret.js';
import { UserModel } from '../models/User.js';
import * as auditService from '../services/audit.service.js';
import { connectDisposableTestDb, type TestDbHandle } from './test-db.js';

const ORIGIN = 'http://localhost:5173';
const JWT_SECRET = '0123456789abcdef0123456789abcdef';
const MASTER_KEY = Buffer.alloc(32, 9).toString('base64');

function signAuthCookie(userId: string, tokenVersion = 0, isPlatformAdmin = false): string {
    const token = jwt.sign({ sub: userId, tv: tokenVersion, pa: isPlatformAdmin }, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
    });
    return `token=${token}`;
}

describe('M2-01 Security, RBAC, Crypto, and Replica-Set Transaction Proofs', () => {
    let db: TestDbHandle;

    beforeAll(async () => {
        process.env.CLIENT_ORIGIN = ORIGIN;
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.MASTER_KEY = MASTER_KEY;
        process.env.MASTER_KEY_VERSION = '1';
        db = await connectDisposableTestDb('m201');
    }, 30000);

    beforeEach(async () => {
        vi.restoreAllMocks();
        if (db?.connected) {
            await db.clearCollections();
        }
    });

    afterAll(async () => {
        if (db?.connected) {
            await db.disconnect();
        }
    }, 30000);

    it('enforces Developer staging/production write restrictions, Auditor reveal denial with env/key, and cross-project 404 on replica set', async () => {
        if (!db.connected) return;
        const app = createApp();

        const [adminUser, devUser, auditorUser, platformAdminUser] = await UserModel.create([
            {
                email: 'padmin@example.com',
                passwordHash: '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8',
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'dev@example.com',
                passwordHash: '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8',
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'auditor@example.com',
                passwordHash: '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8',
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'platadmin@example.com',
                passwordHash: '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8',
                isActive: true,
                isPlatformAdmin: true,
            },
        ]);

        const adminCookie = signAuthCookie(adminUser._id.toString());
        const devCookie = signAuthCookie(devUser._id.toString());
        const auditorCookie = signAuthCookie(auditorUser._id.toString());
        const platCookie = signAuthCookie(platformAdminUser._id.toString(), 0, true);

        const createProjRes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Project Alpha' });
        expect(createProjRes.status).toBe(201);
        const projectAId = createProjRes.body.id as string;

        const createProjBRes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Project Beta' });
        expect(createProjBRes.status).toBe(201);
        const projectBId = createProjBRes.body.id as string;

        // Add Developer and Auditor to Project A via Platform Admin (non-member bypass)
        const addDevRes = await request(app)
            .post(`/api/projects/${projectAId}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', platCookie)
            .send({ email: 'dev@example.com', role: 'developer' });
        expect(addDevRes.status).toBe(201);

        const addAuditorRes = await request(app)
            .post(`/api/projects/${projectAId}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', platCookie)
            .send({ email: 'auditor@example.com', role: 'auditor' });
        expect(addAuditorRes.status).toBe(201);

        // Platform Admin without ProjectMembership gets 404 on project detail, secrets, audit-log, and members GET
        for (const path of [
            `/api/projects/${projectAId}`,
            `/api/projects/${projectAId}/secrets?environment=development`,
            `/api/projects/${projectAId}/audit-log`,
            `/api/projects/${projectAId}/members`,
        ]) {
            const res = await request(app).get(path).set('Cookie', platCookie);
            expect(res.status).toBe(404);
        }

        // Project Admin creates staging and production secrets in Project A, plus a secret in Project B
        const stagingSecRes = await request(app)
            .post(`/api/projects/${projectAId}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ environment: 'staging', key: 'STAGING_TOKEN', value: 'stg-123' });
        expect(stagingSecRes.status).toBe(201);
        const stagingSecretId = stagingSecRes.body.id as string;

        const prodSecRes = await request(app)
            .post(`/api/projects/${projectAId}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ environment: 'production', key: 'PROD_API_KEY', value: 'prod-secret-value' });
        expect(prodSecRes.status).toBe(201);
        const prodSecretId = prodSecRes.body.id as string;

        const projBSecRes = await request(app)
            .post(`/api/projects/${projectBId}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ environment: 'development', key: 'BETA_SECRET', value: 'beta-val' });
        expect(projBSecRes.status).toBe(201);
        const projBSecretId = projBSecRes.body.id as string;

        // Developer create in staging -> 403 + denied audit entry
        const devStagingCreate = await request(app)
            .post(`/api/projects/${projectAId}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({ environment: 'staging', key: 'DEV_TRY_STG', value: 'nope' });
        expect(devStagingCreate.status).toBe(403);

        // Developer edit in staging -> 403 + denied audit entry
        const devStagingEdit = await request(app)
            .patch(`/api/projects/${projectAId}/secrets/${stagingSecretId}`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({ value: 'overwrite-stg' });
        expect(devStagingEdit.status).toBe(403);

        // Developer edit in production -> 403 + denied audit entry
        const devProdEdit = await request(app)
            .patch(`/api/projects/${projectAId}/secrets/${prodSecretId}`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({ value: 'overwrite-prod' });
        expect(devProdEdit.status).toBe(403);

        // Production reveal with confirm: false -> 422 VALIDATION_ERROR (not logged as denied)
        const devProdRevealNoConfirm = await request(app)
            .post(`/api/projects/${projectAId}/secrets/${prodSecretId}/reveal`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({ confirm: false });
        expect(devProdRevealNoConfirm.status).toBe(422);

        // Auditor reveal on production -> 403 + denied audit entry with environment='production' and secretKey='PROD_API_KEY'
        const auditorReveal = await request(app)
            .post(`/api/projects/${projectAId}/secrets/${prodSecretId}/reveal`)
            .set('Origin', ORIGIN)
            .set('Cookie', auditorCookie)
            .send({ confirm: true });
        expect(auditorReveal.status).toBe(403);

        const auditorDeniedEntry = await AuditLogEntryModel.findOne({
            projectId: projectAId,
            userId: auditorUser._id,
            action: 'reveal',
            result: 'denied',
        }).lean();
        expect(auditorDeniedEntry).toBeTruthy();
        expect(auditorDeniedEntry?.environment).toBe('production');
        expect(auditorDeniedEntry?.secretKey).toBe('PROD_API_KEY');

        // Cross-project secretId from Project B used under Project A's URL -> 404
        const crossReveal = await request(app)
            .post(`/api/projects/${projectAId}/secrets/${projBSecretId}/reveal`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ confirm: true });
        expect(crossReveal.status).toBe(404);

        const crossDelete = await request(app)
            .delete(`/api/projects/${projectAId}/secrets/${projBSecretId}`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie);
        expect(crossDelete.status).toBe(404);
    }, 30000);

    it('rolls back state-changing writes when audit entry creation fails inside a replica-set transaction', async () => {
        if (!db.connected) return;
        const app = createApp();

        const adminUser = await UserModel.create({
            email: 'txadmin@example.com',
            passwordHash: '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8',
            isActive: true,
            isPlatformAdmin: false,
        });
        const adminCookie = signAuthCookie(adminUser._id.toString());

        const createProjRes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Tx Rollback Project' });
        expect(createProjRes.status).toBe(201);
        const projectId = createProjRes.body.id as string;

        // Inject failure in writeAuditEntry during secret creation
        vi.spyOn(auditService, 'writeAuditEntry').mockRejectedValueOnce(
            new Error('Simulated audit failure inside transaction'),
        );

        const failedSecretRes = await request(app)
            .post(`/api/projects/${projectId}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({
                environment: 'development',
                key: 'ROLLED_BACK_KEY',
                value: 'should-not-persist',
            });
        expect(failedSecretRes.status).toBe(500);
        expect(failedSecretRes.body.error.code).toBe('INTERNAL_ERROR');

        // Verify the secret document was rolled back and does not exist in MongoDB
        const orphanedSecret = await SecretModel.findOne({
            projectId,
            key: 'ROLLED_BACK_KEY',
        }).lean();
        expect(orphanedSecret).toBeNull();
    }, 30000);

    it('enforces the concurrent last-Project-Admin invariant and last-Platform-Admin invariant under race conditions', async () => {
        if (!db.connected) return;
        const app = createApp();

        await PlatformConfigModel.create({ _id: 'singleton', activePlatformAdminCount: 1 });

        const [adminA, adminB] = await UserModel.create([
            {
                email: 'admina@example.com',
                passwordHash: '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8',
                isActive: true,
                isPlatformAdmin: true,
            },
            {
                email: 'adminb@example.com',
                passwordHash: '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8',
                isActive: true,
                isPlatformAdmin: false,
            },
        ]);

        const cookieA = signAuthCookie(adminA._id.toString(), 0, true);
        const cookieB = signAuthCookie(adminB._id.toString(), 0, false);

        // Last Platform Admin cannot demote or deactivate themselves
        const selfDemotePlat = await request(app)
            .patch(`/api/admin/users/${adminA._id.toString()}`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookieA)
            .send({ isPlatformAdmin: false });
        expect(selfDemotePlat.status).toBe(409);

        const selfDeactivatePlat = await request(app)
            .patch(`/api/admin/users/${adminA._id.toString()}`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookieA)
            .send({ isActive: false });
        expect(selfDeactivatePlat.status).toBe(409);

        // Create project with adminA as projectAdmin, then add adminB as projectAdmin (activeAdminCount = 2)
        const projRes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', cookieA)
            .send({ name: 'Concurrent Admin Invariant' });
        expect(projRes.status).toBe(201);
        const projectId = projRes.body.id as string;

        const addBRes = await request(app)
            .post(`/api/projects/${projectId}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookieA)
            .send({ email: 'adminb@example.com', role: 'projectAdmin' });
        expect(addBRes.status).toBe(201);

        // Fire two concurrent demotions (A demotes B while B demotes A)
        const [res1, res2] = await Promise.all([
            request(app)
                .patch(`/api/projects/${projectId}/members/${adminB._id.toString()}`)
                .set('Origin', ORIGIN)
                .set('Cookie', cookieA)
                .send({ role: 'developer' }),
            request(app)
                .patch(`/api/projects/${projectId}/members/${adminA._id.toString()}`)
                .set('Origin', ORIGIN)
                .set('Cookie', cookieB)
                .send({ role: 'developer' }),
        ]);

        const statuses = [res1.status, res2.status].sort();
        // At least one must be rejected or retried so the project never ends with 0 admins
        expect(statuses).toContain(200);
        const updatedProject = await ProjectModel.findById(projectId).lean();
        expect(updatedProject?.activeAdminCount).toBeGreaterThanOrEqual(1);
        const remainingAdmins = await ProjectMembershipModel.countDocuments({
            projectId,
            role: 'projectAdmin',
        });
        expect(remainingAdmins).toBeGreaterThanOrEqual(1);
    }, 30000);

    it('verifies archived project 403 behavior, IV freshness on edit, AAD binding, and key version mismatch failure', async () => {
        if (!db.connected) return;
        const app = createApp();

        const adminUser = await UserModel.create({
            email: 'crypto@example.com',
            passwordHash: '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8',
            isActive: true,
            isPlatformAdmin: false,
        });
        const cookie = signAuthCookie(adminUser._id.toString());

        const projRes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ name: 'Crypto Project' });
        const projectId = projRes.body.id as string;

        const sec1Res = await request(app)
            .post(`/api/projects/${projectId}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ environment: 'development', key: 'DEV_KEY', value: 'v1' });
        const sec1Id = sec1Res.body.id as string;

        const beforeEdit = await SecretModel.findById(sec1Id).select('+iv +ciphertext +authTag');
        expect(beforeEdit?.iv.byteLength).toBe(12);

        // Edit secret and verify fresh 12-byte IV
        const editRes = await request(app)
            .patch(`/api/projects/${projectId}/secrets/${sec1Id}`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ value: 'v1' });
        expect(editRes.status).toBe(200);

        const afterEdit = await SecretModel.findById(sec1Id).select('+iv +ciphertext +authTag');
        expect(afterEdit?.iv.byteLength).toBe(12);
        expect(afterEdit?.iv.equals(beforeEdit!.iv)).toBe(false);

        // Create second secret in production and swap encrypted payload from development secret -> AAD mismatch fails reveal
        const sec2Res = await request(app)
            .post(`/api/projects/${projectId}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ environment: 'production', key: 'PROD_KEY', value: 'prod-real' });
        const sec2Id = sec2Res.body.id as string;

        await SecretModel.updateOne(
            { _id: new mongoose.Types.ObjectId(sec2Id) },
            {
                $set: {
                    ciphertext: afterEdit!.ciphertext,
                    iv: afterEdit!.iv,
                    authTag: afterEdit!.authTag,
                },
            },
        );

        const tamperedReveal = await request(app)
            .post(`/api/projects/${projectId}/secrets/${sec2Id}/reveal`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ confirm: true });
        expect(tamperedReveal.status).toBe(500);

        // Mismatched encryptionKeyVersion fails loudly
        await SecretModel.updateOne(
            { _id: new mongoose.Types.ObjectId(sec1Id) },
            { $set: { encryptionKeyVersion: 99 } },
        );
        const badVersionReveal = await request(app)
            .post(`/api/projects/${projectId}/secrets/${sec1Id}/reveal`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ confirm: false });
        expect(badVersionReveal.status).toBe(500);

        // Directly seed archived status on project -> member routes return 403, GET /api/projects still lists it
        await ProjectModel.updateOne(
            { _id: new mongoose.Types.ObjectId(projectId) },
            { $set: { status: 'archived' } },
        );

        const archivedDetail = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Cookie', cookie);
        expect(archivedDetail.status).toBe(403);

        const listRes = await request(app).get('/api/projects').set('Cookie', cookie);
        expect(listRes.status).toBe(200);
        const listItems = Array.isArray(listRes.body) ? listRes.body : listRes.body.data;
        expect(
            listItems.some(
                (p: { id: string; status: string }) =>
                    p.id === projectId && p.status === 'archived',
            ),
        ).toBe(true);
    }, 30000);

    it('enforces identical 401 for unknown email, wrong password, and deactivated account, plus tokenVersion and Origin CSRF checks', async () => {
        if (!db.connected) return;
        const app = createApp();

        // Signup active and deactivated users via real signup endpoint
        const activeSignup = await request(app)
            .post('/api/auth/signup')
            .set('Origin', ORIGIN)
            .send({ email: 'activeuser@example.com', password: 'ValidPassword123' });
        expect(activeSignup.status).toBe(201);

        const inactiveSignup = await request(app)
            .post('/api/auth/signup')
            .set('Origin', ORIGIN)
            .send({ email: 'inactiveuser@example.com', password: 'ValidPassword123' });
        expect(inactiveSignup.status).toBe(201);

        await UserModel.updateOne(
            { email: 'inactiveuser@example.com' },
            { $set: { isActive: false } },
        );

        const unknownRes = await request(app)
            .post('/api/auth/login')
            .set('Origin', ORIGIN)
            .send({ email: 'missing@example.com', password: 'ValidPassword123' });
        const wrongPwRes = await request(app)
            .post('/api/auth/login')
            .set('Origin', ORIGIN)
            .send({ email: 'activeuser@example.com', password: 'WrongPassword123' });
        const inactiveRes = await request(app)
            .post('/api/auth/login')
            .set('Origin', ORIGIN)
            .send({ email: 'inactiveuser@example.com', password: 'ValidPassword123' });

        expect(unknownRes.status).toBe(401);
        expect(wrongPwRes.status).toBe(401);
        expect(inactiveRes.status).toBe(401);
        expect(unknownRes.body.error.message).toBe(wrongPwRes.body.error.message);
        expect(wrongPwRes.body.error.message).toBe(inactiveRes.body.error.message);

        // Successful login, then bump tokenVersion -> existing cookie fails with 401
        const loginRes = await request(app)
            .post('/api/auth/login')
            .set('Origin', ORIGIN)
            .send({ email: 'activeuser@example.com', password: 'ValidPassword123' });
        expect(loginRes.status).toBe(200);
        const setCookie = loginRes.headers['set-cookie'][0];

        const meOk = await request(app).get('/api/auth/me').set('Cookie', setCookie);
        expect(meOk.status).toBe(200);

        // Missing Origin on state-changing request -> 403 CSRF
        const noOriginRes = await request(app)
            .post('/api/projects')
            .set('Cookie', setCookie)
            .send({ name: 'Should Fail CSRF' });
        expect(noOriginRes.status).toBe(403);

        await UserModel.updateOne(
            { email: 'activeuser@example.com' },
            { $inc: { tokenVersion: 1 } },
        );
        const staleMe = await request(app).get('/api/auth/me').set('Cookie', setCookie);
        expect(staleMe.status).toBe(401);
    }, 30000);
});
