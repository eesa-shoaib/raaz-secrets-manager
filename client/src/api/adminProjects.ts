import {
    adminProjectResponseSchema,
    createCursorPaginatedResponseSchema,
} from '@raaz/shared-schemas';
import apiClient from './axios';
const schema = createCursorPaginatedResponseSchema(adminProjectResponseSchema);
export interface AdminProjectFilters {
    search: string;
    status?: 'active' | 'archived';
    cursor?: string;
    limit: number;
}
export async function getAdminProjects(filters: AdminProjectFilters) {
    return schema.parse((await apiClient.get('/admin/projects', { params: filters })).data);
}
export async function setAdminProjectStatus(projectId: string, status: 'active' | 'archived') {
    await apiClient.patch(`/admin/projects/${projectId}/status`, { status });
}
export async function deleteProject(projectId: string, confirmName: string) {
    await apiClient.delete(`/projects/${projectId}`, { data: { confirmName } });
}
