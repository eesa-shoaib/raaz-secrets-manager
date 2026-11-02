import { useQuery, useMutation } from '@tanstack/react-query';
import type { CreateProjectInput, ProjectResponse } from '@raaz/shared-schemas';
import { getProjects, getProject, createProject } from '../api/projects';
import { queryClient, queryKeys } from '../lib/queryClient';

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: getProjects,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId || ''),
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
    retry: (failureCount, error: any) => {
      // Do not retry 404 or 403
      if (error?.status === 404 || error?.status === 403) return false;
      return failureCount < 1;
    },
  });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: (data: CreateProjectInput) => createProject(data),
    onSuccess: (newProject: ProjectResponse) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.setQueryData(queryKeys.project(newProject.id), newProject);
    },
  });
}
