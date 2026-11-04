import { z } from 'zod';

export * from './user.js';
export * from './project.js';
export * from './secret.js';
export * from './auditLog.js';

export const apiErrorCodeEnum = z.enum([
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'VALIDATION_ERROR',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeEnum>;
export const apiErrorResponseSchema = z.object({
    error: z.object({ code: apiErrorCodeEnum, message: z.string() }),
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
