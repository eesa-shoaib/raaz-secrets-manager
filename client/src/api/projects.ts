import type { CreateProjectInput, ProjectResponse } from '@raaz/shared-schemas';
import apiClient from './axios';

export async function getProjects(): Promise<ProjectResponse[]> {
  const res = await apiClient.get<{ projects: ProjectResponse[] }>('/projects');
  return res.data.projects;
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
  const res = await apiClient.get<{ project: ProjectResponse }>(`/projects/${projectId}`);
  return res.data.project;
}

export async function createProject(data: CreateProjectInput): Promise<ProjectResponse> {
  const res = await apiClient.post<{ project: ProjectResponse }>('/projects', data);
  return res.data.project;
}
