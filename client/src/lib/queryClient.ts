import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './errorHandling';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (failureCount, error) => {
                if (failureCount >= 1) return false;
                if (isApiError(error)) {
                    // Never retry on 4xx errors
                    if (error.status >= 400 && error.status < 500) {
                        return false;
                    }
                    // Retry once on network errors (status 0) or 5xx
                    return error.status === 0 || error.status >= 500;
                }
                return false;
            },
            staleTime: 1000 * 30, // 30 seconds default
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0, // Mutations never retry
        },
    },
});

export const queryKeys = {
    me: ['me'] as const,
    projects: ['projects'] as const,
    projectsList: (filters?: { search?: string; cursor?: string | null; limit?: number }) =>
        ['projects', 'list', filters ?? {}] as const,
    project: (id: string) => ['project', id] as const,
    secrets: (
        projectId: string,
        environment: string,
        filters?: { search?: string; cursor?: string | null; limit?: number },
    ) =>
        filters
            ? (['secrets', projectId, environment, filters] as const)
            : (['secrets', projectId, environment] as const),
    secretsPrefix: (projectId: string, environment?: string) =>
        environment
            ? (['secrets', projectId, environment] as const)
            : (['secrets', projectId] as const),
    members: (projectId: string, filters?: { cursor?: string | null; limit?: number }) =>
        filters ? (['members', projectId, filters] as const) : (['members', projectId] as const),
    membersPrefix: (projectId: string) => ['members', projectId] as const,
    audit: (projectId: string, filters?: Record<string, unknown>) =>
        filters ? (['audit', projectId, filters] as const) : (['audit', projectId] as const),
    auditPrefix: (projectId: string) => ['audit', projectId] as const,
    adminUsers: (filters?: { cursor?: string | null; limit?: number }) =>
        ['admin', 'users', filters ?? {}] as const,
    adminUsersPrefix: ['admin', 'users'] as const,
};
