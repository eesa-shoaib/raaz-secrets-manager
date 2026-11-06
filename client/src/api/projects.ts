import type { CreateProjectInput, ProjectResponse } from '@raaz/shared-schemas';
import apiClient from './axios';

export async function getProjects(): Promise<ProjectResponse[]> {
    const res = await apiClient.get<ProjectResponse[] | { projects: ProjectResponse[] }>(
        '/projects',
    );
    const data = res.data;
    if (Array.isArray(data)) return data;
    return (data as { projects?: ProjectResponse[] }).projects ?? [];
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
    const res = await apiClient.get<ProjectResponse | { project: ProjectResponse }>(
        `/projects/${projectId}`,
    );
    const data = res.data as { project?: ProjectResponse } & ProjectResponse;
    return data.project ?? data;
}

export async function createProject(data: CreateProjectInput): Promise<ProjectResponse> {
    const res = await apiClient.post<ProjectResponse | { project: ProjectResponse }>(
        '/projects',
        data,
    );
    const body = res.data as { project?: ProjectResponse } & ProjectResponse;
    return body.project ?? body;
}
