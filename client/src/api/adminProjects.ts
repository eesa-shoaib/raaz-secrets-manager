import {
    adminProjectAuditEntrySchema,
    adminProjectResponseSchema,
    createCursorPaginatedResponseSchema,
    type AuditResult,
    type ProjectManagementAuditAction,
} from '@raaz/shared-schemas';
import apiClient from './axios';
const schema = createCursorPaginatedResponseSchema(adminProjectResponseSchema);
const auditSchema = createCursorPaginatedResponseSchema(adminProjectAuditEntrySchema);
export interface AdminProjectFilters {
    search: string;
    status?: 'active' | 'archived';
    cursor?: string;
    limit: number;
}
export interface AdminProjectAuditParams {
    action?: ProjectManagementAuditAction;
    result?: AuditResult;
    cursor?: string | null;
    limit?: number;
}
export async function getAdminProjects(filters: AdminProjectFilters) {
    return schema.parse((await apiClient.get('/admin/projects', { params: filters })).data);
}
export async function getAdminProjectAuditLog(params: AdminProjectAuditParams = {}) {
    return auditSchema.parse((await apiClient.get('/admin/projects/audit-log', { params })).data);
}
export async function setAdminProjectStatus(projectId: string, status: 'active' | 'archived') {
    await apiClient.patch(`/admin/projects/${projectId}/status`, { status });
}
export async function deleteProject(projectId: string, confirmName: string) {
    await apiClient.delete(`/projects/${projectId}`, { data: { confirmName } });
}
