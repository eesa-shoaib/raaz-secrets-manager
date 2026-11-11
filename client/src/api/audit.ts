import type {
    AuditAction,
    AuditLogEntryResponse,
    AuditResult,
    CursorPaginatedResponse,
    ProjectEnvironment,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export interface AuditLogFilters {
    action?: AuditAction;
    result?: AuditResult;
    environment?: ProjectEnvironment;
    limit?: number;
    cursor?: string | null;
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

    const res = await apiClient.get<AuditLogEntryResponse[] | { entries: AuditLogEntryResponse[] }>(
        `/projects/${projectId}/audit-log`,
        { params },
    );

    const data = res.data;
    if (Array.isArray(data)) return data;
    return (data as { entries?: AuditLogEntryResponse[] }).entries ?? [];
}

export async function getProjectAuditLogPage(
    projectId: string,
    filters: AuditLogFilters = {},
): Promise<CursorPaginatedResponse<AuditLogEntryResponse>> {
    const params: Record<string, unknown> = {
        mode: 'cursor',
        limit: filters.limit ?? 25,
    };

    if (filters.cursor) params.cursor = filters.cursor;
    if (filters.action) params.action = filters.action;
    if (filters.result) params.result = filters.result;
    if (filters.environment) params.environment = filters.environment;

    const res = await apiClient.get<CursorPaginatedResponse<AuditLogEntryResponse>>(
        `/projects/${projectId}/audit-log`,
        { params },
    );
    return res.data;
}
