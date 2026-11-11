import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { UserModel } from '../models/User.js';
import { connectDisposableTestDb, type TestDbHandle } from './test-db.js';

const ORIGIN = 'http://localhost:5173';
const JWT_SECRET = '0123456789abcdef0123456789abcdef';
const MASTER_KEY = Buffer.alloc(32, 9).toString('base64');
const DUMMY_HASH = '$2a$12$abcdefghijklmnopqrstuu5c8r8B9f8f8f8f8f8f8f8f8f8f8f8f8';

function signAuthCookie(userId: string, tokenVersion = 0, isPlatformAdmin = false): string {
    const token = jwt.sign(
        { sub: userId, tv: tokenVersion, pa: isPlatformAdmin },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' },
    );
    return `token=${token}`;
}

describe('M2-04, M2-08, M2-09: Project Details, Literal Search, and Cursor Pagination', () => {
    let db: TestDbHandle;

    beforeAll(async () => {
        process.env.CLIENT_ORIGIN = ORIGIN;
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.MASTER_KEY = MASTER_KEY;
        process.env.MASTER_KEY_VERSION = '1';
        db = await connectDisposableTestDb('m204');
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

    it('supports project description, derived memberCount including deactivated users, and audited PATCH updates', async () => {
        if (!db.connected) return;
        const app = createApp();

        const [admin, dev, deactivatedUser, outsider] = await UserModel.create([
            { email: 'admin@example.com', username: 'admin_one', hasAvatar: true, avatarUpdatedAt: new Date('2026-11-01T00:00:00Z'), passwordHash: DUMMY_HASH, isActive: true, isPlatformAdmin: false },
            { email: 'dev@example.com', username: 'dev_two', hasAvatar: false, passwordHash: DUMMY_HASH, isActive: true, isPlatformAdmin: false },
            { email: 'deact@example.com', username: 'deact_user', passwordHash: DUMMY_HASH, isActive: false, isPlatformAdmin: false },
            { email: 'outsider@example.com', passwordHash: DUMMY_HASH, isActive: true, isPlatformAdmin: false },
        ]);

        const adminCookie = signAuthCookie(admin._id.toString());
        const devCookie = signAuthCookie(dev._id.toString());
        const outsiderCookie = signAuthCookie(outsider._id.toString());

        const createWithDesc = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Core API', description: 'Production backend secrets' });
        expect(createWithDesc.status).toBe(201);
        expect(createWithDesc.body.description).toBe('Production backend secrets');
        expect(createWithDesc.body.memberCount).toBe(1);
        const projectId = createWithDesc.body.id as string;

        const createDefault = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Minimal Project' });
        expect(createDefault.status).toBe(201);
        expect(createDefault.body.description).toBe('');
        expect(createDefault.body.memberCount).toBe(1);

        // Add active dev + deactivated user -> memberCount becomes 3
        await request(app)
            .post(`/api/projects/${projectId}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ email: 'dev@example.com', role: 'developer' })
            .expect(201);
        await request(app)
            .post(`/api/projects/${projectId}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ email: 'deact@example.com', role: 'auditor' })
            .expect(201);

        const projectDetailRes = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Cookie', adminCookie);
        expect(projectDetailRes.status).toBe(200);
        expect(projectDetailRes.body.memberCount).toBe(3);

        // Empty PATCH body -> 422
        const emptyPatch = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({});
        expect(emptyPatch.status).toBe(422);

        // Rename only -> 200 + project_renamed audit
        const renameRes = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Core API v2' });
        expect(renameRes.status).toBe(200);
        expect(renameRes.body.name).toBe('Core API v2');
        expect(renameRes.body.description).toBe('Production backend secrets');
        expect(renameRes.body.memberCount).toBe(3);

        // Update description -> 200 + project_updated audit
        const descRes = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ description: 'Updated description text' });
        expect(descRes.status).toBe(200);
        expect(descRes.body.description).toBe('Updated description text');

        // Developer forbidden -> 403 + denied audit entry
        const devPatch = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Origin', ORIGIN)
            .set('Cookie', devCookie)
            .send({ name: 'Hacked' });
        expect(devPatch.status).toBe(403);

        // Outsider non-member -> 404 + no audit entry
        const outsiderAuditBefore = await AuditLogEntryModel.countDocuments({ userId: outsider._id });
        const outsiderPatch = await request(app)
            .patch(`/api/projects/${projectId}`)
            .set('Origin', ORIGIN)
            .set('Cookie', outsiderCookie)
            .send({ name: 'Hacked' });
        expect(outsiderPatch.status).toBe(404);
        const outsiderAuditAfter = await AuditLogEntryModel.countDocuments({ userId: outsider._id });
        expect(outsiderAuditAfter).toBe(outsiderAuditBefore);

        const audits = await AuditLogEntryModel.find({ projectId }).sort({ createdAt: 1 }).lean();
        expect(audits.some((a) => a.action === 'project_renamed' && a.result === 'allowed')).toBe(true);
        expect(audits.some((a) => a.action === 'project_updated' && a.result === 'allowed')).toBe(true);
        expect(
            audits.some(
                (a) =>
                    (a.action === 'project_renamed' || a.action === 'project_updated') &&
                    a.result === 'denied' &&
                    a.userId.toString() === dev._id.toString(),
            ),
        ).toBe(true);

        // Remove deactivated user -> memberCount drops to 2
        await request(app)
            .delete(`/api/projects/${projectId}/members/${deactivatedUser._id.toString()}`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .expect(200);
        const afterRemoveRes = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Cookie', adminCookie);
        expect(afterRemoveRes.body.memberCount).toBe(2);
    }, 25000);

    it('treats regex metacharacters as literals in project and secret search', async () => {
        if (!db.connected) return;
        const app = createApp();

        const [admin] = await UserModel.create([
            { email: 'searchadmin@example.com', passwordHash: DUMMY_HASH, isActive: true, isPlatformAdmin: false },
        ]);
        const cookie = signAuthCookie(admin._id.toString());

        const p1 = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ name: 'Auth.*Service', description: 'Handles OAuth2.*flows' });
        const p2 = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ name: 'Billing (Prod)', description: 'Stripe keys' });
        await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ name: 'Analytics', description: 'Reporting pipeline' });

        // Literal ".*" should only match Auth.*Service, not all projects
        const regexRes = await request(app)
            .get('/api/projects?mode=cursor&search=.*')
            .set('Cookie', cookie);
        expect(regexRes.status).toBe(200);
        expect(regexRes.body.data.map((p: { name: string }) => p.name)).toEqual(['Auth.*Service']);

        // Unbalanced/parenthesis characters "(prod)" should work safely case-insensitively
        const parenRes = await request(app)
            .get(`/api/projects?mode=cursor&search=${encodeURIComponent('(prod)')}`)
            .set('Cookie', cookie);
        expect(parenRes.status).toBe(200);
        expect(parenRes.body.data.map((p: { name: string }) => p.name)).toEqual(['Billing (Prod)']);

        const projId = p1.body.id as string;
        for (const key of ['STRIPE_KEY_V1', 'DB_URL_PROD', 'APP_DB_PASS']) {
            await request(app)
                .post(`/api/projects/${projId}/secrets`)
                .set('Origin', ORIGIN)
                .set('Cookie', cookie)
                .send({ key, environment: 'development', value: `val_${key}` })
                .expect(201);
        }

        const secretLiteralStar = await request(app)
            .get(`/api/projects/${projId}/secrets?environment=development&mode=cursor&search=.*`)
            .set('Cookie', cookie);
        expect(secretLiteralStar.status).toBe(200);
        expect(secretLiteralStar.body.data).toEqual([]);

        const secretDb = await request(app)
            .get(`/api/projects/${projId}/secrets?environment=development&mode=cursor&search=db`)
            .set('Cookie', cookie);
        expect(secretDb.status).toBe(200);
        expect(secretDb.body.data.map((s: { key: string }) => s.key).sort()).toEqual([
            'APP_DB_PASS',
            'DB_URL_PROD',
        ]);

        // Unrelated project p2 shouldn't share secrets
        const p2Secrets = await request(app)
            .get(`/api/projects/${p2.body.id}/secrets?environment=development&mode=cursor&search=db`)
            .set('Cookie', cookie);
        expect(p2Secrets.body.data).toEqual([]);
    }, 25000);

    it('paginates projects, secrets, members, and audit logs cleanly without skips/duplicates and rejects bad cursors', async () => {
        if (!db.connected) return;
        const app = createApp();

        const [admin, dev, auditor] = await UserModel.create([
            { email: 'pag_admin@example.com', username: 'pag_admin', hasAvatar: true, avatarUpdatedAt: new Date('2026-11-02T00:00:00Z'), passwordHash: DUMMY_HASH, isActive: true, isPlatformAdmin: false },
            { email: 'pag_dev@example.com', username: 'pag_dev', hasAvatar: false, passwordHash: DUMMY_HASH, isActive: true, isPlatformAdmin: false },
            { email: 'pag_aud@example.com', passwordHash: DUMMY_HASH, isActive: true, isPlatformAdmin: false },
        ]);
        const cookie = signAuthCookie(admin._id.toString());

        // Create 5 projects
        const createdProjectIds: string[] = [];
        for (let i = 1; i <= 5; i += 1) {
            const res = await request(app)
                .post('/api/projects')
                .set('Origin', ORIGIN)
                .set('Cookie', cookie)
                .send({ name: `PagProj ${i}` });
            expect(res.status).toBe(201);
            createdProjectIds.push(res.body.id);
        }

        // Traverse projects 2 at a time
        const seenProjects: string[] = [];
        let cursor: string | null = null;
        let pages = 0;
        do {
            const qs: string = cursor
                ? `?mode=cursor&limit=2&cursor=${encodeURIComponent(cursor)}`
                : '?mode=cursor&limit=2';
            const res = await request(app).get(`/api/projects${qs}`).set('Cookie', cookie);
            expect(res.status).toBe(200);
            pages += 1;
            const body = res.body as {
                data: Array<{ id: string }>;
                nextCursor: string | null;
                hasMore: boolean;
            };
            for (const p of body.data) seenProjects.push(p.id);
            cursor = body.nextCursor;
            if (!body.hasMore) expect(cursor).toBeNull();
        } while (cursor);
        expect(pages).toBe(3);
        expect(new Set(seenProjects).size).toBe(5);

        const projA = createdProjectIds[0];
        const projB = createdProjectIds[1];

        // Add 2 more members to projA (total 3)
        await request(app)
            .post(`/api/projects/${projA}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ email: dev.email, role: 'developer' })
            .expect(201);
        await request(app)
            .post(`/api/projects/${projA}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ email: auditor.email, role: 'auditor' })
            .expect(201);

        // Traverse members limit=2
        const mPage1 = await request(app)
            .get(`/api/projects/${projA}/members?mode=cursor&limit=2`)
            .set('Cookie', cookie);
        expect(mPage1.status).toBe(200);
        expect(mPage1.body.data).toHaveLength(2);
        expect(mPage1.body.hasMore).toBe(true);
        const mPage2 = await request(app)
            .get(`/api/projects/${projA}/members?mode=cursor&limit=2&cursor=${encodeURIComponent(mPage1.body.nextCursor)}`)
            .set('Cookie', cookie);
        expect(mPage2.status).toBe(200);
        expect(mPage2.body.data).toHaveLength(1);
        expect(mPage2.body.hasMore).toBe(false);
        const allMembers = [...mPage1.body.data, ...mPage2.body.data];
        expect(new Set(allMembers.map((m) => m.userId)).size).toBe(3);
        const adminMemberRow = allMembers.find((m) => m.userId === admin._id.toString());
        expect(adminMemberRow.username).toBe('pag_admin');
        expect(adminMemberRow.hasAvatar).toBe(true);

        // Create 3 development secrets + 1 staging secret on projA
        for (const k of ['SEC_A', 'SEC_B', 'SEC_C']) {
            await request(app)
                .post(`/api/projects/${projA}/secrets`)
                .set('Origin', ORIGIN)
                .set('Cookie', cookie)
                .send({ key: k, environment: 'development', value: `v_${k}` })
                .expect(201);
        }
        await request(app)
            .post(`/api/projects/${projA}/secrets`)
            .set('Origin', ORIGIN)
            .set('Cookie', cookie)
            .send({ key: 'STAGE_1', environment: 'staging', value: 'v_stage' })
            .expect(201);

        const sPage1 = await request(app)
            .get(`/api/projects/${projA}/secrets?environment=development&mode=cursor&limit=2`)
            .set('Cookie', cookie);
        expect(sPage1.status).toBe(200);
        expect(sPage1.body.data).toHaveLength(2);
        expect(sPage1.body.hasMore).toBe(true);

        // Cross-environment cursor rejection (422)
        const crossEnv = await request(app)
            .get(`/api/projects/${projA}/secrets?environment=staging&limit=2&cursor=${encodeURIComponent(sPage1.body.nextCursor)}`)
            .set('Cookie', cookie);
        expect(crossEnv.status).toBe(422);

        // Cross-project cursor rejection (422)
        const crossProj = await request(app)
            .get(`/api/projects/${projB}/secrets?environment=development&limit=2&cursor=${encodeURIComponent(sPage1.body.nextCursor)}`)
            .set('Cookie', cookie);
        expect(crossProj.status).toBe(422);

        // Second page of secrets succeeds
        const sPage2 = await request(app)
            .get(`/api/projects/${projA}/secrets?environment=development&limit=2&cursor=${encodeURIComponent(sPage1.body.nextCursor)}`)
            .set('Cookie', cookie);
        expect(sPage2.status).toBe(200);
        expect(sPage2.body.data).toHaveLength(1);
        expect(sPage2.body.hasMore).toBe(false);

        // Audit log traversal (projA has >= 7 entries: project_created, 2 member_added, 4 create)
        const seenAuditIds: string[] = [];
        let auditCursor: string | null = null;
        let actorHasUsername = false;
        do {
            const qs: string = auditCursor
                ? `?mode=cursor&limit=3&cursor=${encodeURIComponent(auditCursor)}`
                : '?mode=cursor&limit=3';
            const res = await request(app)
                .get(`/api/projects/${projA}/audit-log${qs}`)
                .set('Cookie', cookie);
            expect(res.status).toBe(200);
            const body = res.body as {
                data: Array<{ id: string; user?: { username?: string | null } }>;
                nextCursor: string | null;
            };
            for (const entry of body.data) {
                seenAuditIds.push(entry.id);
                if (entry.user?.username === 'pag_admin') {
                    actorHasUsername = true;
                }
            }
            auditCursor = body.nextCursor;
        } while (auditCursor);
        expect(actorHasUsername).toBe(true);
        expect(new Set(seenAuditIds).size).toBe(seenAuditIds.length);
        expect(seenAuditIds.length).toBeGreaterThanOrEqual(7);

        // Reject tampered cursor, page param, and oversized limit (422)
        expect((await request(app).get(`/api/projects?mode=cursor&cursor=not-a-valid-cursor`).set('Cookie', cookie)).status).toBe(422);
        expect((await request(app).get(`/api/projects?page=2`).set('Cookie', cookie)).status).toBe(422);
        expect((await request(app).get(`/api/projects/${projA}/members?page=2`).set('Cookie', cookie)).status).toBe(422);
        expect((await request(app).get(`/api/projects/${projA}/secrets?environment=development&page=2`).set('Cookie', cookie)).status).toBe(422);
        expect((await request(app).get(`/api/projects/${projA}/audit-log?limit=101`).set('Cookie', cookie)).status).toBe(422);
    }, 25000);
});
