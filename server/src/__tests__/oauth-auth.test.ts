import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/oauth-provider.service.js', async (original) => ({
    ...(await original<typeof import('../services/oauth-provider.service.js')>()),
    exchangeProviderCode: vi.fn(),
}));
vi.mock('../services/audit.service.js', async (original) => {
    const actual = await original<typeof import('../services/audit.service.js')>();
    return { ...actual, writeAuditEntry: vi.fn(actual.writeAuditEntry) };
});
import { createApp } from '../index.js';
import { oauthLimiter } from '../middleware/rate-limiters.middleware.js';
import { AuditLogEntryModel } from '../models/AuditLogEntry.js';
import { OAuthAttemptModel } from '../models/OAuthAttempt.js';
import { OAuthIdentityModel } from '../models/OAuthIdentity.js';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { UserModel } from '../models/User.js';
import { writeAuditEntry } from '../services/audit.service.js';
import { issueToken, login } from '../services/auth.service.js';
import { getCookieOptions, logger } from '../services/boot-validation.service.js';
import { exchangeProviderCode } from '../services/oauth-provider.service.js';
import { oauthCookieOptions, resolveOAuthUser } from '../services/oauth.service.js';
import { connectDisposableTestDb, type TestDbHandle } from './test-db.js';

const origin = 'http://localhost:5173';
let db: TestDbHandle;
const app = createApp();
const identity = {
    provider: 'google' as const,
    subject: 'stable-id',
    email: 'oauth@example.test',
    emailVerified: true,
};
async function start(provider = 'google', token?: string) {
    const req = request(app)
        .post(`/api/auth/oauth/${provider}/${token ? 'deactivate/start' : 'start'}`)
        .set('Origin', origin);
    if (token) req.set('Cookie', `token=${token}`);
    const response = await req.send({});
    expect(response.status).toBe(200);
    expect(response.body.binding === undefined).toBe(true);
    const state = new URL(response.body.authorizationUrl).searchParams.get('state')!;
    const binding = (response.headers['set-cookie'] as unknown as string[])
        .find((cookie) => cookie.startsWith(`raaz_oauth_${provider}=`))!
        .split(';')[0];
    return { state, binding };
}
async function callback(
    attempt: { state: string; binding: string },
    provider = 'google',
    token?: string,
) {
    return request(app)
        .get(`/api/auth/oauth/${provider}/callback`)
        .query({ state: attempt.state, code: 'synthetic-code' })
        .set('Cookie', [attempt.binding, ...(token ? [`token=${token}`] : [])]);
}
beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CLIENT_ORIGIN', origin);
    for (const provider of ['GOOGLE', 'GITHUB']) {
        vi.stubEnv(`${provider}_CLIENT_ID`, 'synthetic-client');
        vi.stubEnv(`${provider}_CLIENT_SECRET`, 'synthetic-credential');
        vi.stubEnv(
            `${provider}_CALLBACK_URL`,
            `http://localhost:5000/api/auth/oauth/${provider.toLowerCase()}/callback`,
        );
    }
    db = await connectDisposableTestDb('oauth');
}, 30000);
afterAll(async () => {
    await db?.disconnect();
    vi.unstubAllEnvs();
});
beforeEach(async (context) => {
    if (!db.connected) context.skip();
    if (db?.connected) await db.clearCollections();
    oauthLimiter.resetKey('::ffff:127.0.0.1');
    oauthLimiter.resetKey('127.0.0.1');
    vi.mocked(exchangeProviderCode).mockReset().mockResolvedValue(identity);
});

describe('OAuth accounts and callbacks against a replica set', () => {
    it.each(['google', 'github'])(
        'creates a non-admin %s user with no membership and resumes their identity',
        async (provider) => {
            vi.mocked(exchangeProviderCode).mockResolvedValue({
                ...identity,
                provider: provider as 'google' | 'github',
            });
            const response = await callback(await start(provider), provider);
            expect(response.headers.location).toBe(`${origin}/projects`);
            expect(
                Boolean(
                    (response.headers['set-cookie'] as unknown as string[])?.some(
                        (cookie: string) =>
                            cookie.startsWith('token=') && cookie.includes('HttpOnly'),
                    ),
                ),
            ).toBe(true);
            const user = await UserModel.findOne().select('+passwordHash').lean();
            expect(user?.passwordHash === null).toBe(true);
            expect(user?.passwordEnabled).toBe(false);
            expect(user?.isPlatformAdmin).toBe(false);
            expect(await ProjectMembershipModel.countDocuments()).toBe(0);
            expect(
                await AuditLogEntryModel.countDocuments({
                    action: 'oauth_registered',
                    projectId: null,
                }),
            ).toBe(1);
            vi.mocked(exchangeProviderCode).mockResolvedValue({
                ...identity,
                provider: provider as 'google' | 'github',
                email: 'changed@example.test',
            });
            const again = await callback(await start(provider), provider);
            expect(again.headers.location).toBe(`${origin}/projects`);
            expect(await UserModel.countDocuments()).toBe(1);
            expect((await UserModel.findOne().lean())?.email).toBe(identity.email);
        },
    );
    it('round-trips the persisted state, nonce and verifier into the provider exchange', async () => {
        const attempt = await start('github');
        vi.mocked(exchangeProviderCode).mockResolvedValue({ ...identity, provider: 'github' });
        await callback(attempt, 'github');
        const [provider, query, saved] = vi.mocked(exchangeProviderCode).mock.calls[0]!;
        expect(provider).toBe('github');
        expect(new URLSearchParams(query).get('state') === attempt.state).toBe(true);
        expect(saved.state === attempt.state).toBe(true);
        expect(typeof saved.verifier === 'string' && saved.verifier.length === 43).toBe(true);
        expect(typeof saved.nonce === 'string' && saved.nonce.length === 43).toBe(true);
    });

    it('does not link an existing local email', async () => {
        await UserModel.create({ email: identity.email, passwordHash: 'unused-test-hash' });
        const response = await callback(await start());
        expect(response.headers.location).toBe(`${origin}/login?oauth=failed`);
        expect(await OAuthIdentityModel.countDocuments()).toBe(0);
        expect(await AuditLogEntryModel.countDocuments({ action: 'oauth_registered' })).toBe(0);
    });
    it('rejects disabled identities without creating a replacement', async () => {
        await resolveOAuthUser(identity);
        await UserModel.updateOne({}, { isActive: false });
        expect((await callback(await start())).headers.location).toBe(
            `${origin}/login?oauth=failed`,
        );
        expect(await UserModel.countDocuments()).toBe(1);
    });
    it.each(['unverified', 'missing-email', 'disallowed-domain'])(
        'rejects %s registration',
        async (kind) => {
            if (kind === 'disallowed-domain') vi.stubEnv('SIGNUP_ALLOWED_DOMAINS', 'allowed.test');
            vi.mocked(exchangeProviderCode).mockResolvedValue({
                ...identity,
                emailVerified: kind !== 'unverified',
                email: kind === 'missing-email' ? '' : identity.email,
            });
            const response = await callback(await start());
            expect(response.headers.location).toBe(`${origin}/login?oauth=failed`);
            expect(await UserModel.countDocuments()).toBe(0);
            vi.stubEnv('SIGNUP_ALLOWED_DOMAINS', '');
        },
    );
    it.each(['missing-binding', 'wrong-binding', 'expired', 'wrong-provider', 'wrong-state'])(
        'rejects %s before provider exchange',
        async (kind) => {
            const attempt = await start();
            if (kind === 'expired')
                await OAuthAttemptModel.updateOne({}, { expiresAt: new Date(0) });
            if (kind === 'missing-binding') attempt.binding = '';
            if (kind === 'wrong-binding') attempt.binding = `raaz_oauth_google=${'x'.repeat(43)}`;
            if (kind === 'wrong-state') attempt.state = 'wrong';
            const response = await callback(
                attempt,
                kind === 'wrong-provider' ? 'github' : 'google',
            );
            expect(response.headers.location).toBe(`${origin}/login?oauth=failed`);
            expect(exchangeProviderCode).not.toHaveBeenCalled();
        },
    );
    it('rejects callback replay', async () => {
        const attempt = await start();
        await callback(attempt);
        expect((await callback(attempt)).headers.location).toBe(`${origin}/login?oauth=failed`);
        expect(exchangeProviderCode).toHaveBeenCalledTimes(1);
    });
    it('rolls account creation back when the audit write fails', async () => {
        vi.mocked(writeAuditEntry).mockRejectedValueOnce(new Error('Synthetic audit failure'));
        expect((await callback(await start())).status).toBe(500);
        expect(await UserModel.countDocuments()).toBe(0);
        expect(await OAuthIdentityModel.countDocuments()).toBe(0);
    });
    it('consumes attempts on provider cancellation and failure', async () => {
        const attempt = await start();
        vi.mocked(exchangeProviderCode).mockRejectedValueOnce(new Error('Provider cancelled'));
        expect((await callback(attempt)).headers.location).toBe(`${origin}/login?oauth=failed`);
        expect(await OAuthAttemptModel.countDocuments()).toBe(0);
    });
    it('requires the original session and identity to confirm deactivation', async () => {
        const token = await resolveOAuthUser(identity);
        const attempt = await start('google', token);
        const response = await callback(attempt, 'google', token);
        expect(response.headers.location).toBe(`${origin}/login?oauth=deactivated`);
        const user = await UserModel.findOne().lean();
        expect(user?.isActive).toBe(false);
        expect(user?.tokenVersion).toBe(1);
        expect(await AuditLogEntryModel.countDocuments({ action: 'user_deactivated' })).toBe(1);
    });
    it('rejects changed sessions and wrong provider identities during deactivation', async () => {
        const token = await resolveOAuthUser(identity);
        const attempt = await start('google', token);
        vi.mocked(exchangeProviderCode).mockResolvedValue({
            ...identity,
            subject: 'another-person',
        });
        expect((await callback(attempt, 'google', token)).headers.location).toBe(
            `${origin}/settings?oauth=failed`,
        );
        expect((await UserModel.findOne().lean())?.isActive).toBe(true);
        vi.mocked(exchangeProviderCode).mockResolvedValue(identity);
        const another = await start('google', token);
        await UserModel.updateOne({}, { $inc: { tokenVersion: 1 } });
        expect((await callback(another, 'google', token)).headers.location).toBe(
            `${origin}/settings?oauth=failed`,
        );
    });
    it('protects the last active Platform Admin on provider-confirmed deactivation', async () => {
        await resolveOAuthUser(identity);
        const user = await UserModel.findOneAndUpdate({}, { isPlatformAdmin: true }, { new: true });
        await PlatformConfigModel.create({ _id: 'singleton', activePlatformAdminCount: 1 });
        const token = issueToken(user!._id.toString(), user!.tokenVersion, true);
        expect(
            (await callback(await start('google', token), 'google', token)).headers.location,
        ).toBe(`${origin}/settings?oauth=last-admin`);
        expect((await UserModel.findOne().lean())?.isActive).toBe(true);
        expect(
            (await PlatformConfigModel.findOne({ _id: 'singleton' }).lean())
                ?.activePlatformAdminCount,
        ).toBe(1);
    });
    it('does not allow a password login for an OAuth-only account', async () => {
        await resolveOAuthUser(identity);
        expect((await login(identity.email, 'synthetic-non-password')) === null).toBe(true);
    });
});

it('rejects cross-origin starts and unknown providers without DB queries', async () => {
    expect((await request(app).post('/api/auth/oauth/google/start').send({})).status).toBe(403);
    expect(
        (await request(app).post('/api/auth/oauth/unknown/start').set('Origin', origin).send({}))
            .status,
    ).toBe(422);
});

it('adds a separate host-only secure Lax cookie without changing session SameSite', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('COOKIE_SAMESITE', 'Strict');
    vi.stubEnv('COOKIE_DOMAIN', '.example.test');
    const options = oauthCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.maxAge).toBe(600000);
    expect('domain' in options).toBe(false);
    expect(getCookieOptions().sameSite).toBe('strict');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('COOKIE_SAMESITE', '');
    vi.stubEnv('COOKIE_DOMAIN', '');
});

it('omits query strings from request logs and unknown-route errors', async () => {
    const log = vi.spyOn(logger, 'info');
    try {
        const response = await request(app).get(
            '/api/unknown?code=synthetic-code&state=synthetic-state',
        );
        expect(response.status).toBe(404);
        expect(JSON.stringify(response.body).includes('synthetic-code')).toBe(false);
        expect(JSON.stringify(log.mock.calls).includes('synthetic-state')).toBe(false);
        expect(
            (log.mock.calls as unknown as unknown[][]).some(
                ([record]) =>
                    typeof record === 'object' &&
                    record !== null &&
                    'path' in record &&
                    record.path === '/api/unknown',
            ),
        ).toBe(true);
    } finally {
        log.mockRestore();
    }
});
