import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  CreateSecretInput,
  EditSecretInput,
} from '@raaz/shared-schemas';
import type { Environment } from '../lib/permissions';
import {
  createSecret,
  deleteSecret,
  editSecret,
  getSecrets,
  revealSecret,
} from '../api/secrets';
import { queryClient, queryKeys } from '../lib/queryClient';
import { isApiError } from '../lib/errorHandling';

export function useSecrets(projectId: string, environment: Environment) {
  return useQuery({
    queryKey: queryKeys.secrets(projectId, environment),
    queryFn: () => getSecrets(projectId, environment),
    enabled: Boolean(projectId && environment),
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
