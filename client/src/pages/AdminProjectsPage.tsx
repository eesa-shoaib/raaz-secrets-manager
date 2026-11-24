import React, { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { PaginationControls } from '../components/PaginationControls';
import { SearchInput } from '../components/SearchInput';
import { useToast } from '../components/Toaster';
import { useAdminProjects, useSetAdminProjectStatus } from '../hooks/useAdminProjects';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isApiError } from '../lib/errorHandling';
export default function AdminProjectsPage() {
    useDocumentTitle('Manage projects');
    const { toast } = useToast();
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
    return (
        <div className="space-y-6">
            <PageHeader
                title="Manage projects"
                actions={
                    <div className="flex flex-wrap gap-3">
                        <SearchInput
                            value={input}
                            onChange={setInput}
                            ariaLabel="Search projects"
                            placeholder="Search projects…"
                        />
                    </div>
                }
            />
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
                <p role="status">Loading projects…</p>
            ) : page.isError ? (
                <div role="alert" className="space-y-3">
                    <p>Unable to load projects.</p>
                    <button className="btn btn-neutral btn-sm" onClick={() => page.refetch()}>
                        Retry
                    </button>
                </div>
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
                                        <td>{new Date(project.createdAt).toLocaleDateString()}</td>
                                        <td className="text-right">
                                            <button
                                                type="button"
                                                className={`btn btn-sm rounded-lg ${project.status === 'active' ? 'btn-error' : 'btn-primary'}`}
                                                disabled={page.isFetching || update.isPending}
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
                            <p className="p-6 text-sm text-base-content/70">No projects found</p>
                        )}
                    </div>
                    <PaginationControls
                        itemCount={page.data.data.length}
                        pageNumber={history.length + 1}
                        totalPages={Math.max(1, Math.ceil(page.data.total / page.data.limit))}
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
