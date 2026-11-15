import type { CreateSecretInput, EditSecretInput, ImportSecretsInput } from '@raaz/shared-schemas';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
    createSecret,
    deleteSecret,
    editSecret,
    exportSecrets,
    getEnvExample,
    getSecrets,
    getSecretsPage,
    importSecrets,
    revealSecret,
    type SecretsPageParams,
} from '../api/secrets';
import { downloadTextFile } from '../lib/download';
import { isApiError } from '../lib/errorHandling';
import type { Environment } from '../lib/permissions';
import { queryClient, queryKeys } from '../lib/queryClient';

export function useSecrets(projectId: string, environment: Environment) {
    return useQuery({
        queryKey: queryKeys.secrets(projectId, environment),
        queryFn: () => getSecrets(projectId, environment),
        enabled: Boolean(projectId && environment),
    });
}

export function useSecretsPage(
    projectId: string,
    environment: Environment,
    params: SecretsPageParams = {},
) {
    const limit = params.limit ?? 25;
    const cursor = params.cursor ?? null;
    const search = params.search?.trim() || undefined;

    return useQuery({
        queryKey: queryKeys.secrets(projectId, environment, { cursor, limit, search }),
        queryFn: () => getSecretsPage(projectId, environment, { cursor, limit, search }),
        enabled: Boolean(projectId && environment),
        placeholderData: keepPreviousData,
    });
}

export function useCreateSecret(projectId: string, environment: Environment) {
    return useMutation({
        mutationFn: (data: CreateSecretInput) => createSecret(projectId, data),
        onSuccess: (newSecret) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.secrets(projectId, newSecret.environment),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.auditPrefix(projectId),
            });
        },
        onError: (err) => {
            if (isApiError(err) && err.status === 403) {
                queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.projects });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.secrets(projectId, environment),
                });
            }
        },
    });
}

export function useEditSecret(projectId: string, environment: Environment) {
    return useMutation({
        mutationFn: ({ secretId, data }: { secretId: string; data: EditSecretInput }) =>
            editSecret(projectId, secretId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.secrets(projectId, environment),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.auditPrefix(projectId),
            });
        },
        onError: (err) => {
            if (isApiError(err) && err.status === 403) {
                queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.projects });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.secrets(projectId, environment),
                });
            }
        },
    });
}

export function useDeleteSecret(projectId: string, environment: Environment) {
    return useMutation({
        mutationFn: (secretId: string) => deleteSecret(projectId, secretId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.secrets(projectId, environment),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.auditPrefix(projectId),
            });
        },
        onError: (err) => {
            if (isApiError(err) && err.status === 403) {
                queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.projects });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.secrets(projectId, environment),
                });
            }
        },
    });
}

export function useGenerateEnvExample(projectId: string) {
    return useMutation({
        mutationFn: (environment: Environment) => getEnvExample(projectId, environment),
        retry: 0,
    });
}

export function useImportSecrets(projectId: string, environment: Environment) {
    return useMutation({
        mutationFn: (data: ImportSecretsInput) => importSecrets(projectId, data),
        retry: 0,
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.secrets(projectId, variables.environment),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.auditPrefix(projectId),
            });
        },
        onError: (err) => {
            if (isApiError(err) && err.status === 403) {
                queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.projects });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.secrets(projectId, environment),
                });
            }
        },
    });
}

export function useExportSecrets(projectId: string, environment: Environment) {
    return useMutation({
        mutationFn: async ({ confirm }: { confirm: boolean }) => {
            const exported = await exportSecrets(projectId, { environment, confirm });
            downloadTextFile(exported.filename, exported.content);
            // Return metadata only so decrypted content never sits in mutation cache
            return { filename: exported.filename, count: exported.count };
        },
        retry: 0,
        gcTime: 0,
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.secrets(projectId, environment),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.auditPrefix(projectId),
            });
        },
        onError: (err) => {
            if (isApiError(err) && err.status === 403) {
                queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.projects });
            }
        },
    });
}

export function useRevealSecret(projectId: string, environment: Environment) {
    return useMutation({
        mutationFn: ({ secretId, confirm }: { secretId: string; confirm: boolean }) =>
            revealSecret(projectId, secretId, confirm),
        retry: 0,
        gcTime: 0,
        onSettled: () => {
            // Invalidate secrets list so lastAccessedAt updates
            queryClient.invalidateQueries({
                queryKey: queryKeys.secrets(projectId, environment),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.auditPrefix(projectId),
            });
        },
        onError: (err) => {
            if (isApiError(err) && err.status === 403) {
                queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.projects });
            }
        },
    });
}
