import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { ProjectModel } from '../models/Project.js';
import { SecretModel } from '../models/Secret.js';
import { UserModel } from '../models/User.js';
import { encrypt } from '../services/encryption.service.js';
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

describe('GET /api/projects/:projectId/secrets/env-example', () => {
    let db: TestDbHandle;

    beforeAll(async () => {
        process.env.CLIENT_ORIGIN = ORIGIN;
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.MASTER_KEY = MASTER_KEY;
        process.env.MASTER_KEY_VERSION = '1';
        db = await connectDisposableTestDb('envex');
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

    it('generates sorted metadata-only .env.example across >25 secrets for all member roles and isolates projects', async () => {
        if (!db.connected) return;
        const app = createApp();

        const [admin, developer, auditor, platformAdmin] = await UserModel.create([
            {
                email: 'envex_admin@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'envex_dev@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'envex_aud@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: false,
            },
            {
                email: 'envex_pa@example.com',
                passwordHash: DUMMY_HASH,
                isActive: true,
                isPlatformAdmin: true,
            },
        ]);

        const adminCookie = signAuthCookie(admin._id.toString());
        const devCookie = signAuthCookie(developer._id.toString());
        const auditorCookie = signAuthCookie(auditor._id.toString());
        const paCookie = signAuthCookie(platformAdmin._id.toString(), 0, true);

        const projARes = await request(app)
            .post('/api/projects')
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ name: 'Payments API' })
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
            .send({ email: developer.email, role: 'developer' })
            .expect(201);
        await request(app)
            .post(`/api/projects/${projA}/members`)
            .set('Origin', ORIGIN)
            .set('Cookie', adminCookie)
            .send({ email: auditor.email, role: 'auditor' })
            .expect(201);

        // Insert 27 secrets directly into projA (development) out of alphabetical order, plus 1 in staging and 1 in projB
        const secretDocs = [];
        const expectedKeys: string[] = [];
        for (let i = 27; i >= 1; i -= 1) {
            const key = `KEY_${String(i).padStart(2, '0')}`;
            expectedKeys.push(key);
            const secretId = new mongoose.Types.ObjectId();
            const enc = encrypt(
                `super-secret-value-${i}`,
                projA,
                secretId.toString(),
                'development',
            );
            secretDocs.push({
                _id: secretId,
                projectId: new mongoose.Types.ObjectId(projA),
                environment: 'development',
                key,
                ciphertext: enc.ciphertext,
                iv: enc.iv,
                authTag: enc.authTag,
                encryptionKeyVersion: enc.encryptionKeyVersion,
                createdBy: admin._id,
            });
        }
        const stagingId = new mongoose.Types.ObjectId();
        const stagingEnc = encrypt('staging-secret', projA, stagingId.toString(), 'staging');
        secretDocs.push({
            _id: stagingId,
            projectId: new mongoose.Types.ObjectId(projA),
            environment: 'staging',
            key: 'STAGING_ONLY_KEY',
            ciphertext: stagingEnc.ciphertext,
            iv: stagingEnc.iv,
            authTag: stagingEnc.authTag,
            encryptionKeyVersion: stagingEnc.encryptionKeyVersion,
            createdBy: admin._id,
        });
        const otherProjId = new mongoose.Types.ObjectId();
        const otherEnc = encrypt('proj-b-secret', projB, otherProjId.toString(), 'development');
        secretDocs.push({
            _id: otherProjId,
            projectId: new mongoose.Types.ObjectId(projB),
            environment: 'development',
            key: 'PROJECT_B_KEY',
            ciphertext: otherEnc.ciphertext,
            iv: otherEnc.iv,
            authTag: otherEnc.authTag,
            encryptionKeyVersion: otherEnc.encryptionKeyVersion,
            createdBy: admin._id,
        });
        await SecretModel.insertMany(secretDocs);

        expectedKeys.sort();
        const expectedContent = `# .env.example — Payments API (development)\n${expectedKeys.map((k) => `${k}=`).join('\n')}\n`;

        // All 3 member roles succeed and never see any decrypted values
        for (const cookie of [adminCookie, devCookie, auditorCookie]) {
            const res = await request(app)
                .get(`/api/projects/${projA}/secrets/env-example?environment=development`)
                .set('Cookie', cookie);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                filename: '.env.development.example',
                content: expectedContent,
            });
            expect(res.body.content).not.toContain('super-secret-value');
            expect(res.body.content).not.toContain('STAGING_ONLY_KEY');
            expect(res.body.content).not.toContain('PROJECT_B_KEY');
        }

        // Non-member Platform Admin gets 404
        await request(app)
            .get(`/api/projects/${projA}/secrets/env-example?environment=development`)
            .set('Cookie', paCookie)
            .expect(404);

        // Missing or invalid environment returns 422
        await request(app)
            .get(`/api/projects/${projA}/secrets/env-example`)
            .set('Cookie', adminCookie)
            .expect(422);
        await request(app)
            .get(`/api/projects/${projA}/secrets/env-example?environment=qa`)
            .set('Cookie', adminCookie)
            .expect(422);

        // Malformed projectId returns 422
        await request(app)
            .get('/api/projects/not-an-object-id/secrets/env-example?environment=development')
            .set('Cookie', adminCookie)
            .expect(422);

        // Archived project returns 403 for members, still 404 for non-members
        await ProjectModel.updateOne({ _id: projA }, { $set: { status: 'archived' } });
        await request(app)
            .get(`/api/projects/${projA}/secrets/env-example?environment=development`)
            .set('Cookie', adminCookie)
            .expect(403);
        await request(app)
            .get(`/api/projects/${projA}/secrets/env-example?environment=development`)
            .set('Cookie', paCookie)
            .expect(404);
    }, 25000);
});
