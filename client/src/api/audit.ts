import type {
    AuditAction,
    AuditExportFormat,
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

export interface AuditExportParams {
    format: AuditExportFormat;
    action?: AuditAction;
    result?: AuditResult;
    environment?: ProjectEnvironment;
}

export interface AuditExportResult {
    filename: string;
    content: string;
    mimeType: string;
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

export async function exportProjectAuditLog(
    projectId: string,
    exportParams: AuditExportParams,
): Promise<AuditExportResult> {
    const params: Record<string, unknown> = {
        format: exportParams.format,
    };
    if (exportParams.action) params.action = exportParams.action;
    if (exportParams.result) params.result = exportParams.result;
    if (exportParams.environment) params.environment = exportParams.environment;

    const res = await apiClient.get<string>(`/projects/${projectId}/audit-log/export`, {
        params,
        responseType: 'text',
        transformResponse: [(data: string) => data],
    });

    const disposition = String(res.headers['content-disposition'] ?? '');
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] ?? `audit-log-${projectId}.${exportParams.format}`;
    const mimeType =
        exportParams.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';

    return {
        filename,
        content: typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2),
        mimeType,
    };
}
