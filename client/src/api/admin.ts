import type {
    AuditLogEntryResponse,
    AuditResult,
    CursorPaginatedResponse,
    PlatformAuditAction,
    PublicUser,
    UpdateUserInput,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export interface AdminUsersParams {
    cursor?: string | null;
    limit?: number;
}

export interface AdminAuditParams {
    action?: PlatformAuditAction;
    result?: AuditResult;
    cursor?: string | null;
    limit?: number;
}

export async function getAdminUsers(
    params: AdminUsersParams = {},
): Promise<CursorPaginatedResponse<PublicUser>> {
    const query: Record<string, unknown> = {
        mode: 'cursor',
        limit: params.limit ?? 25,
    };
    if (params.cursor) {
        query.cursor = params.cursor;
    }
    const res = await apiClient.get<CursorPaginatedResponse<PublicUser>>('/admin/users', {
        params: query,
    });
    return res.data;
}

export async function updateAdminUser(userId: string, data: UpdateUserInput): Promise<PublicUser> {
    const res = await apiClient.patch<PublicUser | { user: PublicUser }>(
        `/admin/users/${userId}`,
        data,
    );
    const body = res.data as { user?: PublicUser } & PublicUser;
    return body.user ?? body;
}

export async function getAdminAuditLog(
    params: AdminAuditParams = {},
): Promise<CursorPaginatedResponse<AuditLogEntryResponse>> {
    const query: Record<string, unknown> = {
        mode: 'cursor',
        limit: params.limit ?? 25,
    };
    if (params.action) query.action = params.action;
    if (params.result) query.result = params.result;
    if (params.cursor) query.cursor = params.cursor;
    const res = await apiClient.get<CursorPaginatedResponse<AuditLogEntryResponse>>(
        '/admin/audit-log',
        { params: query },
    );
    return res.data;
}
