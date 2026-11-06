import type {
    AuditAction,
    AuditLogEntryResponse,
    AuditResult,
    ProjectEnvironment,
} from '@raaz/shared-schemas';
import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { useProjectAuditLog } from '../hooks/useAuditLog';
import { isApiError } from '../lib/errorHandling';

const PROJECT_ACTIONS: { value: AuditAction; label: string }[] = [
    { value: 'reveal', label: 'Reveal secret' },
    { value: 'create', label: 'Create secret' },
    { value: 'edit', label: 'Edit secret' },
    { value: 'delete', label: 'Delete secret' },
    { value: 'member_added', label: 'Add member' },
    { value: 'member_role_changed', label: 'Change member role' },
    { value: 'member_removed', label: 'Remove member' },
    { value: 'project_created', label: 'Create project' },
    { value: 'project_renamed', label: 'Rename project' },
    { value: 'project_environments_changed', label: 'Change environments' },
    { value: 'project_archived', label: 'Archive project' },
    { value: 'project_restored', label: 'Restore project' },
];

const ACTION_LABELS: Record<string, string> = {
    reveal: 'Reveal secret',
    create: 'Create secret',
    edit: 'Edit secret',
    delete: 'Delete secret',
    member_added: 'Add member',
    member_role_changed: 'Change member role',
    member_removed: 'Remove member',
    project_created: 'Create project',
    project_renamed: 'Rename project',
    project_environments_changed: 'Change environments',
    project_archived: 'Archive project',
    project_restored: 'Restore project',
    user_activated: 'Activate user',
    user_deactivated: 'Deactivate user',
    platform_admin_granted: 'Grant platform admin',
    platform_admin_revoked: 'Revoke platform admin',
    bootstrap_admin: 'Bootstrap admin',
};

function formatActionLabel(action: string): string {
    return ACTION_LABELS[action] || action;
}

function formatTimestamp(isoString: string | Date): { local: string; iso: string } {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
        return { local: '—', iso: '' };
    }
    return {
        local: d.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }),
        iso: d.toISOString(),
    };
}

export function ProjectAuditLogPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    const actionFilter = (searchParams.get('action') as AuditAction) || undefined;
    const resultFilter = (searchParams.get('result') as AuditResult) || undefined;
    const environmentFilter = (searchParams.get('environment') as ProjectEnvironment) || undefined;

    const filters = useMemo(
        () => ({
            action: actionFilter,
            result: resultFilter,
            environment: environmentFilter,
            limit: 100,
        }),
        [actionFilter, resultFilter, environmentFilter],
    );

    const {
        data: entries,
        isLoading,
        isError,
        error,
        refetch,
    } = useProjectAuditLog(projectId!, filters);

    const hasActiveFilters = Boolean(actionFilter || resultFilter || environmentFilter);

    const updateFilter = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (value) {
            next.set(key, value);
        } else {
            next.delete(key);
        }
        setSearchParams(next);
    };

    const handleClearFilters = () => {
        setSearchParams(new URLSearchParams());
    };

    const renderDetails = (entry: AuditLogEntryResponse) => {
        // Secret-scoped action
        if (entry.secretKey) {
            return (
                <div className="flex flex-col items-start gap-1">
                    {entry.environment && (
                        <span
                            className={`text-[11px] font-bold uppercase tracking-wider ${
                                entry.environment === 'production'
                                    ? 'text-error'
                                    : entry.environment === 'staging'
                                      ? 'text-warning'
                                      : 'text-info'
                            }`}
                        >
                            {entry.environment}
                        </span>
                    )}
                    <span
                        className="max-w-48 truncate rounded border border-base-300 bg-base-300/70 px-2 py-1 font-mono text-xs font-semibold text-base-content"
                        title={entry.secretKey}
                    >
                        {entry.secretKey}
                    </span>
                </div>
            );
        }

        // Member-scoped action
        if (entry.targetUser || entry.newRole) {
            return (
                <div className="flex max-w-40 flex-col items-center gap-1 text-center text-xs font-ui">
                    {entry.targetUser && (
                        <span
                            className="block max-w-40 truncate text-base-content font-medium"
                            title={entry.targetUser.email}
                        >
                            {entry.targetUser.email}
                        </span>
                    )}
                    {entry.previousRole && entry.newRole ? (
                        <span className="font-semibold">
                            <span className="text-secondary">
                                {entry.previousRole === 'projectAdmin'
                                    ? 'Project Admin'
                                    : entry.previousRole}
                            </span>
                            {' → '}
                            <span className="text-info">
                                {entry.newRole === 'projectAdmin' ? 'Project Admin' : entry.newRole}
                            </span>
                        </span>
                    ) : entry.newRole ? (
                        <span className="font-semibold text-secondary capitalize">
                            {entry.newRole === 'projectAdmin' ? 'Project Admin' : entry.newRole}
                        </span>
                    ) : null}
                </div>
            );
        }

        return <span className="text-base-content/40 text-xs">—</span>;
    };

    return (
        <div className="space-y-6">
            {/* Header & Description */}
            <div>
                <h2 className="text-xl font-heading font-bold text-base-content">Audit Log</h2>
                <p className="text-sm font-ui text-base-content/70 mt-0.5">
                    Immutable, team-visible trail of all secret accesses, modifications, and
                    membership changes
                </p>
            </div>

            {/* 3 Filters (Action, Result, Environment) per FRONTEND.md §3.7 */}
            <div className="bg-base-200 border border-base-300 p-4 rounded-2xl shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                        {/* Action Filter */}
                        <div className="form-control">
                            <label className="label py-1 px-0 text-xs font-heading font-medium text-base-content/70">
                                Action
                            </label>
                            <select
                                value={actionFilter || ''}
                                onChange={(e) => updateFilter('action', e.target.value)}
                                className="select select-bordered select-sm w-full min-w-44 bg-base-300 rounded-xl text-xs font-ui"
                                aria-label="Filter by action"
                            >
                                <option value="">All Actions</option>
                                {PROJECT_ACTIONS.map((act) => (
                                    <option key={act.value} value={act.value}>
                                        {act.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Result Filter */}
                        <div className="form-control">
                            <label className="label py-1 px-0 text-xs font-heading font-medium text-base-content/70">
                                Result
                            </label>
                            <select
                                value={resultFilter || ''}
                                onChange={(e) => updateFilter('result', e.target.value)}
                                className="select select-bordered select-sm w-full min-w-44 bg-base-300 rounded-xl text-xs font-ui"
                                aria-label="Filter by result"
                            >
                                <option value="">All Results</option>
                                <option value="allowed">Allowed</option>
                                <option value="denied">Denied</option>
                            </select>
                        </div>

                        {/* Environment Filter */}
                        <div className="form-control">
                            <div className="flex items-center justify-between">
                                <label className="label py-1 px-0 text-xs font-heading font-medium text-base-content/70">
                                    Environment
                                </label>
                            </div>
                            <select
                                value={environmentFilter || ''}
                                onChange={(e) => updateFilter('environment', e.target.value)}
                                className="select select-bordered select-sm w-full min-w-44 bg-base-300 rounded-xl text-xs font-ui"
                                aria-label="Filter by environment"
                            >
                                <option value="">All Environments</option>
                                <option value="development">Development</option>
                                <option value="staging">Staging</option>
                                <option value="production">Production</option>
                            </select>
                            <span className="text-[10px] text-base-content/50 mt-1">
                                Only secret actions have an environment.
                            </span>
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="btn btn-ghost btn-sm text-xs font-ui self-end mb-5 text-base-content/70 hover:text-base-content"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            </div>

            {/* Audit Log Table */}
            {isLoading ? (
                <Skeleton shape="table" count={5} />
            ) : isError ? (
                <ErrorState
                    message={isApiError(error) ? error.message : 'Failed to load project audit log'}
                    onRetry={() => refetch()}
                />
            ) : entries && entries.length > 0 ? (
                <div className="overflow-x-auto rounded-3xl border border-base-300 bg-base-200 shadow-sm">
                    <table className="table w-full text-sm">
                        <thead>
                            <tr className="border-b border-base-300 font-heading text-xs text-base-content/60 uppercase tracking-wider">
                                <th className="py-4 pl-6 text-center">Time</th>
                                <th className="py-4 text-center">User</th>
                                <th className="py-4 text-center">Action</th>
                                <th className="py-4 text-center">Details</th>
                                <th className="py-4 pr-6 text-center">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-300/60 font-ui">
                            {entries.map((entry) => {
                                const ts = formatTimestamp(entry.createdAt);
                                return (
                                    <tr
                                        key={entry.id}
                                        className="hover:bg-base-300/30 transition-colors"
                                    >
                                        {/* Time in local timezone with ISO datetime attribute */}
                                        <td className="py-4 pl-6 text-xs text-base-content/70 whitespace-nowrap">
                                            <time
                                                dateTime={ts.iso}
                                                title={ts.iso}
                                                className="flex flex-col"
                                            >
                                                <span>
                                                    {new Date(ts.iso).toLocaleDateString(
                                                        undefined,
                                                        {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                        },
                                                    )}
                                                </span>
                                                <span className="text-base-content/55">
                                                    {new Date(ts.iso).toLocaleTimeString(
                                                        undefined,
                                                        {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            second: '2-digit',
                                                        },
                                                    )}
                                                </span>
                                            </time>
                                        </td>

                                        {/* User */}
                                        <td className="py-4">
                                            <span
                                                className="block max-w-32 truncate font-medium text-base-content text-xs"
                                                title={entry.user?.email || 'Unknown user'}
                                            >
                                                {entry.user ? entry.user.email : 'Unknown user'}
                                            </span>
                                        </td>

                                        {/* Action */}
                                        <td className="py-4 font-heading font-medium text-xs text-base-content">
                                            {formatActionLabel(entry.action)}
                                        </td>

                                        {/* Details */}
                                        <td className="py-4 text-center text-xs">
                                            <div className="flex justify-center">
                                                {renderDetails(entry)}
                                            </div>
                                        </td>

                                        {/* Result */}
                                        <td className="py-4 pr-6 text-right">
                                            <Badge variant="auditResult" value={entry.result} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <EmptyState
                    title={
                        hasActiveFilters
                            ? 'No audit entries match these filters'
                            : 'No activity yet'
                    }
                    description={
                        hasActiveFilters
                            ? 'Try adjusting or clearing your filters to see more entries.'
                            : 'Activities performed in this project will appear here in reverse chronological order.'
                    }
                    action={
                        hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="btn btn-outline btn-sm rounded-xl"
                            >
                                Clear Filters
                            </button>
                        ) : undefined
                    }
                />
            )}
        </div>
    );
}

export default ProjectAuditLogPage;
