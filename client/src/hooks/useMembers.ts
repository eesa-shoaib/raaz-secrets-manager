import type { AddMemberInput, UpdateMemberRoleInput } from '@raaz/shared-schemas';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getMembers, addMember, changeMemberRole, removeMember } from '../api/members';
import { isApiError } from '../lib/errorHandling';
import { queryClient, queryKeys } from '../lib/queryClient';

export function useMembers(projectId: string) {
    return useQuery({
        queryKey: queryKeys.members(projectId),
        queryFn: () => getMembers(projectId),
        enabled: Boolean(projectId),
    });
}

function refreshMembershipData(projectId: string) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.members(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    void queryClient.invalidateQueries({ queryKey: queryKeys.auditPrefix(projectId) });
}

export function useChangeMemberRole(projectId: string) {
    return useMutation({
        mutationFn: ({ userId, role }: { userId: string; role: UpdateMemberRoleInput['role'] }) =>
            changeMemberRole(projectId, userId, { role }),
        onSuccess: () => refreshMembershipData(projectId),
        onError: (error) => {
            if (isApiError(error) && [403, 404, 409].includes(error.status))
                refreshMembershipData(projectId);
        },
    });
}

export function useRemoveMember(projectId: string) {
    return useMutation({
        mutationFn: (userId: string) => removeMember(projectId, userId),
        onSuccess: () => refreshMembershipData(projectId),
        onError: (error) => {
            if (isApiError(error) && [403, 404, 409].includes(error.status))
                refreshMembershipData(projectId);
        },
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
