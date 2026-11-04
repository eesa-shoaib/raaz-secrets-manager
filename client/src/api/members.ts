import type { AddMemberInput, MemberResponse } from '@raaz/shared-schemas';
import apiClient from './axios';

export async function getMembers(projectId: string): Promise<MemberResponse[]> {
  const res = await apiClient.get<{ members: MemberResponse[] }>(
    `/projects/${projectId}/members`,
  );
  return res.data.members;
}

export async function addMember(
  projectId: string,
  data: AddMemberInput,
): Promise<MemberResponse> {
  const res = await apiClient.post<{ member: MemberResponse }>(
    `/projects/${projectId}/members`,
    data,
  );
  return res.data.member;
}
