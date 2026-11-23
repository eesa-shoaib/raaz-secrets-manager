import { createHash } from 'node:crypto';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeOAuthReason } from './oauth-diagnostics.service.js';
import {
    buildProviderAuthorization,
    exchangeProviderCode,
    getProviderConfig,
} from './oauth-provider.service.js';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = {
    ...pair.publicKey.export({ format: 'jwk' }),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
};
const attempt = {
    state: 'expected-state',
    verifier: 'v'.repeat(43),
    nonce: 'expected-nonce',
    redirectUri: 'http://localhost:5000/api/auth/oauth/google/callback',
};
function idToken(overrides: Record<string, unknown> = {}, corrupt = false) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString(
        'base64url',
    );
    const payload = Buffer.from(
        JSON.stringify({
            iss: 'https://accounts.google.com',
            aud: 'test-client',
            sub: 'stable-subject',
            iat: now,
            exp: now + 300,
            nonce: attempt.nonce,
            email: 'person@example.test',
            email_verified: true,
            ...overrides,
        }),
    ).toString('base64url');
    const data = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256')
        .update(data)
        .sign(pair.privateKey)
        .toString('base64url');
    return `${data}.${corrupt ? 'a'.repeat(signature.length) : signature}`;
}
function googleFetch(token: string) {
    return vi.fn(async (url: unknown) => {
        if (String(url).includes('/certs')) return Response.json({ keys: [publicJwk] });
        return Response.json({
            access_token: 'synthetic-access',
            token_type: 'Bearer',
            id_token: token,
        });
    });
}

beforeEach(() => {
    for (const provider of ['GOOGLE', 'GITHUB']) {
        vi.stubEnv(`${provider}_CLIENT_ID`, 'test-client');
        vi.stubEnv(`${provider}_CLIENT_SECRET`, 'test-client-credential');
        vi.stubEnv(
            `${provider}_CALLBACK_URL`,
            `http://localhost:5000/api/auth/oauth/${provider.toLowerCase()}/callback`,
        );
    }
    vi.stubEnv('NODE_ENV', 'test');
});
afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('provider protocol', () => {
    it.each(['google', 'github'] as const)(
        'uses S256 PKCE, state and minimal scopes for %s',
        async (provider) => {
            const url = new URL(
                await buildProviderAuthorization(
                    provider,
                    attempt.state,
                    attempt.verifier,
                    attempt.nonce,
                ),
            );
            expect(url.searchParams.get('state')).toBe(attempt.state);
            expect(url.searchParams.get('code_challenge_method')).toBe('S256');
            expect(url.searchParams.get('code_challenge')).toBe(
                createHash('sha256').update(attempt.verifier).digest('base64url'),
            );
            expect(url.searchParams.get('scope')).toBe(
                provider === 'google' ? 'openid email' : 'user:email',
            );
            expect(url.searchParams.get('nonce')).toBe(
                provider === 'google' ? attempt.nonce : null,
            );
        },
    );
    it('validates Google identity including the ID token signature', async () => {
        vi.stubGlobal('fetch', googleFetch(idToken()));
        const identity = await exchangeProviderCode(
            'google',
            `state=${attempt.state}&code=synthetic-code`,
            attempt,
        );
        expect(identity.subject).toBe('stable-subject');
        expect(identity.emailVerified).toBe(true);
    });
    it.each([
        { iss: 'https://untrusted.example' },
        { aud: 'different-client' },
        { exp: 1 },
        { nonce: 'different-nonce' },
    ])('rejects invalid Google claims %#', async (overrides) => {
        vi.stubGlobal('fetch', googleFetch(idToken(overrides)));
        let rejected = false;
        try {
            await exchangeProviderCode(
                'google',
                `state=${attempt.state}&code=synthetic-code`,
                attempt,
            );
        } catch {
            rejected = true;
        }
        expect(rejected).toBe(true);
    });
    it('rejects an invalid signature', async () => {
        vi.stubGlobal('fetch', googleFetch(idToken({}, true)));
        let rejected = false;
        try {
            await exchangeProviderCode(
                'google',
                `state=${attempt.state}&code=synthetic-code`,
                attempt,
            );
        } catch {
            rejected = true;
        }
        expect(rejected).toBe(true);
    });
    it('rejects mismatched callback state before fetching tokens', async () => {
        const fetchMock = googleFetch(idToken());
        vi.stubGlobal('fetch', fetchMock);
        let rejected = false;
        try {
            await exchangeProviderCode('google', 'state=wrong&code=synthetic-code', attempt);
        } catch {
            rejected = true;
        }
        expect(rejected).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each([undefined, 'https://github.com/login/oauth'])(
        'accepts GitHub callbacks with issuer %s and retrieves verified private email',
        async (issuer) => {
            const fetchMock = vi.fn(async (url: unknown) => {
                if (String(url).includes('/user/emails'))
                    return Response.json([
                        { email: 'private@example.test', primary: true, verified: true },
                    ]);
                if (String(url).endsWith('/user')) return Response.json({ id: 123, email: null });
                return Response.json({
                    access_token: 'synthetic-access',
                    token_type: 'bearer',
                    scope: 'user:email',
                });
            });
            vi.stubGlobal('fetch', fetchMock);
            const identity = await exchangeProviderCode(
                'github',
                new URLSearchParams({
                    state: attempt.state,
                    code: 'synthetic-code',
                    ...(issuer ? { iss: issuer } : {}),
                }).toString(),
                { ...attempt, redirectUri: attempt.redirectUri.replace('google', 'github') },
            );
            expect(identity.subject).toBe('123');
            expect(identity.email).toBe('private@example.test');
            expect(identity.emailVerified).toBe(true);
        },
    );
    it.each(['https://github.com', 'https://untrusted.example'])(
        'rejects the incorrect GitHub callback issuer %s before fetching tokens',
        async (issuer) => {
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            const reason = await exchangeProviderCode(
                'github',
                new URLSearchParams({
                    state: attempt.state,
                    code: 'synthetic-code',
                    iss: issuer,
                }).toString(),
                { ...attempt, redirectUri: attempt.redirectUri.replace('google', 'github') },
            ).then(() => 'not-rejected', safeOAuthReason);
            expect(reason).toBe('callback_issuer_mismatch');
            expect(fetchMock).not.toHaveBeenCalled();
        },
    );
    it.each([
        'incorrect_client_credentials',
        'bad_verification_code',
        'redirect_uri_mismatch',
        'unverified_user_email',
    ])('preserves GitHub HTTP-200 error category %s', async (error) => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                Response.json({ error, error_description: 'private upstream details' }),
            ),
        );
        let reason = 'not-rejected';
        try {
            await exchangeProviderCode('github', `state=${attempt.state}&code=synthetic-code`, {
                ...attempt,
                redirectUri: attempt.redirectUri.replace('google', 'github'),
            });
        } catch (failure) {
            reason = safeOAuthReason(failure);
        }
        expect(reason).toBe(error);
    });

    it('disables incomplete/unsafe provider configuration without changing boot policy', () => {
        vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
        expect(getProviderConfig('google')).toBeNull();
        vi.stubEnv('GOOGLE_CLIENT_SECRET', 'synthetic');
        vi.stubEnv('GOOGLE_CALLBACK_URL', 'http://external.example/api/auth/oauth/google/callback');
        expect(getProviderConfig('google')).toBeNull();
    });
});
