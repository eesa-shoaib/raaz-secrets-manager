import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from './app-error.js';

const cursorPayloadSchema = z.object({
    scope: z.string().min(1),
    createdAt: z.string().datetime(),
    id: z.string().regex(/^[a-f\d]{24}$/i),
});

export interface DecodedCursor {
    createdAt: Date;
    id: Types.ObjectId;
}

export function encodeCursor(scope: string, createdAt: Date | string, id: string): string {
    const iso =
        createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
    const payload = JSON.stringify({ scope, createdAt: iso, id });
    return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string, expectedScope: string): DecodedCursor {
    try {
        const json = Buffer.from(cursor, 'base64url').toString('utf8');
        const parsed = cursorPayloadSchema.parse(JSON.parse(json));
        if (parsed.scope !== expectedScope) {
            throw new AppError(
                422,
                'VALIDATION_ERROR',
                'Pagination cursor does not match request scope',
            );
        }
        const date = new Date(parsed.createdAt);
        if (Number.isNaN(date.getTime())) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Invalid pagination cursor');
        }
        return {
            createdAt: date,
            id: new Types.ObjectId(parsed.id),
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid pagination cursor');
    }
}

export function buildCursorCondition(decoded: DecodedCursor): Record<string, unknown> {
    return {
        $or: [
            { createdAt: { $lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, _id: { $lt: decoded.id } },
        ],
    };
}

export function buildScopedCursorCondition(
    decoded: DecodedCursor,
    idField: '_id' | 'projectId' = '_id',
): Record<string, unknown> {
    return {
        $or: [
            { createdAt: { $lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, [idField]: { $lt: decoded.id } },
        ],
    };
}

const adminUsersCursorPayloadSchema = z.object({
    scope: z.literal('admin:users'),
    isPlatformAdmin: z.boolean(),
    createdAt: z.string().datetime(),
    id: z.string().regex(/^[a-f\d]{24}$/i),
});

export interface DecodedAdminUsersCursor {
    isPlatformAdmin: boolean;
    createdAt: Date;
    id: Types.ObjectId;
}

export function encodeAdminUsersCursor(
    isPlatformAdmin: boolean,
    createdAt: Date | string,
    id: string,
): string {
    const iso =
        createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
    return Buffer.from(
        JSON.stringify({ scope: 'admin:users', isPlatformAdmin, createdAt: iso, id }),
        'utf8',
    ).toString('base64url');
}

export function decodeAdminUsersCursor(cursor: string): DecodedAdminUsersCursor {
    try {
        const json = Buffer.from(cursor, 'base64url').toString('utf8');
        const parsed = adminUsersCursorPayloadSchema.parse(JSON.parse(json));
        const date = new Date(parsed.createdAt);
        if (Number.isNaN(date.getTime())) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Invalid pagination cursor');
        }
        return {
            isPlatformAdmin: parsed.isPlatformAdmin,
            createdAt: date,
            id: new Types.ObjectId(parsed.id),
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid pagination cursor');
    }
}

export function buildAdminUsersCursorCondition(
    decoded: DecodedAdminUsersCursor,
): Record<string, unknown> {
    if (decoded.isPlatformAdmin) {
        return {
            $or: [
                { isPlatformAdmin: true, createdAt: { $lt: decoded.createdAt } },
                { isPlatformAdmin: true, createdAt: decoded.createdAt, _id: { $lt: decoded.id } },
                { isPlatformAdmin: false },
            ],
        };
    }
    return {
        $or: [
            { isPlatformAdmin: false, createdAt: { $lt: decoded.createdAt } },
            { isPlatformAdmin: false, createdAt: decoded.createdAt, _id: { $lt: decoded.id } },
        ],
    };
}

export function escapeRegex(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
