import { useQuery, useMutation } from '@tanstack/react-query';
import type { AddMemberInput } from '@raaz/shared-schemas';
import { getMembers, addMember } from '../api/members';
import { queryClient, queryKeys } from '../lib/queryClient';
import { isApiError } from '../lib/errorHandling';

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: queryKeys.members(projectId),
    queryFn: () => getMembers(projectId),
    enabled: Boolean(projectId),
  });
}

export function useAddMember(projectId: string) {
  return useMutation({
    mutationFn: (data: AddMemberInput) => addMember(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.members(projectId),
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
