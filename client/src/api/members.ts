import type {
    AddMemberInput,
    CursorPaginatedResponse,
    MemberResponse,
    UpdateMemberRoleInput,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export interface MembersPageParams {
    cursor?: string | null;
    limit?: number;
}

export async function getMembers(projectId: string): Promise<MemberResponse[]> {
    const res = await apiClient.get<MemberResponse[] | { members: MemberResponse[] }>(
        `/projects/${projectId}/members`,
    );
    const data = res.data;
    if (Array.isArray(data)) return data;
    return (data as { members?: MemberResponse[] }).members ?? [];
}

export async function getMembersPage(
    projectId: string,
    params: MembersPageParams = {},
): Promise<CursorPaginatedResponse<MemberResponse>> {
    const query: Record<string, unknown> = {
        mode: 'cursor',
        limit: params.limit ?? 25,
    };
    if (params.cursor) query.cursor = params.cursor;

    const res = await apiClient.get<CursorPaginatedResponse<MemberResponse>>(
        `/projects/${projectId}/members`,
        { params: query },
    );
    return res.data;
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
