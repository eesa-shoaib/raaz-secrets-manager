import type { AddMemberInput, MemberResponse, UpdateMemberRoleInput } from '@raaz/shared-schemas';
import apiClient from './axios';

export async function getMembers(projectId: string): Promise<MemberResponse[]> {
    const res = await apiClient.get<MemberResponse[] | { members: MemberResponse[] }>(
        `/projects/${projectId}/members`,
    );
    const data = res.data;
    if (Array.isArray(data)) return data;
    return (data as { members?: MemberResponse[] }).members ?? [];
}

export async function changeMemberRole(
    projectId: string,
    userId: string,
    data: UpdateMemberRoleInput,
): Promise<void> {
    await apiClient.patch(`/projects/${projectId}/members/${userId}`, data);
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/members/${userId}`);
}

export async function addMember(
    projectId: string,
    data: AddMemberInput,
): Promise<MemberResponse | { message: string }> {
    const res = await apiClient.post<
        MemberResponse | { member?: MemberResponse; message?: string }
    >(`/projects/${projectId}/members`, data);
    const body = res.data as { member?: MemberResponse } & MemberResponse;
    return body.member ?? body;
}
