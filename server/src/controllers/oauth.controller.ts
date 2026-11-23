import {
    oauthCallbackRequestSchema,
    oauthProviderSchema,
    oauthProvidersResponseSchema,
    oauthStartResponseSchema,
} from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import { getClientOrigin } from '../config/index.js';
import { clearAuthCookie, setAuthCookie } from '../services/auth.service.js';
import { logOAuthFailure } from '../services/oauth-diagnostics.service.js';
import {
    completeOAuth,
    enabledProviders,
    oauthCookieName,
    oauthCookieOptions,
    OAuthCallbackError,
    startOAuth,
} from '../services/oauth.service.js';
import { AppError } from '../utils/app-error.js';

export function oauthProvidersController(_req: Request, res: Response) {
    res.json(oauthProvidersResponseSchema.parse({ providers: enabledProviders() }));
}
export async function oauthStartController(req: Request, res: Response) {
    const provider = oauthProviderSchema.parse(req.params.provider);
    const result = await startOAuth(provider);
    res.cookie(oauthCookieName(provider), result.binding, oauthCookieOptions());
    res.json(oauthStartResponseSchema.parse(result));
}
export async function oauthDeactivateStartController(req: Request, res: Response) {
    const provider = oauthProviderSchema.parse(req.params.provider);
    const result = await startOAuth(provider, req.cookies.token);
    res.cookie(oauthCookieName(provider), result.binding, oauthCookieOptions());
    res.json(oauthStartResponseSchema.parse(result));
}
export async function oauthCallbackController(req: Request, res: Response) {
    const provider = oauthProviderSchema.parse(req.params.provider);
    res.clearCookie(oauthCookieName(provider), { ...oauthCookieOptions(), maxAge: 0 });
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
        const parsed = oauthCallbackRequestSchema.safeParse({
            params: req.params,
            query: req.query,
        });
        if (!parsed.success) {
            logOAuthFailure(provider, 'callback', 'invalid_callback');
            throw new Error('Invalid callback');
        }
        const result = await completeOAuth(
            provider,
            parsed.data.query.state,
            req.cookies[oauthCookieName(provider)],
            req.originalUrl.split('?').slice(1).join('?'),
            req.cookies.token,
        );
        if (result.deactivated) {
            clearAuthCookie(res);
            res.redirect(303, `${getClientOrigin()}/login?oauth=deactivated`);
        } else {
            setAuthCookie(res, result.token);
            res.redirect(303, `${getClientOrigin()}/projects`);
        }
    } catch (error) {
        if (error instanceof AppError && error.status === 500) throw error;
        const path =
            error instanceof OAuthCallbackError
                ? `/settings?oauth=${error.reason}`
                : '/login?oauth=failed';
        res.redirect(303, `${getClientOrigin()}${path}`);
    }
}
