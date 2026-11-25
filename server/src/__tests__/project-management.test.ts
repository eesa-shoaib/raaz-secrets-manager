import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../services/audit.service.js', async (original) => {
    const actual = await original<typeof import('../services/audit.service.js')>();
    return { ...actual, writeAuditEntry: vi.fn(actual.writeAuditEntry) };
});
import { createApp } from '../index.js';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { SecretModel } from '../models/Secret.js';
import { UserModel } from '../models/User.js';
import { writeAuditEntry } from '../services/audit.service.js';
import { connectDisposableTestDb, type TestDbHandle } from './test-db.js';
const origin = 'http://localhost:5173';
const app = createApp();
let db: TestDbHandle;
let owner: string;
let dev: string;
let outsider: string;
let admin: string;
let projectId: string;
beforeAll(async () => {
    process.env.CLIENT_ORIGIN = origin;
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    process.env.MASTER_KEY = randomBytes(32).toString('base64');
    process.env.MASTER_KEY_VERSION = '1';
    db = await connectDisposableTestDb('projectmanage');
}, 30000);
afterAll(async () => {
    await db?.disconnect();
});
beforeEach(async (context) => {
    if (!db.connected) context.skip();
    await db.clearCollections();
    const users = await UserModel.create(
        Array.from({ length: 4 }, (_, index) => ({
            email: `manager${index}@example.test`,
            passwordHash: 'unused-synthetic-hash',
            isActive: true,
            isPlatformAdmin: index === 3,
        })),
    );
    const cookies = users.map(
        (user) =>
            `token=${jwt.sign({ sub: user._id.toString(), tv: 0, pa: false }, process.env.JWT_SECRET!, { algorithm: 'HS256' })}`,
    );
    [owner, dev, outsider, admin] = cookies;
    const project = await request(app)
        .post('/api/projects')
        .set('Origin', origin)
        .set('Cookie', owner)
        .send({ name: 'App.*One', description: 'Not exposed to platform list' })
        .expect(201);
    projectId = project.body.id;
    await ProjectMembershipModel.create({ projectId, userId: users[1]._id, role: 'developer' });
    await request(app)
        .post(`/api/projects/${projectId}/secrets`)
        .set('Origin', origin)
        .set('Cookie', owner)
        .send({ environment: 'development', key: 'API_KEY', value: 'synthetic-secret' })
        .expect(201);
});
const list = (cookie: string, query: Record<string, unknown> = {}) =>
    request(app).get('/api/admin/projects').set('Cookie', cookie).query(query);
const status = (value: 'active' | 'archived', cookie = admin) =>
    request(app)
        .patch(`/api/admin/projects/${projectId}/status`)
        .set('Origin', origin)
        .set('Cookie', cookie)
        .send({ status: value });
const remove = (cookie: string, confirmName = 'App.*One') =>
    request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Origin', origin)
        .set('Cookie', cookie)
        .send({ confirmName });
const audit = (cookie: string, query: Record<string, unknown> = {}) =>
    request(app).get('/api/admin/projects/audit-log').set('Cookie', cookie).query(query);
it('limits the admin view to metadata, searches literally and paginates without granting project access', async () => {
    await list(owner).expect(403);
    await request(app).get('/api/admin/projects').expect(401);
    const second = await request(app)
        .post('/api/projects')
        .set('Origin', origin)
        .set('Cookie', owner)
        .send({ name: 'Another project' })
        .expect(201);
    const first = await list(admin, { limit: 1 }).expect(200);
    expect(first.body.total).toBe(2);
    expect(first.body.hasMore).toBe(true);
    expect(Object.keys(first.body.data[0]).sort()).toEqual([
        'createdAt',
        'id',
        'memberCount',
        'name',
        'status',
    ]);
    const next = await list(admin, { limit: 1, cursor: first.body.nextCursor }).expect(200);
    expect(next.body.data[0].id !== first.body.data[0].id).toBe(true);
    expect(next.body.hasMore).toBe(false);
    const literal = await list(admin, { search: '.*' }).expect(200);
    expect(literal.body.data.map((project: { id: string }) => project.id)).toEqual([projectId]);
    expect(literal.body.data[0].memberCount).toBe(2);
    await list(admin, { search: 'different', cursor: first.body.nextCursor }).expect(422);
    await request(app).get(`/api/projects/${projectId}`).set('Cookie', admin).expect(404);
    await request(app)
        .get(`/api/projects/${projectId}/secrets`)
        .query({ environment: 'development' })
        .set('Cookie', admin)
        .expect(404);
    await remove(admin).expect(404);
    expect(await ProjectModel.exists({ _id: second.body.id })).toBeTruthy();
}, 20000);
it('archives and restores atomically, preserves data, and prevents non-admin status changes', async () => {
    await status('archived', owner).expect(403);
    await request(app)
        .patch(`/api/admin/projects/${projectId}/status`)
        .set('Cookie', admin)
        .send({ status: 'archived' })
        .expect(403);
    await status('archived').expect(204);
    await status('archived').expect(204);
    expect(await AuditLogEntryModel.countDocuments({ projectId, action: 'project_archived' })).toBe(
        1,
    );
    await request(app)
        .get(`/api/projects/${projectId}/secrets`)
        .query({ environment: 'development' })
        .set('Cookie', owner)
        .expect(403);
    await request(app).get(`/api/projects/${projectId}`).set('Cookie', outsider).expect(404);
    await remove(owner).expect(403);
    expect(await SecretModel.countDocuments({ projectId })).toBe(1);
    expect(await ProjectMembershipModel.countDocuments({ projectId })).toBe(2);
    const archived = await list(admin, { status: 'archived' }).expect(200);
    expect(archived.body.total).toBe(1);
    vi.mocked(writeAuditEntry).mockRejectedValueOnce(new Error('Synthetic audit failure'));
    await status('active').expect(500);
    expect((await ProjectModel.findById(projectId))?.status).toBe('archived');
    await status('active').expect(204);
    await request(app).get(`/api/projects/${projectId}`).set('Cookie', owner).expect(200);
    expect(await AuditLogEntryModel.countDocuments({ projectId, action: 'project_restored' })).toBe(
        1,
    );
}, 20000);
it('requires project-admin membership and exact confirmation, retains audits, and rolls back failed deletion', async () => {
    await remove(outsider).expect(404);
    await remove(dev).expect(403);
    expect(
        await AuditLogEntryModel.countDocuments({
            projectId,
            action: 'project_deleted',
            result: 'denied',
        }),
    ).toBe(1);
    await remove(owner, 'wrong name').expect(422);
    vi.mocked(writeAuditEntry).mockRejectedValueOnce(new Error('Synthetic deletion audit failure'));
    await remove(owner).expect(500);
    expect(await ProjectModel.exists({ _id: projectId })).toBeTruthy();
    expect(await SecretModel.countDocuments({ projectId })).toBe(1);
    expect(await ProjectMembershipModel.countDocuments({ projectId })).toBe(2);
    const before = await AuditLogEntryModel.countDocuments({ projectId });
    await remove(owner).expect(204);
    expect(await ProjectModel.exists({ _id: projectId })).toBeNull();
    expect(await SecretModel.countDocuments({ projectId })).toBe(0);
    expect(await ProjectMembershipModel.countDocuments({ projectId })).toBe(0);
    expect(await AuditLogEntryModel.countDocuments({ projectId })).toBe(before + 1);
    await remove(owner).expect(404);
    const listing = await list(admin).expect(200);
    expect(listing.body.total).toBe(0);
    const deleted = await audit(admin, { action: 'project_deleted' }).expect(200);
    const allowedDelete = deleted.body.data.find(
        (entry: { result: string }) => entry.result === 'allowed',
    );
    expect(allowedDelete.projectId).toBe(projectId);
    expect(allowedDelete.projectName).toBe('App.*One');
}, 20000);
it('exposes only project lifecycle audits to Platform Admins', async () => {
    await audit(owner).expect(403);
    await request(app).get('/api/admin/projects/audit-log').expect(401);
    await status('archived').expect(204);
    await status('active').expect(204);

    const result = await audit(admin).expect(200);
    expect(result.body.data.map((entry: { action: string }) => entry.action)).toEqual([
        'project_restored',
        'project_archived',
        'project_created',
    ]);
    expect(result.body.data[0]).toMatchObject({
        projectId,
        projectName: 'App.*One',
        result: 'allowed',
    });
    expect(result.body.data[0]).not.toHaveProperty('secretKey');
    expect(result.body.data[0]).not.toHaveProperty('environment');

    const filtered = await audit(admin, { action: 'project_archived' }).expect(200);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.data[0].action).toBe('project_archived');
    await audit(admin, { action: 'reveal' }).expect(422);
}, 20000);
