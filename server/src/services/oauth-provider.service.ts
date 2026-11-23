import type { OAuthProvider } from '@raaz/shared-schemas';
import * as oidc from 'openid-client';
import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
import { githubOAuthFetch } from '../utils/github-fetch.js';
import { diagnoseOAuthStage, OAuthHttpFailure } from './oauth-diagnostics.service.js';

export interface ProviderIdentity {
    provider: OAuthProvider;
    subject: string;
    email: string;
    emailVerified: boolean;
    login?: string;
}

export function getProviderConfig(provider: OAuthProvider) {
    const prefix = provider.toUpperCase();
    const clientId = process.env[`${prefix}_CLIENT_ID`];
    const secret = process.env[`${prefix}_CLIENT_SECRET`];
    const redirectUri = process.env[`${prefix}_CALLBACK_URL`];
    if (!clientId || !secret || !redirectUri) return null;
    try {
        const redirect = new URL(redirectUri);
        const local = ['localhost', '127.0.0.1'].includes(redirect.hostname);
        if (
            redirect.protocol !== 'https:' &&
            !(process.env.NODE_ENV !== 'production' && local && redirect.protocol === 'http:')
        )
            return null;
        if (
            redirect.username ||
            redirect.password ||
            redirect.search ||
            redirect.hash ||
            redirect.pathname !== `/api/auth/oauth/${provider}/callback`
        )
            return null;
    } catch {
        return null;
    }
    const metadata =
        provider === 'google'
            ? {
                  issuer: 'https://accounts.google.com',
                  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
                  token_endpoint: 'https://oauth2.googleapis.com/token',
                  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
              }
            : {
                  issuer: 'https://github.com/login/oauth',
                  authorization_endpoint: 'https://github.com/login/oauth/authorize',
                  token_endpoint: 'https://github.com/login/oauth/access_token',
              };
    let config: oidc.Configuration;
    try {
        config = new oidc.Configuration(metadata, clientId, secret);
    } catch {
        return null;
    }
    config.timeout = 10;
    if (provider === 'github') config[oidc.customFetch] = githubOAuthFetch;
    if (provider === 'google') oidc.enableNonRepudiationChecks(config);
    return { config, redirectUri };
}

export function requireProvider(provider: OAuthProvider) {
    const configured = getProviderConfig(provider);
    if (!configured) throw new AppError(404, 'NOT_FOUND', 'Sign-in provider is unavailable');
    return configured;
}

export async function buildProviderAuthorization(
    provider: OAuthProvider,
    state: string,
    verifier: string,
    nonce: string,
) {
    const { config, redirectUri } = requireProvider(provider);
    return oidc.buildAuthorizationUrl(config, {
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: provider === 'google' ? 'openid email' : 'user:email',
        state,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
        ...(provider === 'google' ? { nonce, prompt: 'select_account' } : {}),
    }).href;
}

export async function exchangeProviderCode(
    provider: OAuthProvider,
    query: string,
    attempt: {
        state: string;
        verifier: string;
        nonce: string;
        redirectUri: string;
    },
): Promise<ProviderIdentity> {
    const { config, redirectUri } = requireProvider(provider);
    if (redirectUri !== attempt.redirectUri) throw new Error('OAuth configuration changed');
    const callback = new URL(redirectUri);
    callback.search = query;
    const tokens = await diagnoseOAuthStage(provider, 'token_exchange', () =>
        oidc.authorizationCodeGrant(config, callback, {
            expectedState: attempt.state,
            pkceCodeVerifier: attempt.verifier,
            ...(provider === 'google'
                ? { expectedNonce: attempt.nonce, idTokenExpected: true }
                : {}),
        }),
    );
    if (provider === 'google') {
        const claims = await diagnoseOAuthStage(provider, 'identity', async () =>
            z
                .object({
                    sub: z.string().min(1).max(255),
                    email: z.string().email().max(255),
                    email_verified: z.boolean(),
                })
                .parse(tokens.claims()),
        );
        return {
            provider,
            subject: claims.sub,
            email: claims.email.toLowerCase(),
            emailVerified: claims.email_verified,
        };
    }
    const headers = {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Raaz',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    async function get(path: string): Promise<unknown> {
        const response = await fetch(`https://api.github.com${path}`, {
            headers,
            signal: AbortSignal.timeout(10000),
            redirect: 'error',
        });
        if (!response.ok) throw new OAuthHttpFailure(response.status);
        return response.json();
    }
    const user = await diagnoseOAuthStage(provider, 'identity', async () =>
        z
            .object({
                id: z.number().int().positive().safe(),
                login: z.string().min(1).max(100),
            })
            .parse(await get('/user')),
    );
    const emails = await diagnoseOAuthStage(provider, 'email_lookup', async () =>
        z
            .array(
                z.object({
                    email: z.string().email().max(255),
                    primary: z.boolean(),
                    verified: z.boolean(),
                }),
            )
            .max(100)
            .parse(await get('/user/emails?per_page=100')),
    );
    const email = emails.find((entry) => entry.primary && entry.verified);
    return {
        provider,
        subject: String(user.id),
        email: email?.email.toLowerCase() ?? '',
        emailVerified: Boolean(email),
        login: user.login,
    };
}
