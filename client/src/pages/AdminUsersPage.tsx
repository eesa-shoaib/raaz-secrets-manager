import type { PublicUser } from '@raaz/shared-schemas';
import React, { useState } from 'react';
import { AdminUsersTable, type AdminUserActionRequest } from '../components/AdminUsersTable';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { PaginationControls } from '../components/PaginationControls';
import { useToast } from '../components/Toaster';
import { UserAvatar } from '../components/UserAvatar';
import { useAdminAuditLog, useAdminUsers, useUpdateAdminUser } from '../hooks/useAdminUsers';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isApiError } from '../lib/errorHandling';

type AdminTab = 'users' | 'audit';
type PlatformAuditActionFilter =
    | 'platform_admin_granted'
    | 'platform_admin_revoked'
    | 'user_activated'
    | 'user_deactivated'
    | '';
type AuditResultFilter = 'allowed' | 'denied' | '';

const PLATFORM_AUDIT_ACTIONS: {
    value: Exclude<PlatformAuditActionFilter, ''>;
    label: string;
}[] = [
    { value: 'platform_admin_granted', label: 'Grant Platform Admin' },
    { value: 'platform_admin_revoked', label: 'Revoke Platform Admin' },
    { value: 'user_activated', label: 'Activate User' },
    { value: 'user_deactivated', label: 'Deactivate User' },
];

const ACTION_COPY: Record<
    AdminUserActionRequest['kind'],
    { title: string; confirmLabel: string; tone: 'neutral' | 'danger'; verb: string }
> = {
    activate: {
        title: 'Activate User Account',
        confirmLabel: 'Activate Account',
        tone: 'neutral',
        verb: 're-enable sign-in access for',
    },
    deactivate: {
        title: 'Deactivate User Account',
        confirmLabel: 'Deactivate Account',
        tone: 'danger',
        verb: 'immediately revoke active sessions and prevent sign-in for',
    },
    grantAdmin: {
        title: 'Grant Platform Admin Role',
        confirmLabel: 'Make Admin',
        tone: 'neutral',
        verb: 'grant platform administration privileges to',
    },
    revokeAdmin: {
        title: 'Revoke Platform Admin Role',
        confirmLabel: 'Revoke Admin',
        tone: 'danger',
        verb: 'remove platform administration privileges from',
    },
};

function formatPlatformActionLabel(action: string): string {
    const found = PLATFORM_AUDIT_ACTIONS.find((a) => a.value === action);
    return found ? found.label : action.replace(/_/g, ' ');
}

function getActionTransition(action: string): { from: string; to: string } | null {
    switch (action) {
        case 'platform_admin_granted':
            return { from: 'User', to: 'Platform Admin' };
        case 'platform_admin_revoked':
            return { from: 'Platform Admin', to: 'User' };
        case 'user_activated':
            return { from: 'Inactive', to: 'Active' };
        case 'user_deactivated':
            return { from: 'Active', to: 'Inactive' };
        default:
            return null;
    }
}

export function AdminUsersPage() {
    useDocumentTitle('User Management');
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<AdminTab>('users');

    // Users list state
    const [cursor, setCursor] = useState<string | null>(null);
    const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
    const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
    const [confirmingKind, setConfirmingKind] = useState<AdminUserActionRequest['kind'] | null>(
        null,
    );
    const [actionError, setActionError] = useState<string | null>(null);

    // Platform audit log state
    const [auditCursor, setAuditCursor] = useState<string | null>(null);
    const [auditHistory, setAuditHistory] = useState<(string | null)[]>([]);
    const [actionFilter, setActionFilter] = useState<PlatformAuditActionFilter>('');
    const [resultFilter, setResultFilter] = useState<AuditResultFilter>('');

    const { data, isLoading, isFetching, isError, error, refetch } = useAdminUsers({
        cursor,
        limit: 25,
    });
    const updateUserMutation = useUpdateAdminUser();

    const auditQuery = useAdminAuditLog(
        {
            action: actionFilter || undefined,
            result: resultFilter || undefined,
            cursor: auditCursor,
            limit: 25,
        },
        activeTab === 'audit',
    );

    const handleNext = () => {
        if (!data?.nextCursor) return;
        setCursorHistory((prev) => [...prev, cursor]);
        setCursor(data.nextCursor);
    };

    const handlePrevious = () => {
        if (cursorHistory.length === 0) return;
        const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
        setCursorHistory((prev) => prev.slice(0, -1));
        setCursor(previousCursor);
    };

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

    const handleCloseModal = () => {
        if (updateUserMutation.isPending) return;
        setSelectedUser(null);
        setConfirmingKind(null);
        setActionError(null);
    };

    const handleConfirm = async () => {
        if (!selectedUser || !confirmingKind || updateUserMutation.isPending) return;
        setActionError(null);

        const payload =
            confirmingKind === 'activate'
                ? { isActive: true }
                : confirmingKind === 'deactivate'
                  ? { isActive: false }
                  : confirmingKind === 'grantAdmin'
                    ? { isPlatformAdmin: true }
                    : { isPlatformAdmin: false };

        try {
            await updateUserMutation.mutateAsync({
                userId: selectedUser.id,
                data: payload,
            });
            toast.success(`Updated account for ${selectedUser.email}`);
            setSelectedUser(null);
            setConfirmingKind(null);
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 409) {
                    setActionError(
                        err.message ||
                            'Cannot demote or deactivate the last active Platform Admin.',
                    );
                } else {
                    setActionError(err.message || 'Failed to update user.');
                }
            } else {
                setActionError('Something went wrong — the action was not applied.');
            }
        }
    };

    const users = data?.data ?? [];
    const isSelfSelected = Boolean(selectedUser && selectedUser.id === currentUser?.id);
    const confirmMeta = confirmingKind ? ACTION_COPY[confirmingKind] : null;
    const auditEntries = auditQuery.data?.data ?? [];
    const hasAuditFilters = Boolean(actionFilter || resultFilter);

    return (
        <div className="space-y-6">
            <PageHeader
                title="User Management"
                description="Manage platform administrators, account activation, and role changes across Raaz"
            />

            <div className="border-b border-base-300">
                <div
                    role="tablist"
                    className="tabs tabs-bordered !inline-flex w-fit max-w-full flex-nowrap overflow-x-auto"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'users'}
                        onClick={() => setActiveTab('users')}
                        className={`tab h-12 whitespace-nowrap !border-b-[3px] px-5 font-heading text-base font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                            activeTab === 'users'
                                ? 'tab-active !border-primary !text-primary'
                                : 'border-transparent text-base-content/70 hover:text-base-content'
                        }`}
                    >
                        Users
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'audit'}
                        onClick={() => setActiveTab('audit')}
                        className={`tab h-12 whitespace-nowrap !border-b-[3px] px-5 font-heading text-base font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                            activeTab === 'audit'
                                ? 'tab-active !border-primary !text-primary'
                                : 'border-transparent text-base-content/70 hover:text-base-content'
                        }`}
                    >
                        Audit Log
                    </button>
                </div>
            </div>

            {activeTab === 'users' ? (
                isLoading ? (
                    <Skeleton shape="table" count={5} />
                ) : isError ? (
                    <ErrorState
                        message={
                            isApiError(error) ? error.message : 'Failed to load platform users'
                        }
                        onRetry={() => refetch()}
                    />
                ) : users.length === 0 ? (
                    <EmptyState
                        title="No users found"
                        description="Platform user accounts will appear here."
                    />
                ) : (
                    <>
                        <AdminUsersTable
                            users={users}
                            currentUserId={currentUser?.id ?? ''}
                            isMutating={updateUserMutation.isPending}
                            onManageUser={(entry) => {
                                setActionError(null);
                                setConfirmingKind(null);
                                setSelectedUser(entry);
                            }}
                        />

                        <PaginationControls
                            hasPrevious={cursorHistory.length > 0}
                            hasNext={Boolean(data?.hasMore && data?.nextCursor)}
                            onPrevious={handlePrevious}
                            onNext={handleNext}
                            pageNumber={cursorHistory.length + 1}
                            itemCount={users.length}
                            isFetching={isFetching}
                            noun="users"
                        />
                    </>
                )
            ) : (
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
                                                e.target.value as PlatformAuditActionFilter,
                                            );
                                            setAuditCursor(null);
                                            setAuditHistory([]);
                                        }}
                                        aria-label="Filter platform audit by action"
                                        className="select select-bordered select-sm h-9 w-full rounded-xl bg-base-300 font-ui text-xs"
                                    >
                                        <option value="">All Actions</option>
                                        {PLATFORM_AUDIT_ACTIONS.map((item) => (
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
                                        aria-label="Filter platform audit by result"
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
                                    : 'Failed to load platform audit log'
                            }
                            onRetry={() => auditQuery.refetch()}
                        />
                    ) : auditEntries.length === 0 ? (
                        <EmptyState
                            title={
                                hasAuditFilters
                                    ? 'No matching audit entries'
                                    : 'No role or account changes recorded yet'
                            }
                            description={
                                hasAuditFilters
                                    ? 'No platform user audit entries match your filters.'
                                    : 'Platform admin grants, revocations, activations, and deactivations appear here.'
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
                                            <th className="py-4">Target / Change</th>
                                            <th className="w-24 py-4 pr-6 text-right">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-base-300/60">
                                        {auditEntries.map((entry) => {
                                            const d = new Date(entry.createdAt);
                                            const iso = isNaN(d.getTime()) ? '' : d.toISOString();
                                            const transition = getActionTransition(entry.action);
                                            return (
                                                <tr
                                                    key={entry.id}
                                                    className="hover:bg-base-300/30 transition-colors"
                                                >
                                                    <td className="py-4 pl-6 text-xs text-base-content/70 whitespace-nowrap">
                                                        <time dateTime={iso} title={iso}>
                                                            {isNaN(d.getTime())
                                                                ? '—'
                                                                : d.toLocaleDateString(undefined, {
                                                                      year: 'numeric',
                                                                      month: 'short',
                                                                      day: 'numeric',
                                                                  })}
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
                                                        {formatPlatformActionLabel(entry.action)}
                                                    </td>
                                                    <td className="py-4 text-xs">
                                                        <div className="flex min-w-0 flex-col gap-0.5">
                                                            {entry.targetUser && (
                                                                <span
                                                                    className="block truncate font-medium text-base-content"
                                                                    title={entry.targetUser.email}
                                                                >
                                                                    {entry.targetUser.email}
                                                                </span>
                                                            )}
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
                                onPrevious={handleAuditPrevious}
                                onNext={handleAuditNext}
                                pageNumber={auditHistory.length + 1}
                                itemCount={auditEntries.length}
                                isFetching={auditQuery.isFetching}
                                noun="entries"
                            />
                        </>
                    )}
                </div>
            )}

            {selectedUser && (
                <Modal
                    isOpen={Boolean(selectedUser)}
                    onClose={handleCloseModal}
                    title="Manage User"
                    maxWidth="md"
                >
                    <div className="space-y-4 font-ui">
                        <div className="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-300/40 p-4">
                            <UserAvatar
                                userId={selectedUser.id}
                                email={selectedUser.email}
                                username={selectedUser.username}
                                hasAvatar={selectedUser.hasAvatar}
                                avatarUpdatedAt={selectedUser.avatarUpdatedAt}
                                size="md"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="truncate font-semibold text-base-content"
                                        title={
                                            selectedUser.username
                                                ? `@${selectedUser.username}`
                                                : selectedUser.email
                                        }
                                    >
                                        {selectedUser.username
                                            ? `@${selectedUser.username}`
                                            : selectedUser.email}
                                    </span>
                                    {isSelfSelected && (
                                        <kbd className="kbd kbd-xs bg-base-300 text-base-content/80">
                                            You
                                        </kbd>
                                    )}
                                </div>
                                <p
                                    className="truncate text-xs text-base-content/65"
                                    title={selectedUser.email}
                                >
                                    {selectedUser.email}
                                </p>
                            </div>
                        </div>

                        <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-base-300 bg-base-300/20 p-3 text-xs">
                            <div>
                                <dt className="text-base-content/60">Platform Role</dt>
                                <dd className="mt-0.5 font-semibold text-base-content">
                                    {selectedUser.isPlatformAdmin ? 'Platform Admin' : 'User'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-base-content/60">Account Status</dt>
                                <dd className="mt-0.5 font-semibold text-base-content">
                                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                                </dd>
                            </div>
                        </dl>

                        {isSelfSelected && (
                            <div className="rounded-xl border border-base-300 bg-base-300/40 px-3 py-2 text-xs text-base-content/75">
                                You cannot revoke your own Platform Admin role or deactivate
                                yourself from the Users page. To deactivate your own account, use{' '}
                                <span className="font-semibold text-base-content">Settings</span>.
                            </div>
                        )}

                        {actionError && (
                            <div
                                role="alert"
                                className="alert alert-error rounded-xl px-3 py-2 text-sm font-medium text-error-content"
                            >
                                <span>{actionError}</span>
                            </div>
                        )}

                        {confirmingKind && confirmMeta ? (
                            <div className="space-y-3 rounded-2xl border border-base-300 bg-base-300/40 p-4">
                                <p className="text-sm font-semibold text-base-content">
                                    {confirmMeta.title}
                                </p>
                                <p className="text-sm text-base-content/80">
                                    Are you sure you want to {confirmMeta.verb}{' '}
                                    <span className="font-semibold text-base-content">
                                        {selectedUser.email}
                                    </span>
                                    ?
                                </p>
                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        disabled={updateUserMutation.isPending}
                                        onClick={() => {
                                            setConfirmingKind(null);
                                            setActionError(null);
                                        }}
                                        className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        disabled={updateUserMutation.isPending}
                                        onClick={handleConfirm}
                                        className={`btn btn-sm h-9 px-4 rounded-xl text-sm font-semibold ${
                                            confirmMeta.tone === 'danger'
                                                ? 'btn-error text-error-content'
                                                : 'btn-primary text-primary-content'
                                        }`}
                                    >
                                        {updateUserMutation.isPending ? (
                                            <span className="loading loading-spinner loading-sm" />
                                        ) : (
                                            confirmMeta.confirmLabel
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2.5 pt-2 border-t border-base-300">
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <button
                                        type="button"
                                        disabled={
                                            updateUserMutation.isPending ||
                                            (isSelfSelected && selectedUser.isPlatformAdmin)
                                        }
                                        onClick={() => {
                                            setActionError(null);
                                            setConfirmingKind(
                                                selectedUser.isPlatformAdmin
                                                    ? 'revokeAdmin'
                                                    : 'grantAdmin',
                                            );
                                        }}
                                        className={`btn btn-sm h-9 flex-1 rounded-xl font-semibold ${
                                            selectedUser.isPlatformAdmin
                                                ? 'btn-outline btn-error'
                                                : 'btn-primary text-primary-content'
                                        }`}
                                    >
                                        {selectedUser.isPlatformAdmin
                                            ? 'Revoke Admin'
                                            : 'Make Admin'}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            updateUserMutation.isPending ||
                                            (isSelfSelected && selectedUser.isActive)
                                        }
                                        onClick={() => {
                                            setActionError(null);
                                            setConfirmingKind(
                                                selectedUser.isActive ? 'deactivate' : 'activate',
                                            );
                                        }}
                                        className={`btn btn-sm h-9 flex-1 rounded-xl font-semibold ${
                                            selectedUser.isActive
                                                ? 'btn-outline btn-error'
                                                : 'btn-outline btn-success'
                                        }`}
                                    >
                                        {selectedUser.isActive
                                            ? 'Deactivate Account'
                                            : 'Activate Account'}
                                    </button>
                                </div>
                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        disabled={updateUserMutation.isPending}
                                        onClick={handleCloseModal}
                                        className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
}

export default AdminUsersPage;
