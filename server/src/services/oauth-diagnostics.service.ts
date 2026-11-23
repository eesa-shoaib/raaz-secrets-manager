import type { OAuthProvider } from '@raaz/shared-schemas';
import { logger } from './boot-validation.service.js';

type OAuthStage =
    'callback' | 'attempt' | 'token_exchange' | 'identity' | 'email_lookup' | 'account';
const safeReasons = [
    'incorrect_client_credentials',
    'bad_verification_code',
    'redirect_uri_mismatch',
    'unverified_user_email',
    'access_denied',
    'invalid_client',
    'invalid_grant',
    'OAUTH_INVALID_RESPONSE',
    'callback_state_missing',
    'callback_state_mismatch',
    'callback_parameter_repeated',
    'callback_issuer_missing',
    'callback_issuer_mismatch',
    'callback_code_missing',
    'token_access_token_missing',
    'token_type_missing',
    'OAUTH_RESPONSE_IS_NOT_JSON',
    'OAUTH_RESPONSE_BODY_ERROR',
    'OAUTH_AUTHORIZATION_RESPONSE_ERROR',
    'OAUTH_JWT_CLAIM_COMPARISON_FAILED',
    'OAUTH_JWT_TIMESTAMP_CHECK_FAILED',
    'OAUTH_KEY_SELECTION_FAILED',
    'OAUTH_UNSUPPORTED_OPERATION',
    'TimeoutError',
    'AbortError',
    'ENOTFOUND',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'http_401',
    'http_403',
    'http_404',
    'http_429',
    'http_500',
    'http_502',
    'http_503',
    'invalid_callback',
    'missing_browser_binding',
    'attempt_rejected',
    'invalid_identity',
    'invalid_email',
    'account_exists',
    'inactive_account',
    'signup_domain_not_allowed',
    'account_conflict',
    'authorization_rejected',
    'internal_failure',
    'unknown',
] as const;
export type OAuthFailureReason = (typeof safeReasons)[number];
const allowed = new Set<string>(safeReasons);

const knownLibraryMessages: Readonly<Record<string, OAuthFailureReason>> = {
    'response parameter "state" missing': 'callback_state_missing',
    'unexpected "state" response parameter value': 'callback_state_mismatch',
    '"state" parameter must be provided only once': 'callback_parameter_repeated',
    '"code" parameter must be provided only once': 'callback_parameter_repeated',
    'response parameter "iss" (issuer) missing': 'callback_issuer_missing',
    'unexpected "iss" (issuer) response parameter value': 'callback_issuer_mismatch',
    '"parameters" does not contain an Authorization Code': 'callback_code_missing',
    '"response" body "access_token" property must be a string': 'token_access_token_missing',
    '"response" body "access_token" property must not be empty': 'token_access_token_missing',
    '"response" body "token_type" property must be a string': 'token_type_missing',
    '"response" body "token_type" property must not be empty': 'token_type_missing',
};

export function safeOAuthReason(error: unknown): OAuthFailureReason {
    // Only allowlisted codes and fixed library messages are classified. Never serialize exceptions, messages,
    // URLs, headers, response bodies, provider tokens, email or provider subjects.
    let value = error;
    let fallback: OAuthFailureReason = 'unknown';
    for (let depth = 0; depth < 4 && value && typeof value === 'object'; depth++) {
        const record = value as Record<string, unknown>;
        if (
            typeof record.message === 'string' &&
            Object.prototype.hasOwnProperty.call(knownLibraryMessages, record.message)
        )
            return knownLibraryMessages[record.message]!;
        if (record.name === 'ZodError') return 'invalid_identity';
        for (const field of ['error', 'code', 'name']) {
            const candidate = record[field];
            if (typeof candidate === 'string' && allowed.has(candidate)) {
                if (!candidate.startsWith('OAUTH_')) return candidate as OAuthFailureReason;
                fallback = candidate as OAuthFailureReason;
            }
        }
        value = record.cause;
    }
    return fallback;
}

export function logOAuthFailure(
    provider: OAuthProvider,
    stage: OAuthStage,
    reason: OAuthFailureReason,
) {
    logger.warn({ event: 'oauth_failure', provider, stage, reason }, 'OAuth sign-in failed');
}

export async function diagnoseOAuthStage<T>(
    provider: OAuthProvider,
    stage: OAuthStage,
    action: () => Promise<T>,
): Promise<T> {
    try {
        return await action();
    } catch (error) {
        logOAuthFailure(provider, stage, safeOAuthReason(error));
        throw error;
    }
}

export class OAuthHttpFailure extends Error {
    readonly code: string;
    constructor(status: number) {
        super('Provider request failed');
        this.code = `http_${status}`;
    }
}
