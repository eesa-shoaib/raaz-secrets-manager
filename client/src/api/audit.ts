import type {
    AuditAction,
    AuditLogEntryResponse,
    AuditResult,
    ProjectEnvironment,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export interface AuditLogFilters {
    action?: AuditAction;
    result?: AuditResult;
    environment?: ProjectEnvironment;
    limit?: number;
}

export async function getProjectAuditLog(
    projectId: string,
    filters: AuditLogFilters = {},
): Promise<AuditLogEntryResponse[]> {
    const params: Record<string, unknown> = {
        limit: filters.limit ?? 100,
    };

    if (filters.action) params.action = filters.action;
    if (filters.result) params.result = filters.result;
    if (filters.environment) params.environment = filters.environment;

    const res = await apiClient.get<{ entries: AuditLogEntryResponse[] }>(
        `/projects/${projectId}/audit-log`,
        { params },
    );

    return res.data.entries;
}
