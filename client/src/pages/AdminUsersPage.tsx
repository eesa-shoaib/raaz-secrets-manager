import React, { useState } from 'react';
import {
    AdminUsersTable,
    type AdminUserActionRequest,
} from '../components/AdminUsersTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { PageHeader } from '../components/PageHeader';
import { PaginationControls } from '../components/PaginationControls';
import { useToast } from '../components/Toaster';
import { useAdminUsers, useUpdateAdminUser } from '../hooks/useAdminUsers';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isApiError } from '../lib/errorHandling';

const ACTION_COPY: Record<
    AdminUserActionRequest['kind'],
    { title: string; confirmLabel: string; tone: 'neutral' | 'danger'; verb: string }
> = {
    activate: {
        title: 'Activate User Account',
        confirmLabel: 'Activate',
        tone: 'neutral',
        verb: 're-enable sign-in access for',
    },
    deactivate: {
        title: 'Deactivate User Account',
        confirmLabel: 'Deactivate',
        tone: 'danger',
        verb: 'immediately revoke active sessions and prevent sign-in for',
    },
    grantAdmin: {
        title: 'Grant Platform Admin Role',
        confirmLabel: 'Grant Admin',
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

export function AdminUsersPage() {
    useDocumentTitle('User Management');
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [cursor, setCursor] = useState<string | null>(null);
    const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
    const [pendingAction, setPendingAction] = useState<AdminUserActionRequest | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const { data, isLoading, isFetching, isError, error, refetch } = useAdminUsers({
        cursor,
        limit: 25,
    });
    const updateUserMutation = useUpdateAdminUser();

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

    const handleConfirm = async () => {
        if (!pendingAction || updateUserMutation.isPending) return;
        setActionError(null);

        const payload =
            pendingAction.kind === 'activate'
                ? { isActive: true }
                : pendingAction.kind === 'deactivate'
                  ? { isActive: false }
                  : pendingAction.kind === 'grantAdmin'
                    ? { isPlatformAdmin: true }
                    : { isPlatformAdmin: false };

        try {
            await updateUserMutation.mutateAsync({
                userId: pendingAction.user.id,
                data: payload,
            });
            toast.success(`Updated account for ${pendingAction.user.email}`);
            setPendingAction(null);
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 409) {
                    setActionError(
                        err.message || 'Cannot demote or deactivate the last active Platform Admin.',
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
    const meta = pendingAction ? ACTION_COPY[pendingAction.kind] : null;

    return (
        <div className="space-y-6">
            <PageHeader
                title="User Management"
                description="Manage platform administrators and account activation across Raaz"
            />

            {isLoading ? (
                <Skeleton shape="table" count={5} />
            ) : isError ? (
                <ErrorState
                    message={isApiError(error) ? error.message : 'Failed to load platform users'}
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
                        onRequestAction={(req) => {
                            setActionError(null);
                            setPendingAction(req);
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
            )}

            <ConfirmDialog
                isOpen={Boolean(pendingAction)}
                onClose={() => {
                    if (!updateUserMutation.isPending) {
                        setPendingAction(null);
                        setActionError(null);
                    }
                }}
                onConfirm={handleConfirm}
                title={meta?.title ?? 'Confirm User Update'}
                body={
                    pendingAction && meta ? (
                        <p>
                            Are you sure you want to {meta.verb}{' '}
                            <span className="font-semibold text-base-content">
                                {pendingAction.user.email}
                            </span>
                            ?
                        </p>
                    ) : null
                }
                confirmLabel={meta?.confirmLabel ?? 'Confirm'}
                tone={meta?.tone ?? 'neutral'}
                isLoading={updateUserMutation.isPending}
                error={actionError}
            />
        </div>
    );
}

export default AdminUsersPage;
