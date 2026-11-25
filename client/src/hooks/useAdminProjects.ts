import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
    getAdminProjectAuditLog,
    getAdminProjects,
    setAdminProjectStatus,
    deleteProject,
    type AdminProjectAuditParams,
    type AdminProjectFilters,
} from '../api/adminProjects';
import { isApiError } from '../lib/errorHandling';
import { queryKeys } from '../lib/queryClient';
export function useAdminProjects(filters: AdminProjectFilters) {
    return useQuery({
        queryKey: ['adminProjects', filters],
        queryFn: () => getAdminProjects(filters),
        placeholderData: keepPreviousData,
    });
}
export function useAdminProjectAuditLog(
    params: AdminProjectAuditParams = {},
    enabled = true,
) {
    const limit = params.limit ?? 25;
    const cursor = params.cursor ?? null;
    return useQuery({
        queryKey: ['adminProjects', 'audit', { ...params, cursor, limit }],
        queryFn: () =>
            getAdminProjectAuditLog({
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
export function useSetAdminProjectStatus() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'active' | 'archived' }) =>
            setAdminProjectStatus(id, status),
        retry: 0,
        onSuccess: async (_data, variables) => {
            await Promise.all([
                client.invalidateQueries({ queryKey: ['adminProjects'] }),
                client.invalidateQueries({ queryKey: queryKeys.projects }),
                client.invalidateQueries({ queryKey: queryKeys.project(variables.id) }),
            ]);
        },
    });
}
export function useDeleteProject(projectId: string) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (confirmName: string) => deleteProject(projectId, confirmName),
        retry: 0,
        onSuccess: async () => {
            const predicate = (query: { queryKey: readonly unknown[] }) =>
                query.queryKey.includes(projectId);
            await client.cancelQueries({ predicate });
            client.removeQueries({ predicate });
            await Promise.all([
                client.invalidateQueries({ queryKey: queryKeys.projects }),
                client.invalidateQueries({ queryKey: ['adminProjects'] }),
            ]);
        },
    });
}
