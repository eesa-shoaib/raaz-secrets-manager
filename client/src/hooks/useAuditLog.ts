import { useQuery } from '@tanstack/react-query';
import { getProjectAuditLog, type AuditLogFilters } from '../api/audit';
import { queryKeys } from '../lib/queryClient';

export function useProjectAuditLog(projectId: string, filters: AuditLogFilters = {}) {
    return useQuery({
        queryKey: queryKeys.audit(projectId, filters as Record<string, unknown>),
        queryFn: () => getProjectAuditLog(projectId, filters),
        enabled: Boolean(projectId),
    });
}
