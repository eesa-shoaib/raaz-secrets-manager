import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from './boot-validation.service.js';
import {
    diagnoseOAuthStage,
    logOAuthFailure,
    safeOAuthReason,
} from './oauth-diagnostics.service.js';

afterEach(() => {
    vi.restoreAllMocks();
});
describe('safe OAuth diagnostics', () => {
    it('extracts only an allowlisted provider error from the library cause', () => {
        expect(
            safeOAuthReason({
                code: 'OAUTH_RESPONSE_BODY_ERROR',
                cause: {
                    error: 'incorrect_client_credentials',
                    error_description: 'sensitive upstream text',
                },
            }),
        ).toBe('incorrect_client_credentials');
    });
    it('redacts arbitrary codes/messages and only categorizes known transport failures', () => {
        expect(
            safeOAuthReason({
                error: 'arbitrary-private-value',
                message: 'private payload',
                cause: { code: 'another-private-value' },
            }),
        ).toBe('unknown');
        expect(safeOAuthReason({ cause: { code: 'ENOTFOUND' } })).toBe('ENOTFOUND');
        expect(safeOAuthReason({ name: 'TimeoutError' })).toBe('TimeoutError');
        expect(safeOAuthReason(null)).toBe('unknown');
    });
    it('logs only provider, stage and safe reason without serializing the exception', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const privateError = {
            code: 'OAUTH_RESPONSE_BODY_ERROR',
            cause: {
                error: 'bad_verification_code',
                access_token: 'private-token',
                code: 'private-code',
                email: 'private@example.test',
            },
            message: 'private diagnostic',
        };
        try {
            await diagnoseOAuthStage('github', 'token_exchange', async () => {
                throw privateError;
            });
        } catch {
            /* Original rejection remains available to the generic callback handler. */
        }
        expect(warn).toHaveBeenCalledWith(
            {
                event: 'oauth_failure',
                provider: 'github',
                stage: 'token_exchange',
                reason: 'bad_verification_code',
            },
            'OAuth sign-in failed',
        );
        const logged = JSON.stringify(warn.mock.calls);
        expect(logged.includes('private-')).toBe(false);
        expect(logged.includes('private@')).toBe(false);
    });
    it('maps fixed library validation messages without exposing raw callback parameters', () => {
        expect(
            safeOAuthReason({
                code: 'OAUTH_INVALID_RESPONSE',
                cause: {
                    message: 'response parameter "state" missing',
                    cause: { code: 'private-code' },
                },
            }),
        ).toBe('callback_state_missing');
        expect(
            safeOAuthReason({
                code: 'OAUTH_INVALID_RESPONSE',
                cause: { message: 'arbitrary-private-value' },
            }),
        ).toBe('OAUTH_INVALID_RESPONSE');
        expect(safeOAuthReason({ message: 'toString' })).toBe('unknown');
    });

    it('does not log successful steps', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        expect(await diagnoseOAuthStage('github', 'identity', async () => true)).toBe(true);
        expect(warn).not.toHaveBeenCalled();
        logOAuthFailure('github', 'attempt', 'missing_browser_binding');
        expect(warn).toHaveBeenCalledTimes(1);
    });
});
