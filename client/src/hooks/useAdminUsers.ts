import type { UpdateUserInput } from '@raaz/shared-schemas';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { getAdminUsers, updateAdminUser, type AdminUsersParams } from '../api/admin';
import { isApiError } from '../lib/errorHandling';
import { queryClient, queryKeys } from '../lib/queryClient';

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
    return useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: UpdateUserInput }) =>
            updateAdminUser(userId, data),
        onSuccess: (updatedUser) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.adminUsersPrefix });
            queryClient.invalidateQueries({ queryKey: queryKeys.me });
            const currentMe = queryClient.getQueryData<{ id?: string } | null>(queryKeys.me);
            if (currentMe?.id === updatedUser.id) {
                queryClient.setQueryData(queryKeys.me, updatedUser);
            }
        },
    });
}
