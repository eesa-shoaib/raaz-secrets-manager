import type {
    CreateProjectInput,
    ProjectResponse,
    UpdateProjectInput,
} from '@raaz/shared-schemas';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createProject,
    getProject,
    getProjects,
    getProjectsPage,
    updateProject,
    type ProjectsPageParams,
} from '../api/projects';
import { isApiError } from '../lib/errorHandling';
import { queryKeys } from '../lib/queryClient';

export function useProjects() {
    return useQuery({
        queryKey: queryKeys.projects,
        queryFn: getProjects,
    });
}

export function useProjectsPage(params: ProjectsPageParams = {}) {
    const limit = params.limit ?? 25;
    const cursor = params.cursor ?? null;
    const search = params.search?.trim() || undefined;

    return useQuery({
        queryKey: queryKeys.projectsList({ cursor, limit, search }),
        queryFn: () => getProjectsPage({ cursor, limit, search }),
        placeholderData: keepPreviousData,
    });
}

export function useProject(projectId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.project(projectId || ''),
        queryFn: () => getProject(projectId!),
        enabled: Boolean(projectId),
        retry: (failureCount, error: unknown) => {
            // Do not retry 404 or 403
            if (isApiError(error) && (error.status === 404 || error.status === 403)) return false;
            return failureCount < 1;
        },
    });
}

export function useCreateProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateProjectInput) => createProject(data),
        onSuccess: (newProject: ProjectResponse) => {
            qc.invalidateQueries({ queryKey: queryKeys.projects });
            qc.setQueryData(queryKeys.project(newProject.id), newProject);
        },
    });
}

export function useUpdateProject(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: UpdateProjectInput) => updateProject(projectId, data),
        onSuccess: (updated: ProjectResponse) => {
            qc.setQueryData(queryKeys.project(projectId), updated);
            qc.invalidateQueries({ queryKey: queryKeys.projects });
            qc.invalidateQueries({ queryKey: queryKeys.auditPrefix(projectId) });
        },
    });
}
