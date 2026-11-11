import type { UpdateUserInput } from '@raaz/shared-schemas';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getAdminAuditLog,
    getAdminUsers,
    updateAdminUser,
    type AdminAuditParams,
    type AdminUsersParams,
} from '../api/admin';
import { isApiError } from '../lib/errorHandling';
import { queryKeys } from '../lib/queryClient';

export function useAdminUsers(params: AdminUsersParams = {}) {
    const limit = params.limit ?? 25;
    const cursor = params.cursor ?? null;

    return useQuery({
        queryKey: queryKeys.adminUsers({ cursor, limit }),
        queryFn: () => getAdminUsers({ cursor: cursor ?? undefined, limit }),
        placeholderData: keepPreviousData,
        retry: (failureCount, error: unknown) => {
            if (isApiError(error) && (error.status === 403 || error.status === 404)) {
                return false;
            }
            return failureCount < 1;
        },
    });
}

export function useUpdateAdminUser() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: UpdateUserInput }) =>
            updateAdminUser(userId, data),
        onSuccess: (updatedUser) => {
            qc.invalidateQueries({ queryKey: queryKeys.adminUsersPrefix });
            qc.invalidateQueries({ queryKey: queryKeys.adminAuditPrefix });
            qc.invalidateQueries({ queryKey: queryKeys.me });
            const currentMe = qc.getQueryData<{ id?: string } | null>(queryKeys.me);
            if (currentMe?.id === updatedUser.id) {
                qc.setQueryData(queryKeys.me, updatedUser);
            }
        },
    });
}

export function useAdminAuditLog(params: AdminAuditParams = {}, enabled = true) {
    const limit = params.limit ?? 25;
    const cursor = params.cursor ?? null;

    return useQuery({
        queryKey: queryKeys.adminAudit({
            action: params.action,
            result: params.result,
            cursor,
            limit,
        }),
        queryFn: () =>
            getAdminAuditLog({
                action: params.action,
                result: params.result,
                cursor: cursor ?? undefined,
                limit,
            }),
        enabled,
        placeholderData: keepPreviousData,
        retry: (failureCount, error: unknown) => {
            if (isApiError(error) && (error.status === 403 || error.status === 404)) {
                return false;
            }
            return failureCount < 1;
        },
    });
}
