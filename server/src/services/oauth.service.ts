import { createHash, randomBytes } from 'node:crypto';
import { emailSchema, type OAuthProvider } from '@raaz/shared-schemas';
import mongoose from 'mongoose';
import { OAuthAttemptModel } from '../models/OAuthAttempt.js';
import { OAuthIdentityModel } from '../models/OAuthIdentity.js';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/app-error.js';
import { writeAuditEntry } from './audit.service.js';
import { assertSignupDomainAllowed, issueToken, verifyToken } from './auth.service.js';
import { logOAuthFailure, type OAuthFailureReason } from './oauth-diagnostics.service.js';
import {
    buildProviderAuthorization,
    exchangeProviderCode,
    getProviderConfig,
    requireProvider,
    type ProviderIdentity,
} from './oauth-provider.service.js';
import { deactivateVerifiedAccount } from './profile.service.js';

export class OAuthCallbackError extends Error {
    constructor(public readonly reason: 'failed' | 'last-admin') {
        super('Provider confirmation failed');
    }
}

export const OAUTH_TTL_MS = 10 * 60 * 1000;
export const hashOAuthSecret = (value: string) => createHash('sha256').update(value).digest('hex');
export const oauthCookieName = (provider: OAuthProvider) => `raaz_oauth_${provider}`;
export const oauthCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth/oauth',
    maxAge: OAUTH_TTL_MS,
});
export const enabledProviders = () =>
    (['google', 'github'] as const).filter((provider) => Boolean(getProviderConfig(provider)));
class OAuthAccountFailure extends AppError {
    constructor(readonly reason: OAuthFailureReason | 'provider_rejected') {
        super(
            401,
            'UNAUTHENTICATED',
            'Unable to sign in. Try again or use your original sign-in method.',
        );
    }
}
const failure = (reason: OAuthFailureReason | 'provider_rejected' = 'authorization_rejected') =>
    new OAuthAccountFailure(reason);

export async function startOAuth(provider: OAuthProvider, initiatingToken?: string) {
    const { redirectUri } = requireProvider(provider);
    await OAuthAttemptModel.init();
    let userId: string | undefined;
    let tokenVersion: number | undefined;
    if (initiatingToken !== undefined) {
        const claims = verifyToken(initiatingToken);
        if (!claims) throw failure();
        const user = await UserModel.findOne({
            _id: claims.sub,
            tokenVersion: claims.tv,
            isActive: true,
        }).lean();
        if (!user || user.passwordEnabled !== false || user.oauthProvider !== provider)
            throw failure();
        userId = user._id.toString();
        tokenVersion = user.tokenVersion;
    }
    const state = randomBytes(32).toString('base64url');
    const binding = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const authorizationUrl = await buildProviderAuthorization(provider, state, verifier, nonce);
    await OAuthAttemptModel.create({
        provider,
        state,
        bindingHash: hashOAuthSecret(binding),
        verifier,
        nonce,
        redirectUri,
        intent: userId ? 'deactivate' : 'login',
        userId,
        tokenVersion,
        sessionHash: initiatingToken ? hashOAuthSecret(initiatingToken) : undefined,
        expiresAt: new Date(Date.now() + OAUTH_TTL_MS),
    });
    return { authorizationUrl, binding };
}

export async function resolveOAuthUser(identity: ProviderIdentity) {
    await Promise.all([OAuthIdentityModel.init(), UserModel.init()]);
    // Returning accounts are identified exclusively by the stable provider subject.
    const session = await mongoose.startSession();
    let userId: string | undefined;
    try {
        await session.withTransaction(async () => {
            const linked = await OAuthIdentityModel.findOne({
                provider: identity.provider,
                subject: identity.subject,
            })
                .session(session)
                .lean();
            if (linked) {
                const user = await UserModel.findOne({ _id: linked.userId, isActive: true })
                    .session(session)
                    .lean();
                if (!user) throw failure('inactive_account');
                userId = user._id.toString();
                return;
            }
            const email = emailSchema.safeParse(identity.email);
            if (!identity.emailVerified || !email.success) throw failure('invalid_email');
            try {
                assertSignupDomainAllowed(email.data);
            } catch {
                throw failure('signup_domain_not_allowed');
            }
            if (await UserModel.exists({ email: email.data }).session(session))
                throw failure('account_exists');
            const [user] = await UserModel.create(
                [
                    {
                        email: email.data,
                        passwordHash: null,
                        passwordEnabled: false,
                        oauthProvider: identity.provider,
                        isPlatformAdmin: false,
                        isActive: true,
                        tokenVersion: 0,
                    },
                ],
                { session },
            );
            await OAuthIdentityModel.create(
                [{ provider: identity.provider, subject: identity.subject, userId: user!._id }],
                { session },
            );
            await writeAuditEntry({
                session,
                userId: user!._id.toString(),
                action: 'oauth_registered',
                result: 'allowed',
            });
            userId = user!._id.toString();
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)
            throw failure('account_conflict');
        throw new AppError(500, 'INTERNAL_ERROR', 'Unable to complete account registration');
    } finally {
        await session.endSession();
    }
    const user = await UserModel.findOne({ _id: userId, isActive: true }).lean();
    if (!user) throw failure('inactive_account');
    return issueToken(user._id.toString(), user.tokenVersion, user.isPlatformAdmin);
}

export async function completeOAuth(
    provider: OAuthProvider,
    state: string,
    binding: unknown,
    query: string,
    sessionToken: unknown,
) {
    if (typeof binding !== 'string' || binding.length !== 43) {
        logOAuthFailure(provider, 'attempt', 'missing_browser_binding');
        throw failure();
    }
    const attempt = await OAuthAttemptModel.findOneAndDelete({
        provider,
        state,
        bindingHash: hashOAuthSecret(binding),
        expiresAt: { $gt: new Date() },
    })
        .select('+state +verifier +nonce +bindingHash +sessionHash')
        .lean();
    if (!attempt) {
        logOAuthFailure(provider, 'attempt', 'attempt_rejected');
        throw failure();
    }
    try {
        let identity: ProviderIdentity;
        try {
            identity = await exchangeProviderCode(provider, query, attempt);
        } catch {
            if (attempt.intent === 'deactivate') throw new OAuthCallbackError('failed');
            throw failure('provider_rejected');
        }
        if (attempt.intent === 'deactivate') {
            if (
                typeof sessionToken !== 'string' ||
                hashOAuthSecret(sessionToken) !== attempt.sessionHash
            )
                throw failure();
            const claims = verifyToken(sessionToken);
            if (
                !claims ||
                claims.sub !== attempt.userId?.toString() ||
                claims.tv !== attempt.tokenVersion
            )
                throw failure();
            const linked = await OAuthIdentityModel.findOne({
                provider,
                subject: identity.subject,
                userId: attempt.userId,
            }).lean();
            if (!linked) throw failure();
            await deactivateVerifiedAccount(claims.sub, claims.tv);
            return { deactivated: true as const };
        }
        return { deactivated: false as const, token: await resolveOAuthUser(identity) };
    } catch (error) {
        if (
            !(error instanceof OAuthCallbackError) &&
            !(error instanceof OAuthAccountFailure && error.reason === 'provider_rejected')
        ) {
            logOAuthFailure(
                provider,
                'account',
                error instanceof OAuthAccountFailure && error.reason !== 'provider_rejected'
                    ? error.reason
                    : error instanceof AppError && error.status < 500
                      ? 'authorization_rejected'
                      : 'internal_failure',
            );
        }
        if (error instanceof OAuthCallbackError) throw error;
        if (!(error instanceof AppError) || error.status === 500)
            throw new AppError(500, 'INTERNAL_ERROR', 'Unable to complete authentication');
        if (attempt.intent === 'deactivate')
            throw new OAuthCallbackError(
                error instanceof AppError && error.status === 409 ? 'last-admin' : 'failed',
            );
        throw failure();
    }
}
