import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    exchangeGitHubConnection,
    githubAppConfig,
    githubAuthorization,
    githubRequest,
    refreshGitHubConnection,
} from './github-provider.service.js';

beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'synthetic-app-client');
    vi.stubEnv('GITHUB_APP_CLIENT_SECRET', randomBytes(16).toString('hex'));
    vi.stubEnv('GITHUB_APP_SLUG', 'raaz-test');
    vi.stubEnv('GITHUB_APP_CALLBACK_URL', 'http://localhost:5173/api/integrations/github/callback');
});
afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('GitHub App provider boundary', () => {
    it('uses the separate App client and PKCE without requesting repository scopes', async () => {
        const url = new URL(await githubAuthorization('expected-state', 'v'.repeat(43)));
        expect(url.searchParams.get('client_id')).toBe('synthetic-app-client');
        expect(url.searchParams.get('scope')).toBeNull();
        expect(url.searchParams.get('code_challenge_method')).toBe('S256');
        expect(url.searchParams.get('code_challenge')?.length).toBe(43);
        vi.stubEnv('GITHUB_APP_CLIENT_SECRET', '');
        expect(githubAppConfig()).toBeNull();
    });
    it.each([
        'https://untrusted.example/callback',
        'http://external.example/api/integrations/github/callback',
        'https://example.test/api/integrations/github/callback?next=other',
    ])('disables malformed callback configuration %s', (callback) => {
        vi.stubEnv('GITHUB_APP_CALLBACK_URL', callback);
        expect(githubAppConfig()).toBeNull();
    });
    it('rejects callback state or issuer mismatches before fetching a token', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        for (const query of [
            'state=wrong&code=example',
            'state=expected&code=example&iss=https%3A%2F%2Funtrusted.example',
        ]) {
            await expect(
                exchangeGitHubConnection(query, 'expected', 'v'.repeat(43)),
            ).rejects.toMatchObject({ status: 409 });
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each([
        [401, 409],
        [403, 403],
        [404, 404],
        [429, 429],
        [503, 500],
    ])(
        'sanitizes provider status %s without exposing payloads',
        async (remoteStatus, localStatus) => {
            const sensitive = randomBytes(32).toString('hex');
            vi.stubGlobal(
                'fetch',
                vi.fn(async () => Response.json({ message: sensitive }, { status: remoteStatus })),
            );
            try {
                await githubRequest(sensitive, '/user', z.object({ id: z.number() }));
                throw new Error('Expected provider error');
            } catch (error) {
                expect(error).toMatchObject({ status: localStatus });
                expect(String(error).includes(sensitive)).toBe(false);
            }
        },
    );
    it('maps secondary rate limits to retryable rate guidance', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json({}, { status: 403, headers: { 'retry-after': '60' } })),
        );
        await expect(githubRequest('synthetic', '/user', z.unknown())).rejects.toMatchObject({
            status: 429,
        });
    });
    it('distinguishes expired refresh grants from transport failures', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => Response.json({ error: 'invalid_grant' })),
        );
        await expect(refreshGitHubConnection('synthetic-refresh')).rejects.toMatchObject({
            status: 409,
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('Synthetic transport failure');
            }),
        );
        await expect(refreshGitHubConnection('synthetic-refresh')).rejects.toMatchObject({
            status: 500,
        });
    });
});
