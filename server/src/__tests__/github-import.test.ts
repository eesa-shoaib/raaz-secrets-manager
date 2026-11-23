import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
vi.mock('../services/github-provider.service.js', async (original) => ({
    ...(await original<typeof import('../services/github-provider.service.js')>()),
    exchangeGitHubConnection: vi.fn(),
    refreshGitHubConnection: vi.fn(),
    githubRequest: vi.fn(),
}));
vi.mock('../services/audit.service.js', async (original) => {
    const actual = await original<typeof import('../services/audit.service.js')>();
    return { ...actual, writeAuditEntry: vi.fn(actual.writeAuditEntry) };
});
import { createApp } from '../index.js';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { GitHubConnectAttemptModel } from '../models/GitHubConnectAttempt.js';
import { GitHubConnectionModel } from '../models/GitHubConnection.js';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { SecretModel } from '../models/Secret.js';
import { UserModel } from '../models/User.js';
import { writeAuditEntry } from '../services/audit.service.js';
import { encrypt } from '../services/encryption.service.js';
import {
    exchangeGitHubConnection,
    githubRequest,
    refreshGitHubConnection,
} from '../services/github-provider.service.js';
import { AppError } from '../utils/app-error.js';
import { connectDisposableTestDb, type TestDbHandle } from './test-db.js';

const app = createApp();
const origin = 'http://localhost:5173';
let db: TestDbHandle;
let userId: string;
let cookie: string;
let accessToken: string;
let refreshToken: string;
let repos: {
    id: number;
    name: string;
    owner: { login: string };
    description: string;
    private: boolean;
}[];
const body = {
    installationId: 11,
    repositoryId: 101,
    name: 'Imported API',
    description: 'Reviewed description',
};
const tokenCookie = (id: string) =>
    `token=${jwt.sign({ sub: id, tv: 0, pa: false, jti: randomBytes(8).toString('hex') }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: '1h' })}`;
async function connect(auth = cookie) {
    const start = await request(app)
        .post('/api/integrations/github/start')
        .set('Origin', origin)
        .set('Cookie', auth)
        .send({ returnTo: 'projects' })
        .expect(200);
    const url = new URL(start.body.authorizationUrl);
    expect(url.searchParams.get('scope')).toBeNull();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const state = url.searchParams.get('state')!;
    const callback = await request(app)
        .get('/api/integrations/github/callback')
        .query({ state, code: 'synthetic-code' })
        .set('Cookie', auth);
    return { callback, state };
}
beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CLIENT_ORIGIN', origin);
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    vi.stubEnv('MASTER_KEY', randomBytes(32).toString('base64'));
    vi.stubEnv('MASTER_KEY_VERSION', '1');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'synthetic-app-client');
    vi.stubEnv('GITHUB_APP_CLIENT_SECRET', randomBytes(16).toString('hex'));
    vi.stubEnv('GITHUB_APP_SLUG', 'raaz-test');
    vi.stubEnv('GITHUB_APP_CALLBACK_URL', `${origin}/api/integrations/github/callback`);
    db = await connectDisposableTestDb('github');
}, 30000);
afterAll(async () => {
    await db?.disconnect();
    vi.unstubAllEnvs();
});
beforeEach(async (context) => {
    if (!db.connected) context.skip();
    await db.clearCollections();
    const user = await UserModel.create({
        email: 'github-owner@example.test',
        passwordHash: 'unused-synthetic-hash',
        isActive: true,
    });
    userId = user._id.toString();
    cookie = tokenCookie(userId);
    accessToken = randomBytes(32).toString('hex');
    refreshToken = randomBytes(32).toString('hex');
    repos = [
        {
            id: 101,
            name: 'api',
            owner: { login: 'team' },
            description: 'API .* metadata',
            private: true,
        },
        { id: 102, name: 'web', owner: { login: 'team' }, description: 'Web', private: false },
    ];
    vi.mocked(exchangeGitHubConnection)
        .mockReset()
        .mockResolvedValue({
            accessToken,
            refreshToken,
            expiresAt: Date.now() + 3600000,
            refreshExpiresAt: Date.now() + 86400000,
        });
    vi.mocked(refreshGitHubConnection).mockReset();
    vi.mocked(githubRequest)
        .mockReset()
        .mockImplementation(async <T>(_token: string, path: string, schema: z.ZodType<T>) => {
            if (path === '/user') return schema.parse({ id: 7, login: 'connected-user' });
            if (path.startsWith('/user/installations?'))
                return schema.parse({
                    total_count: 1,
                    installations: [
                        { id: 11, account: { login: 'team' }, repository_selection: 'selected' },
                    ],
                });
            if (path.startsWith('/user/installations/11/repositories?'))
                return schema.parse({ total_count: repos.length, repositories: repos });
            throw new AppError(404, 'NOT_FOUND', 'GitHub resource is unavailable');
        });
});

function exampleFile(text: string, fallback = false) {
    const previous = vi.mocked(githubRequest).getMockImplementation()!;
    vi.mocked(githubRequest).mockImplementation(
        async <T>(token: string, path: string, schema: z.ZodType<T>) => {
            if (path === `/repos/team/api/contents/${fallback ? 'env.example' : '.env.example'}`) {
                return schema.parse({
                    type: 'file',
                    encoding: 'base64',
                    size: Buffer.byteLength(text),
                    content: Buffer.from(text).toString('base64'),
                });
            }
            return previous(token, path, schema);
        },
    );
}

describe('GitHub metadata import', () => {
    it('binds callbacks to the session, consumes state once, and hides encrypted credentials', async () => {
        await request(app)
            .post('/api/integrations/github/start')
            .set('Cookie', cookie)
            .send({ returnTo: 'projects' })
            .expect(403);
        await request(app).get('/api/integrations/github').expect(401);
        const start = await request(app)
            .post('/api/integrations/github/start')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ returnTo: 'settings' })
            .expect(200);
        const state = new URL(start.body.authorizationUrl).searchParams.get('state')!;
        const wrongSession = tokenCookie(userId);
        const rejected = await request(app)
            .get('/api/integrations/github/callback')
            .query({ state, code: 'synthetic-code' })
            .set('Cookie', wrongSession)
            .expect(303);
        expect(rejected.headers.location).toContain('github=failed');
        expect(await GitHubConnectionModel.countDocuments()).toBe(0);
        const accepted = await request(app)
            .get('/api/integrations/github/callback')
            .query({ state, code: 'synthetic-code' })
            .set('Cookie', cookie)
            .expect(303);
        expect(accepted.headers.location).toBe(`${origin}/settings?github=connected`);
        const replay = await request(app)
            .get('/api/integrations/github/callback')
            .query({ state, code: 'synthetic-code' })
            .set('Cookie', cookie)
            .expect(303);
        expect(replay.headers.location).toContain('github=failed');
        expect(await GitHubConnectAttemptModel.countDocuments()).toBe(0);
        const status = await request(app)
            .get('/api/integrations/github')
            .set('Cookie', cookie)
            .expect(200);
        expect(Object.keys(status.body).sort()).toEqual([
            'connected',
            'enabled',
            'login',
            'manageUrl',
        ]);
        expect(JSON.stringify(status.body).includes(accessToken)).toBe(false);
        const stored = await GitHubConnectionModel.findOne({ userId }).lean();
        expect(stored?.credentials === undefined).toBe(true);
        expect(await AuditLogEntryModel.countDocuments({ action: 'github_connected' })).toBe(1);
    });
    it('searches literal metadata, refreshes new repositories and rejects forged IDs', async () => {
        expect((await connect()).callback.status).toBe(303);
        const first = await request(app)
            .get('/api/integrations/github/repositories')
            .query({ installationId: 11, page: 1, limit: 1 })
            .set('Cookie', cookie)
            .expect(200);
        expect(first.body.total).toBe(2);
        expect(first.body.data).toHaveLength(1);
        const search = await request(app)
            .get('/api/integrations/github/repositories')
            .query({ installationId: 11, search: '.*' })
            .set('Cookie', cookie)
            .expect(200);
        expect(search.body.total).toBe(1);
        repos.push({
            id: 103,
            name: 'future',
            owner: { login: 'team' },
            description: '',
            private: true,
        });
        const fresh = await request(app)
            .get('/api/integrations/github/repositories')
            .query({ installationId: 11 })
            .set('Cookie', cookie)
            .expect(200);
        expect(fresh.body.total).toBe(3);
        await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ ...body, repositoryId: 999 })
            .expect(404);
        await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ ...body, installationId: 99 })
            .expect(404);
        await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ ...body, url: 'https://untrusted.example' })
            .expect(422);
        expect(await ProjectModel.countDocuments()).toBe(0);
    });
    it('imports once per creator, preserves permissions and remains usable after disconnect', async () => {
        await connect();
        const imported = await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(201);
        expect(imported.body.project.githubRepository).toEqual({
            id: 101,
            owner: 'team',
            name: 'api',
            url: 'https://github.com/team/api',
        });
        expect(imported.body.project.environments).toEqual([
            'development',
            'staging',
            'production',
        ]);
        const again = await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(200);
        expect(again.body.project.id).toBe(imported.body.project.id);
        expect(again.body.created).toBe(false);
        expect(await AuditLogEntryModel.countDocuments({ action: 'project_created' })).toBe(1);
        expect(await ProjectMembershipModel.countDocuments()).toBe(1);
        const other = await UserModel.create({
            email: 'other@example.test',
            passwordHash: 'unused-synthetic-hash',
        });
        const otherCookie = tokenCookie(other._id.toString());
        await request(app)
            .get('/api/integrations/github/repositories?installationId=11')
            .set('Cookie', otherCookie)
            .expect(409);
        await connect(otherCookie);
        const separate = await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', otherCookie)
            .send(body)
            .expect(201);
        expect(separate.body.project.id === imported.body.project.id).toBe(false);
        await request(app)
            .get(`/api/projects/${imported.body.project.id}`)
            .set('Cookie', otherCookie)
            .expect(404);
        await request(app)
            .delete('/api/integrations/github')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .expect(204);
        await request(app)
            .get(`/api/projects/${imported.body.project.id}`)
            .set('Cookie', cookie)
            .expect(200);
        expect(await AuditLogEntryModel.countDocuments({ action: 'github_disconnected' })).toBe(1);
    }, 20000);
    it('seeds example keys with encrypted mock values in development and preserves edits on retry', async () => {
        await connect();
        const sourceValue = randomBytes(32).toString('hex');
        exampleFile(
            `export lower_key=${sourceValue}\nDB_URL=\nDB_URL=ignored\nQUOTED="line one\nNOT_A_KEY=inside value"\n`,
        );
        const imported = await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(201);
        expect(imported.body.mockSecretsCreated).toBe(3);
        expect(JSON.stringify(imported.body).includes(sourceValue)).toBe(false);
        const projectId = imported.body.project.id;
        const secrets = await SecretModel.find({ projectId }).lean();
        expect(secrets.map((secret) => secret.key).sort()).toEqual([
            'DB_URL',
            'LOWER_KEY',
            'QUOTED',
        ]);
        expect(
            secrets.every((secret) => secret.environment === 'development' && !secret.ciphertext),
        ).toBe(true);
        expect(await AuditLogEntryModel.countDocuments({ projectId, action: 'create' })).toBe(3);
        const secret = secrets[0];
        const reveal = await request(app)
            .post(`/api/projects/${projectId}/secrets/${secret._id}/reveal`)
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ confirm: false })
            .expect(200);
        expect(reveal.body.value === 'MOCK_VALUE_REPLACE_ME').toBe(true);
        await request(app)
            .patch(`/api/projects/${projectId}/secrets/${secret._id}`)
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ value: sourceValue })
            .expect(200);
        const before = vi
            .mocked(githubRequest)
            .mock.calls.filter((call) => call[1].includes('/contents/')).length;
        const retry = await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(200);
        expect(retry.body.mockSecretsCreated).toBe(0);
        expect(
            vi.mocked(githubRequest).mock.calls.filter((call) => call[1].includes('/contents/'))
                .length,
        ).toBe(before);
        const after = await request(app)
            .post(`/api/projects/${projectId}/secrets/${secret._id}/reveal`)
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ confirm: false })
            .expect(200);
        expect(after.body.value === sourceValue).toBe(true);
    }, 20000);
    it('supports env.example fallback and rolls back the project when mock auditing fails', async () => {
        await connect();
        exampleFile('API_KEY=ignored', true);
        const original = vi.mocked(writeAuditEntry).getMockImplementation()!;
        vi.mocked(writeAuditEntry).mockImplementation(async (input) => {
            if (input.action === 'create') throw new Error('Synthetic mock audit failure');
            return original(input);
        });
        try {
            await request(app)
                .post('/api/integrations/github/import')
                .set('Origin', origin)
                .set('Cookie', cookie)
                .send(body)
                .expect(500);
            expect(await ProjectModel.countDocuments()).toBe(0);
            expect(await ProjectMembershipModel.countDocuments()).toBe(0);
            expect(await SecretModel.countDocuments()).toBe(0);
            expect(await AuditLogEntryModel.countDocuments({ action: 'project_created' })).toBe(0);
        } finally {
            vi.mocked(writeAuditEntry).mockImplementation(original);
        }
        const imported = await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(201);
        expect(imported.body.mockSecretsCreated).toBe(1);
    }, 20000);
    it('requires Contents access for mocks but permits explicit metadata-only import', async () => {
        await connect();
        const previous = vi.mocked(githubRequest).getMockImplementation()!;
        vi.mocked(githubRequest).mockImplementation(
            async <T>(token: string, path: string, schema: z.ZodType<T>) => {
                if (path.includes('/contents/'))
                    throw new AppError(403, 'FORBIDDEN', 'Permission missing');
                return previous(token, path, schema);
            },
        );
        const denied = await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(403);
        expect(denied.body.error.message).toContain('Contents read-only');
        expect(await ProjectModel.countDocuments()).toBe(0);
        const imported = await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ ...body, seedExampleSecrets: false })
            .expect(201);
        expect(imported.body.mockSecretsCreated).toBe(0);
        expect(await SecretModel.countDocuments()).toBe(0);
    }, 20000);
    it('rejects oversized files and too many keys before creating a project', async () => {
        await connect();
        exampleFile('A=' + 'x'.repeat(65536));
        await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(422);
        exampleFile(Array.from({ length: 101 }, (_, index) => `KEY_${index}=ignored`).join('\n'));
        await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(422);
        expect(await ProjectModel.countDocuments()).toBe(0);
    }, 20000);
    it('rolls back connection, import and disconnect mutations when auditing fails', async () => {
        vi.mocked(writeAuditEntry).mockImplementationOnce(async () => {
            throw new Error('Synthetic audit failure');
        });
        expect((await connect()).callback.status).toBe(500);
        expect(await GitHubConnectionModel.countDocuments()).toBe(0);
        await connect();
        vi.mocked(writeAuditEntry).mockImplementationOnce(async () => {
            throw new Error('Synthetic audit failure');
        });
        await request(app)
            .post('/api/integrations/github/import')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send(body)
            .expect(500);
        expect(await ProjectModel.countDocuments()).toBe(0);
        expect(await ProjectMembershipModel.countDocuments()).toBe(0);
        vi.mocked(writeAuditEntry).mockImplementationOnce(async () => {
            throw new Error('Synthetic audit failure');
        });
        await request(app)
            .delete('/api/integrations/github')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .expect(500);
        expect(await GitHubConnectionModel.countDocuments()).toBe(1);
    }, 20000);
    it('refreshes expired credentials and rejects stale sessions and expired attempts', async () => {
        await connect();
        const connection = await GitHubConnectionModel.findOne({ userId });
        const freshToken = randomBytes(32).toString('hex');
        await GitHubConnectionModel.updateOne(
            { userId },
            {
                credentials: encrypt(
                    JSON.stringify({
                        accessToken,
                        refreshToken,
                        expiresAt: 1,
                        refreshExpiresAt: Date.now() + 86400000,
                    }),
                    'github-connection',
                    connection!._id.toString(),
                    userId,
                ),
            },
        );
        vi.mocked(refreshGitHubConnection).mockResolvedValue({
            accessToken: freshToken,
            refreshToken: randomBytes(32).toString('hex'),
            expiresAt: Date.now() + 3600000,
            refreshExpiresAt: Date.now() + 86400000,
        });
        await request(app)
            .get('/api/integrations/github/repositories?installationId=11')
            .set('Cookie', cookie)
            .expect(200);
        expect(vi.mocked(githubRequest).mock.calls.at(-1)?.[0] === freshToken).toBe(true);
        const start = await request(app)
            .post('/api/integrations/github/start')
            .set('Origin', origin)
            .set('Cookie', cookie)
            .send({ returnTo: 'projects' })
            .expect(200);
        const state = new URL(start.body.authorizationUrl).searchParams.get('state')!;
        await GitHubConnectAttemptModel.updateMany({}, { expiresAt: new Date(1) });
        const expired = await request(app)
            .get('/api/integrations/github/callback')
            .query({ state, code: 'synthetic-code' })
            .set('Cookie', cookie)
            .expect(303);
        expect(expired.headers.location).toContain('github=failed');
        await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
        await request(app).get('/api/integrations/github').set('Cookie', cookie).expect(401);
    }, 20000);
});
