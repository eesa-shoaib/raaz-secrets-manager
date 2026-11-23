import * as oidc from 'openid-client';
import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
import { githubOAuthFetch } from '../utils/github-fetch.js';

const positive = z.number().int().positive().safe();
const handle = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/);
export const githubUserSchema = z.object({ id: positive, login: handle });
export const rawRepositorySchema = z.object({
    id: positive,
    name: handle,
    owner: z.object({ login: handle }),
    description: z.string().max(5000).nullable(),
    private: z.boolean(),
});
export const rawRepositoriesSchema = z.object({
    total_count: z.number().int().min(0),
    repositories: z.array(rawRepositorySchema).max(100),
});
export const rawInstallationsSchema = z.object({
    total_count: z.number().int().min(0),
    installations: z
        .array(
            z.object({
                id: positive,
                account: z.object({ login: handle }),
                repository_selection: z.enum(['all', 'selected']),
            }),
        )
        .max(100),
});
const tokenSchema = z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    expires_in: z.number().positive().optional(),
    refresh_token_expires_in: z.number().positive().optional(),
});
export type GitHubTokens = {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    refreshExpiresAt: number;
};

export function githubAppConfig() {
    const id = process.env.GITHUB_APP_CLIENT_ID;
    const secret = process.env.GITHUB_APP_CLIENT_SECRET;
    const slug = process.env.GITHUB_APP_SLUG;
    const callback = process.env.GITHUB_APP_CALLBACK_URL;
    if (!id || !secret || !slug || !/^[a-z0-9-]+$/.test(slug) || !callback) return null;
    try {
        const url = new URL(callback);
        if (
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            url.pathname !== '/api/integrations/github/callback'
        )
            return null;
        if (
            url.protocol !== 'https:' &&
            !(
                process.env.NODE_ENV !== 'production' &&
                ['localhost', '127.0.0.1'].includes(url.hostname) &&
                url.protocol === 'http:'
            )
        )
            return null;
        const config = new oidc.Configuration(
            {
                issuer: 'https://github.com/login/oauth',
                authorization_endpoint: 'https://github.com/login/oauth/authorize',
                token_endpoint: 'https://github.com/login/oauth/access_token',
            },
            id,
            secret,
        );
        config.timeout = 10;
        config[oidc.customFetch] = githubOAuthFetch;
        return { config, callback, manageUrl: `https://github.com/apps/${slug}/installations/new` };
    } catch {
        return null;
    }
}

export function requireGitHubApp() {
    const config = githubAppConfig();
    if (!config)
        throw new AppError(404, 'NOT_FOUND', 'GitHub repository imports are not configured');
    return config;
}

function tokensFromResponse(data: unknown): GitHubTokens {
    const result = tokenSchema.safeParse(data);
    if (!result.success) throw new AppError(409, 'CONFLICT', 'Reconnect GitHub to continue');
    const token = result.data;
    return {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + (token.expires_in ?? 28800) * 1000,
        refreshExpiresAt: token.refresh_token
            ? Date.now() + (token.refresh_token_expires_in ?? 0) * 1000
            : 0,
    };
}

export async function githubAuthorization(state: string, verifier: string) {
    const { config, callback } = requireGitHubApp();
    return oidc.buildAuthorizationUrl(config, {
        redirect_uri: callback,
        state,
        response_type: 'code',
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: 'S256',
    }).href;
}

export async function exchangeGitHubConnection(query: string, state: string, verifier: string) {
    const { config, callback } = requireGitHubApp();
    const url = new URL(callback);
    url.search = query;
    try {
        return tokensFromResponse(
            await oidc.authorizationCodeGrant(config, url, {
                expectedState: state,
                pkceCodeVerifier: verifier,
            }),
        );
    } catch {
        throw new AppError(409, 'CONFLICT', 'GitHub authorization failed. Connect again.');
    }
}

export async function refreshGitHubConnection(refreshToken: string) {
    const { config } = requireGitHubApp();
    try {
        return tokensFromResponse(await oidc.refreshTokenGrant(config, refreshToken));
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof oidc.ResponseBodyError) {
            if (error.status === 429)
                throw new AppError(
                    429,
                    'RATE_LIMITED',
                    'GitHub rate limit reached. Try again later.',
                );
            if (['invalid_grant', 'access_denied', 'bad_verification_code'].includes(error.error))
                throw new AppError(409, 'CONFLICT', 'Reconnect GitHub to continue');
        }
        throw new AppError(500, 'INTERNAL_ERROR', 'Unable to renew GitHub connection. Try again.');
    }
}

export async function githubRequest<T>(
    token: string,
    path: string,
    schema: z.ZodType<T>,
): Promise<T> {
    try {
        const response = await fetch(`https://api.github.com${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'Raaz',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            signal: AbortSignal.timeout(10000),
            redirect: 'error',
        });
        if (response.status === 401)
            throw new AppError(409, 'CONFLICT', 'Reconnect GitHub to continue');
        if (
            response.status === 429 ||
            (response.status === 403 &&
                (response.headers.get('x-ratelimit-remaining') === '0' ||
                    response.headers.has('retry-after')))
        )
            throw new AppError(429, 'RATE_LIMITED', 'GitHub rate limit reached. Try again later.');
        if (response.status === 404)
            throw new AppError(404, 'NOT_FOUND', 'GitHub resource is unavailable');
        if (response.status === 403)
            throw new AppError(
                403,
                'FORBIDDEN',
                'GitHub access needs installation or organization approval',
            );
        if (!response.ok)
            throw new AppError(500, 'INTERNAL_ERROR', 'GitHub is temporarily unavailable');
        const result = schema.safeParse(await response.json());
        if (!result.success)
            throw new AppError(500, 'INTERNAL_ERROR', 'GitHub returned an invalid response');
        return result.data;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'INTERNAL_ERROR', 'Unable to contact GitHub. Try again.');
    }
}
