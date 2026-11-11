import type {
    CreateProjectInput,
    CursorPaginatedResponse,
    ProjectResponse,
    UpdateProjectInput,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export interface ProjectsPageParams {
    cursor?: string | null;
    limit?: number;
    search?: string;
}

export async function getProjects(): Promise<ProjectResponse[]> {
    const res = await apiClient.get<ProjectResponse[] | { projects: ProjectResponse[] }>(
        '/projects',
    );
    const data = res.data;
    if (Array.isArray(data)) return data;
    return (data as { projects?: ProjectResponse[] }).projects ?? [];
}

export async function getProjectsPage(
    params: ProjectsPageParams = {},
): Promise<CursorPaginatedResponse<ProjectResponse>> {
    const query: Record<string, unknown> = {
        mode: 'cursor',
        limit: params.limit ?? 25,
    };
    if (params.cursor) query.cursor = params.cursor;
    if (params.search && params.search.trim()) query.search = params.search.trim();

    const res = await apiClient.get<CursorPaginatedResponse<ProjectResponse>>('/projects', {
        params: query,
    });
    return res.data;
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

export async function updateProject(
    projectId: string,
    data: UpdateProjectInput,
): Promise<ProjectResponse> {
    const res = await apiClient.patch<ProjectResponse | { project: ProjectResponse }>(
        `/projects/${projectId}`,
        data,
    );
    const body = res.data as { project?: ProjectResponse } & ProjectResponse;
    return body.project ?? body;
}
