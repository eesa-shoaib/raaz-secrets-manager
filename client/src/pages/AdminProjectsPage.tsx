import type { AuditResult, ProjectManagementAuditAction } from '@raaz/shared-schemas';
import React, { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { PageHeader } from '../components/PageHeader';
import { PaginationControls } from '../components/PaginationControls';
import { SearchInput } from '../components/SearchInput';
import { useToast } from '../components/Toaster';
import { UserAvatar } from '../components/UserAvatar';
import {
    useAdminProjectAuditLog,
    useAdminProjects,
    useSetAdminProjectStatus,
} from '../hooks/useAdminProjects';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isApiError } from '../lib/errorHandling';

type ProjectTab = 'projects' | 'audit';
type ProjectAuditActionFilter = ProjectManagementAuditAction | '';
type AuditResultFilter = AuditResult | '';

const PROJECT_AUDIT_ACTIONS: { value: ProjectManagementAuditAction; label: string }[] = [
    { value: 'project_created', label: 'Create project' },
    { value: 'project_renamed', label: 'Rename project' },
    { value: 'project_updated', label: 'Update project details' },
    { value: 'project_environments_changed', label: 'Change environments' },
    { value: 'project_archived', label: 'Archive project' },
    { value: 'project_restored', label: 'Restore project' },
    { value: 'project_deleted', label: 'Delete project' },
];

function formatProjectActionLabel(action: string): string {
    const found = PROJECT_AUDIT_ACTIONS.find((item) => item.value === action);
    return found ? found.label : action.replace(/_/g, ' ');
}

function getProjectActionTransition(action: string): { from: string; to: string } | null {
    switch (action) {
        case 'project_archived':
            return { from: 'Active', to: 'Archived' };
        case 'project_restored':
            return { from: 'Archived', to: 'Active' };
        case 'project_deleted':
            return { from: 'Active', to: 'Deleted' };
        default:
            return null;
    }
}

const tabClass = (active: boolean) =>
    `tab h-12 whitespace-nowrap !border-b-[3px] px-5 font-heading text-base font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        active
            ? 'tab-active !border-primary !text-primary'
            : 'border-transparent text-base-content/70 hover:text-base-content'
    }`;

export default function AdminProjectsPage() {
    useDocumentTitle('Manage projects');
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<ProjectTab>('projects');
    const [input, setInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'active' | 'archived'>('active');
    const [cursor, setCursor] = useState<string | undefined>();
    const [history, setHistory] = useState<(string | undefined)[]>([]);
    const [selected, setSelected] = useState<{
        id: string;
        name: string;
        status: 'active' | 'archived';
    } | null>(null);

    // Project audit log state
    const [auditCursor, setAuditCursor] = useState<string | null>(null);
    const [auditHistory, setAuditHistory] = useState<(string | null)[]>([]);
    const [actionFilter, setActionFilter] = useState<ProjectAuditActionFilter>('');
    const [resultFilter, setResultFilter] = useState<AuditResultFilter>('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(input.trim());
            setCursor(undefined);
            setHistory([]);
        }, 250);
        return () => clearTimeout(timer);
    }, [input]);

    const page = useAdminProjects({ search, status: status || undefined, cursor, limit: 25 });
    const update = useSetAdminProjectStatus();
    const auditQuery = useAdminProjectAuditLog(
        {
            action: actionFilter || undefined,
            result: resultFilter || undefined,
            cursor: auditCursor,
            limit: 25,
        },
        activeTab === 'audit',
    );

    const handleAuditNext = () => {
        if (!auditQuery.data?.nextCursor) return;
        setAuditHistory((prev) => [...prev, auditCursor]);
        setAuditCursor(auditQuery.data.nextCursor);
    };

    const handleAuditPrevious = () => {
        if (auditHistory.length === 0) return;
        const prevCursor = auditHistory[auditHistory.length - 1] ?? null;
        setAuditHistory((prev) => prev.slice(0, -1));
        setAuditCursor(prevCursor);
    };

    const handleAuditFirstPage = () => {
        if (auditHistory.length === 0 && auditCursor === null) return;
        setAuditCursor(null);
        setAuditHistory([]);
    };

    const auditEntries = auditQuery.data?.data ?? [];
    const hasAuditFilters = Boolean(actionFilter || resultFilter);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Manage projects"
                actions={
                    activeTab === 'projects' ? (
                        <div className="flex flex-wrap gap-3">
                            <SearchInput
                                value={input}
                                onChange={setInput}
                                ariaLabel="Search projects"
                                placeholder="Search projects…"
                            />
                        </div>
                    ) : undefined
                }
            />

            <div className="border-b border-base-300">
                <div
                    role="tablist"
                    className="tabs tabs-bordered !inline-flex w-fit max-w-full flex-nowrap overflow-x-auto"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'projects'}
                        onClick={() => setActiveTab('projects')}
                        className={tabClass(activeTab === 'projects')}
                    >
                        Projects
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'audit'}
                        onClick={() => setActiveTab('audit')}
                        className={tabClass(activeTab === 'audit')}
                    >
                        Audit Log
                    </button>
                </div>
            </div>

            {activeTab === 'projects' && (
                <>
                    <div
                        role="tablist"
                        aria-label="Project status"
                        className="tabs tabs-boxed bg-base-200 w-fit"
                    >
                        {(['active', 'archived'] as const).map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="tab"
                                aria-selected={status === value}
                                className={`tab ${status === value ? 'tab-active text-primary button-textured' : ''}`}
                                onClick={() => {
                                    setStatus(value);
                                    setCursor(undefined);
                                    setHistory([]);
                                }}
                            >
                                {value === 'active' ? 'Active' : 'Archived'}
                            </button>
                        ))}
                    </div>
                    {page.isPending ? (
                        <Skeleton shape="table" count={5} />
                    ) : page.isError ? (
                        <ErrorState
                            message={
                                isApiError(page.error)
                                    ? page.error.message
                                    : 'Failed to load projects'
                            }
                            onRetry={() => page.refetch()}
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-2xl border border-base-300 bg-base-200">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Status</th>
                                            <th>Members</th>
                                            <th>Created</th>
                                            <th>
                                                <span className="sr-only">Actions</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {page.data.data.map((project) => (
                                            <tr key={project.id}>
                                                <td className="font-semibold">{project.name}</td>
                                                <td className="capitalize">{project.status}</td>
                                                <td>{project.memberCount}</td>
                                                <td>
                                                    {new Date(
                                                        project.createdAt,
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td className="text-right">
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm rounded-lg ${project.status === 'active' ? 'btn-error' : 'btn-primary'}`}
                                                        disabled={
                                                            page.isFetching || update.isPending
                                                        }
                                                        aria-label={`${project.status === 'active' ? 'Archive' : 'Restore'} ${project.name}`}
                                                        onClick={() => {
                                                            update.reset();
                                                            setSelected(project);
                                                        }}
                                                    >
                                                        {project.status === 'active'
                                                            ? 'Archive'
                                                            : 'Restore'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {!page.data.data.length && (
                                    <p className="p-6 text-sm text-base-content/70">
                                        No projects found
                                    </p>
                                )}
                            </div>
                            <PaginationControls
                                itemCount={page.data.data.length}
                                pageNumber={history.length + 1}
                                totalPages={Math.max(
                                    1,
                                    Math.ceil(page.data.total / page.data.limit),
                                )}
                                hasPrevious={history.length > 0}
                                hasNext={page.data.hasMore}
                                isFetching={page.isFetching}
                                onPrevious={() => {
                                    setCursor(history.at(-1));
                                    setHistory(history.slice(0, -1));
                                }}
                                onNext={() => {
                                    setHistory([...history, cursor]);
                                    setCursor(page.data.nextCursor ?? undefined);
                                }}
                            />
                        </>
                    )}
                </>
            )}

            {activeTab === 'audit' && (
                <div className="space-y-4">
                    <div className="rounded-3xl border border-base-300 bg-base-200 p-4 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="form-control">
                                    <label className="label px-0 py-1 text-xs font-heading font-medium text-base-content/70">
                                        Action
                                    </label>
                                    <select
                                        value={actionFilter}
                                        onChange={(e) => {
                                            setActionFilter(
                                                e.target.value as ProjectAuditActionFilter,
                                            );
                                            setAuditCursor(null);
                                            setAuditHistory([]);
                                        }}
                                        aria-label="Filter project audit by action"
                                        className="select select-bordered select-sm h-9 w-full rounded-xl bg-base-300 font-ui text-xs"
                                    >
                                        <option value="">All Actions</option>
                                        {PROJECT_AUDIT_ACTIONS.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-control">
                                    <label className="label px-0 py-1 text-xs font-heading font-medium text-base-content/70">
                                        Result
                                    </label>
                                    <select
                                        value={resultFilter}
                                        onChange={(e) => {
                                            setResultFilter(e.target.value as AuditResultFilter);
                                            setAuditCursor(null);
                                            setAuditHistory([]);
                                        }}
                                        aria-label="Filter project audit by result"
                                        className="select select-bordered select-sm h-9 w-full rounded-xl bg-base-300 font-ui text-xs"
                                    >
                                        <option value="">All Results</option>
                                        <option value="allowed">Allowed</option>
                                        <option value="denied">Denied</option>
                                    </select>
                                </div>
                            </div>

                            {hasAuditFilters && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActionFilter('');
                                        setResultFilter('');
                                        setAuditCursor(null);
                                        setAuditHistory([]);
                                    }}
                                    className="btn btn-ghost btn-sm h-9 rounded-xl font-ui text-xs text-base-content/70 hover:text-base-content"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>

                    {auditQuery.isLoading ? (
                        <Skeleton shape="table" count={5} />
                    ) : auditQuery.isError ? (
                        <ErrorState
                            message={
                                isApiError(auditQuery.error)
                                    ? auditQuery.error.message
                                    : 'Failed to load project audit log'
                            }
                            onRetry={() => auditQuery.refetch()}
                        />
                    ) : auditEntries.length === 0 ? (
                        <EmptyState
                            title={
                                hasAuditFilters
                                    ? 'No matching audit entries'
                                    : 'No project changes recorded yet'
                            }
                        />
                    ) : (
                        <>
                            <div className="overflow-hidden rounded-3xl border border-base-300 bg-base-200 shadow-sm">
                                <table className="table w-full table-fixed font-ui text-sm">
                                    <thead>
                                        <tr className="border-b border-base-300 font-heading text-xs uppercase tracking-wider text-base-content/60">
                                            <th className="w-28 py-4 pl-6">Time</th>
                                            <th className="w-[22%] py-4">Actor</th>
                                            <th className="w-[22%] py-4">Action</th>
                                            <th className="py-4">Project / Change</th>
                                            <th className="w-24 py-4 pr-6 text-right">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-base-300/60">
                                        {auditEntries.map((entry) => {
                                            const d = new Date(entry.createdAt);
                                            const iso = isNaN(d.getTime())
                                                ? ''
                                                : d.toISOString();
                                            const transition = getProjectActionTransition(
                                                entry.action,
                                            );
                                            return (
                                                <tr
                                                    key={entry.id}
                                                    className="hover:bg-base-300/30 transition-colors"
                                                >
                                                    <td className="py-4 pl-6 text-xs text-base-content/70 whitespace-nowrap">
                                                        <time dateTime={iso} title={iso}>
                                                            {isNaN(d.getTime())
                                                                ? '—'
                                                                : d.toLocaleDateString(
                                                                      undefined,
                                                                      {
                                                                          year: 'numeric',
                                                                          month: 'short',
                                                                          day: 'numeric',
                                                                      },
                                                                  )}
                                                        </time>
                                                    </td>
                                                    <td className="py-4">
                                                        {entry.user ? (
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <UserAvatar
                                                                    userId={entry.user.id}
                                                                    email={entry.user.email}
                                                                    username={entry.user.username}
                                                                    hasAvatar={entry.user.hasAvatar}
                                                                    avatarUpdatedAt={
                                                                        entry.user.avatarUpdatedAt
                                                                    }
                                                                    size="sm"
                                                                />
                                                                <span
                                                                    className="block truncate text-xs font-medium text-base-content"
                                                                    title={entry.user.email}
                                                                >
                                                                    {entry.user.username
                                                                        ? `@${entry.user.username}`
                                                                        : entry.user.email}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-base-content/60">
                                                                Unknown user
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 font-heading text-xs font-medium text-base-content truncate">
                                                        {formatProjectActionLabel(entry.action)}
                                                    </td>
                                                    <td className="py-4 text-xs">
                                                        <div className="flex min-w-0 flex-col gap-0.5">
                                                            <span
                                                                className="block truncate font-medium text-base-content"
                                                                title={entry.projectId}
                                                            >
                                                                {entry.projectName ??
                                                                    'Deleted project'}
                                                            </span>
                                                            {transition && (
                                                                <span className="font-semibold">
                                                                    <span className="text-base-content/70">
                                                                        {transition.from}
                                                                    </span>
                                                                    {' → '}
                                                                    <span className="text-primary">
                                                                        {transition.to}
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 pr-6 text-right text-xs font-medium">
                                                        {entry.result === 'allowed' ? (
                                                            <span className="text-success">
                                                                Allowed
                                                            </span>
                                                        ) : (
                                                            <span className="text-error">
                                                                Denied
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <PaginationControls
                                hasPrevious={auditHistory.length > 0}
                                hasNext={Boolean(
                                    auditQuery.data?.hasMore && auditQuery.data?.nextCursor,
                                )}
                                onFirstPage={handleAuditFirstPage}
                                onPrevious={handleAuditPrevious}
                                onNext={handleAuditNext}
                                pageNumber={auditHistory.length + 1}
                                totalPages={
                                    auditQuery.data
                                        ? Math.max(
                                              1,
                                              Math.ceil(
                                                  auditQuery.data.total / auditQuery.data.limit,
                                              ),
                                          )
                                        : undefined
                                }
                                itemCount={auditEntries.length}
                                isFetching={auditQuery.isFetching}
                                noun="entries"
                            />
                        </>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={Boolean(selected)}
                title={selected?.status === 'active' ? 'Archive project' : 'Restore project'}
                body={
                    selected?.status === 'active'
                        ? `Archive “${selected.name}”? Members will lose access until the project is restored. Secrets and memberships will be retained.`
                        : `Restore “${selected?.name}” and allow its members to access it again?`
                }
                confirmLabel={selected?.status === 'active' ? 'Archive' : 'Restore'}
                tone={selected?.status === 'active' ? 'danger' : 'neutral'}
                isLoading={update.isPending}
                error={
                    update.isError
                        ? isApiError(update.error)
                            ? update.error.message
                            : 'Unable to update project'
                        : null
                }
                onClose={() => {
                    if (!update.isPending) setSelected(null);
                }}
                onConfirm={() => {
                    if (selected)
                        update.mutate(
                            {
                                id: selected.id,
                                status: selected.status === 'active' ? 'archived' : 'active',
                            },
                            {
                                onSuccess: () => {
                                    toast.success(
                                        selected.status === 'active'
                                            ? 'Project archived'
                                            : 'Project restored',
                                    );
                                    setSelected(null);
                                },
                            },
                        );
                }}
            />
        </div>
    );
}
