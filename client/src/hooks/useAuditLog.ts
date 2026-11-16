import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
    exportProjectAuditLog,
    getProjectAuditLog,
    getProjectAuditLogPage,
    type AuditExportParams,
    type AuditLogFilters,
} from '../api/audit';
import { downloadTextFile } from '../lib/download';
import { queryKeys } from '../lib/queryClient';

export function useProjectAuditLog(projectId: string, filters: AuditLogFilters = {}) {
    return useQuery({
        queryKey: queryKeys.audit(projectId, filters as Record<string, unknown>),
        queryFn: () => getProjectAuditLog(projectId, filters),
        enabled: Boolean(projectId),
    });
}

export function useProjectAuditLogPage(projectId: string, filters: AuditLogFilters = {}) {
    return useQuery({
        queryKey: queryKeys.audit(projectId, { mode: 'cursor', ...filters }),
        queryFn: () => getProjectAuditLogPage(projectId, filters),
        enabled: Boolean(projectId),
        placeholderData: keepPreviousData,
    });
}

export function useExportProjectAuditLog(projectId: string) {
    return useMutation({
        mutationFn: async (params: AuditExportParams) => {
            const exported = await exportProjectAuditLog(projectId, params);
            downloadTextFile(exported.filename, exported.content, exported.mimeType);
            return exported.filename;
        },
        retry: 0,
    });
}
