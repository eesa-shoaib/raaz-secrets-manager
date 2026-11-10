import type {
    CursorPaginatedResponse,
    PublicUser,
    UpdateUserInput,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export interface AdminUsersParams {
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

export async function updateAdminUser(
    userId: string,
    data: UpdateUserInput,
): Promise<PublicUser> {
    const res = await apiClient.patch<PublicUser | { user: PublicUser }>(
        `/admin/users/${userId}`,
        data,
    );
    const body = res.data as { user?: PublicUser } & PublicUser;
    return body.user ?? body;
}
