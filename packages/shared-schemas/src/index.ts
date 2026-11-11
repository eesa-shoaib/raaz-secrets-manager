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

export const createCursorPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        nextCursor: z.string().nullable(),
        hasMore: z.boolean(),
        limit: z.number().int().min(1).max(100),
    });

export interface CursorPaginatedResponse<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
}
