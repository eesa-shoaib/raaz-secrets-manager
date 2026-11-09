import { deflateSync } from 'node:zlib';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { UserModel } from '../models/User.js';
import { UserAvatarModel } from '../models/UserAvatar.js';
import { connectDisposableTestDb, type TestDbHandle } from './test-db.js';

const ORIGIN = 'http://localhost:5173';
const JWT_SECRET = '0123456789abcdef0123456789abcdef';
const MASTER_KEY = Buffer.alloc(32, 7).toString('base64');

function buildSyntheticPng(width: number, height: number, extraTextChunk?: string): Buffer {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    const stride = width * 4;
    const raw = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0;
        for (let x = 0; x < width; x++) {
            const p = y * (stride + 1) + 1 + x * 4;
            raw[p] = (x * 7) & 0xff;
            raw[p + 1] = (y * 11) & 0xff;
            raw[p + 2] = 180;
            raw[p + 3] = 255;
        }
    }
    const idat = deflateSync(raw);

    const makeChunk = (type: string, data: Buffer) => {
        const hdr = Buffer.alloc(8);
        hdr.writeUInt32BE(data.byteLength, 0);
        hdr.write(type, 4, 4, 'ascii');
        const crc = Buffer.alloc(4);
        return Buffer.concat([hdr, data, crc]);
    };

    const parts = [signature, makeChunk('IHDR', ihdr)];
    if (extraTextChunk) {
        parts.push(makeChunk('tEXt', Buffer.from(`Comment\0${extraTextChunk}`, 'utf8')));
    }
    parts.push(makeChunk('IDAT', idat), makeChunk('IEND', Buffer.alloc(0)));
    return Buffer.concat(parts);
}

describe('M2-02, M2-03 & M2-07 Account Profile, Avatar, Password Change & Admin Cursor Pagination', () => {
    let db: TestDbHandle;

    beforeAll(async () => {
        process.env.CLIENT_ORIGIN = ORIGIN;
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.MASTER_KEY = MASTER_KEY;
        process.env.MASTER_KEY_VERSION = '1';
        db = await connectDisposableTestDb('m20307');
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

    it('supports password change with current-password check, tokenVersion invalidation, and audit log', async () => {
        if (!db.connected) return;
        const app = createApp();

        await request(app)
            .post('/api/auth/signup')
            .set('Origin', ORIGIN)
            .send({ email: 'pwuser@example.com', password: 'InitialPassword1' })
            .expect(201);

        const loginRes = await request(app)
            .post('/api/auth/login')
            .set('Origin', ORIGIN)
            .send({ email: 'pwuser@example.com', password: 'InitialPassword1' })
            .expect(200);
        const cookie1 = loginRes.headers['set-cookie'][0];

        // Wrong current password -> 401 and session remains valid
        const wrongCurrent = await request(app)
            .post('/api/auth/change-password')
            .set('Origin', ORIGIN)
            .set('Cookie', cookie1)
            .send({ currentPassword: 'WrongPassword1', newPassword: 'UpdatedPassword2' });
        expect(wrongCurrent.status).toBe(401);
        expect(wrongCurrent.body.error.message).toBe('Current password is incorrect');

        await request(app).get('/api/auth/me').set('Cookie', cookie1).expect(200);

        // Same password -> 422
        await request(app)
            .post('/api/auth/change-password')
            .set('Origin', ORIGIN)
            .set('Cookie', cookie1)
            .send({ currentPassword: 'InitialPassword1', newPassword: 'InitialPassword1' })
            .expect(422);

        // Valid change -> 204, cookie invalidated
        const successRes = await request(app)
            .post('/api/auth/change-password')
            .set('Origin', ORIGIN)
            .set('Cookie', cookie1)
            .send({ currentPassword: 'InitialPassword1', newPassword: 'UpdatedPassword2' });
        expect(successRes.status).toBe(204);

        // Prior JWT cookie is rejected immediately due to bumped tokenVersion
        await request(app).get('/api/auth/me').set('Cookie', cookie1).expect(401);

        // Old password no longer works, new password works
        await request(app)
            .post('/api/auth/login')
            .set('Origin', ORIGIN)
            .send({ email: 'pwuser@example.com', password: 'InitialPassword1' })
            .expect(401);

        await request(app)
            .post('/api/auth/login')
            .set('Origin', ORIGIN)
            .send({ email: 'pwuser@example.com', password: 'UpdatedPassword2' })
            .expect(200);

        const userDoc = await UserModel.findOne({ email: 'pwuser@example.com' }).lean();
        const audit = await AuditLogEntryModel.findOne({
            userId: userDoc!._id,
            action: 'password_changed',
        }).lean();
        expect(audit).toBeTruthy();
        expect(audit?.projectId).toBeNull();
    }, 30000);

    it('manages profile username uniqueness, avatar normalization, metadata stripping, and scoped avatar reads', async () => {
        if (!db.connected) return;
        const app = createApp();

        await PlatformConfigModel.create({ _id: 'singleton', activePlatformAdminCount: 1 });

        const u1Signup = await request(app)
            .post('/api/auth/signup')
            .set('Origin', ORIGIN)
            .send({ email: 'owner@example.com', password: 'Password123!' })
            .expect(201);
        const u1Id = u1Signup.body.id as string;

        await request(app)
            .post('/api/auth/signup')
            .set('Origin', ORIGIN)
            .send({ email: 'comember@example.com', password: 'Password123!' })
            .expect(201);

        await request(app)
            .post('/api/auth/signup')
            .set('Origin', ORIGIN)
            .send({ email: 'stranger@example.com', password: 'Password123!' })
            .expect(201);

        const platSignup = await request(app)
            .post('/api/auth/signup')
            .set('Origin', ORIGIN)
            .send({ email: 'plat@example.com', password: 'Password123!' })
            .expect(201);
        await UserModel.updateOne({ _id: platSignup.body.id }, { $set: { isPlatformAdmin: true } });

        const u1Cookie = (
            await request(app)
                .post('/api/auth/login')
                .set('Origin', ORIGIN)
                .send({ email: 'owner@example.com', password: 'Password123!' })
        ).headers['set-cookie'][0];

        const coCookie = (
            await request(app)
                .post('/api/auth/login')
                .set('Origin', ORIGIN)
                .send({ email: 'comember@example.com', password: 'Password123!' })
        ).headers['set-cookie'][0];

        const strangerCookie = (
            await request(app)
                .post('/api/auth/login')
                .set('Origin', ORIGIN)
                .send({ email: 'stranger@example.com', password: 'Password123!' })
        ).headers['set-cookie'][0];

        const platCookie = (
            await request(app)
                .post('/api/auth/login')
                .set('Origin', ORIGIN)
                .send({ email: 'plat@example.com', password: 'Password123!' })
        ).headers['set-cookie'][0];

        // Username normalization + privilege escalation field rejection
        await request(app)
            .patch('/api/account/profile')
            .set('Origin', ORIGIN)
            .set('Cookie', u1Cookie)
            .send({ username: 'Ali_Dev', isPlatformAdmin: true })
            .expect(422);

        const setUsername = await request(app)
            .patch('/api/account/profile')
            .set('Origin', ORIGIN)
            .set('Cookie', u1Cookie)
            .send({ username: '  Ali_Dev  ' })
            .expect(200);
        expect(setUsername.body.username).toBe('ali_dev');

        // Duplicate username conflict
        await request(app)
            .patch('/api/account/profile')
            .set('Origin', ORIGIN)
            .set('Cookie', coCookie)
            .send({ username: 'ali_dev' })
            .expect(409);

        // Upload oversized 320x320 PNG with embedded tEXt EXIF metadata -> normalized <= 256x256 and tEXt stripped
        const bigPng = buildSyntheticPng(320, 320, 'SensitiveExifSecretMarker');
        const uploadRes = await request(app)
            .put('/api/account/avatar')
            .set('Origin', ORIGIN)
            .set('Cookie', u1Cookie)
            .send({ contentType: 'image/png', data: bigPng.toString('base64') })
            .expect(200);
        expect(uploadRes.body.hasAvatar).toBe(true);
        expect(uploadRes.body.avatarUpdatedAt).toBeTruthy();

        const storedAvatar = await UserAvatarModel.findOne({ userId: u1Id }).lean();
        expect(storedAvatar).toBeTruthy();
        expect(storedAvatar!.width).toBe(256);
        expect(storedAvatar!.height).toBe(256);
        expect(storedAvatar!.byteLength).toBeLessThanOrEqual(131_072);
        const storedBytes = Buffer.isBuffer(storedAvatar!.data)
            ? storedAvatar!.data
            : Buffer.from((storedAvatar!.data as { buffer: Uint8Array }).buffer);
        expect(storedBytes.includes(Buffer.from('SensitiveExifSecretMarker'))).toBe(false);

        // SVG disguised as PNG rejected
        await request(app)
            .put('/api/account/avatar')
            .set('Origin', ORIGIN)
            .set('Cookie', u1Cookie)
            .send({
                contentType: 'image/png',
                data: Buffer.from('<svg onload="alert(1)"></svg>').toString('base64'),
            })
            .expect(422);

        // Owner and Platform Admin can read avatar with private security headers; stranger cannot (404)
        const ownerGet = await request(app).get(`/api/users/${u1Id}/avatar`).set('Cookie', u1Cookie);
        expect(ownerGet.status).toBe(200);
        expect(ownerGet.headers['content-type']).toContain('image/png');
        expect(ownerGet.headers['cache-control']).toBe('private, no-cache');
        expect(ownerGet.headers['x-content-type-options']).toBe('nosniff');
        expect(ownerGet.headers['content-security-policy']).toBe("default-src 'none'");

        await request(app).get(`/api/users/${u1Id}/avatar`).set('Cookie', platCookie).expect(200);
        await request(app).get(`/api/users/${u1Id}/avatar`).set('Cookie', strangerCookie).expect(404);
        await request(app).get(`/api/users/${u1Id}/avatar`).set('Cookie', coCookie).expect(404);

        // Once owner adds co-member to a project, co-member can read owner's avatar; stranger still gets 404
        const proj = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', u1Cookie)
            .send({ name: 'Shared Team' })
            .expect(201);
        await request(app)
            .post(`/api/projects/${proj.body.id}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', u1Cookie)
            .send({ email: 'comember@example.com', role: 'auditor' })
            .expect(201);

        await request(app).get(`/api/users/${u1Id}/avatar`).set('Cookie', coCookie).expect(200);
        await request(app).get(`/api/users/${u1Id}/avatar`).set('Cookie', strangerCookie).expect(404);

        // Remove avatar -> clears metadata, deletes UserAvatar, records audit, returns 404 on read
        const delRes = await request(app)
            .delete('/api/account/avatar')
            .set('Origin', ORIGIN)
            .set('Cookie', u1Cookie)
            .expect(200);
        expect(delRes.body.hasAvatar).toBe(false);
        expect(delRes.body.avatarUpdatedAt).toBeNull();
        expect(await UserAvatarModel.findOne({ userId: u1Id }).lean()).toBeNull();
        await request(app).get(`/api/users/${u1Id}/avatar`).set('Cookie', u1Cookie).expect(404);

        // Verify cursor pagination on /api/admin/users across 4 users (limit=2)
        const p1 = await request(app)
            .get('/api/admin/users?mode=cursor&limit=2')
            .set('Cookie', platCookie)
            .expect(200);
        expect(p1.body.data).toHaveLength(2);
        expect(p1.body.hasMore).toBe(true);
        expect(p1.body.nextCursor).toBeTruthy();

        const p2 = await request(app)
            .get(`/api/admin/users?mode=cursor&limit=2&cursor=${encodeURIComponent(p1.body.nextCursor)}`)
            .set('Cookie', platCookie)
            .expect(200);
        expect(p2.body.data).toHaveLength(2);
        expect(p2.body.hasMore).toBe(false);
        expect(p2.body.nextCursor).toBeNull();

        const ids1 = p1.body.data.map((u: { id: string }) => u.id);
        const ids2 = p2.body.data.map((u: { id: string }) => u.id);
        expect(new Set([...ids1, ...ids2]).size).toBe(4);

        // Mixing page and cursor returns 422
        await request(app)
            .get(`/api/admin/users?page=1&cursor=${encodeURIComponent(p1.body.nextCursor)}`)
            .set('Cookie', platCookie)
            .expect(422);
    }, 30000);
});
