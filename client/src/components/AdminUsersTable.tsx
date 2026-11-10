import type { PublicUser } from '@raaz/shared-schemas';
import React from 'react';
import { Badge } from './Badge';
import { UserAvatar } from './UserAvatar';

export interface AdminUserActionRequest {
    user: PublicUser;
    kind: 'activate' | 'deactivate' | 'grantAdmin' | 'revokeAdmin';
}

interface AdminUsersTableProps {
    users: PublicUser[];
    currentUserId: string;
    isMutating?: boolean;
    onRequestAction: (request: AdminUserActionRequest) => void;
}

function formatDate(date: string | Date | null | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function AdminUsersTable({
    users,
    currentUserId,
    isMutating = false,
    onRequestAction,
}: AdminUsersTableProps) {
    return (
        <div className="overflow-x-auto rounded-2xl border border-base-300 bg-base-200 shadow-sm">
            <table className="table w-full font-ui text-sm">
                <thead>
                    <tr className="border-b border-base-300 text-xs uppercase tracking-wider text-base-content/60">
                        <th>User</th>
                        <th>Platform Role</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th className="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((entry) => {
                        const isSelf = entry.id === currentUserId;
                        return (
                            <tr key={entry.id} className="border-b border-base-300/60 last:border-b-0">
                                <td>
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            userId={entry.id}
                                            email={entry.email}
                                            username={entry.username}
                                            hasAvatar={entry.hasAvatar}
                                            avatarUpdatedAt={entry.avatarUpdatedAt}
                                            size="md"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-base-content truncate">
                                                    {entry.username ? `@${entry.username}` : entry.email}
                                                </span>
                                                {isSelf && (
                                                    <span className="badge badge-ghost badge-xs">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            {entry.username && (
                                                <div className="text-xs text-base-content/60 truncate">
                                                    {entry.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {entry.isPlatformAdmin ? (
                                        <span className="badge badge-primary text-base-300 font-semibold text-xs">
                                            Platform Admin
                                        </span>
                                    ) : (
                                        <span className="badge badge-ghost text-xs">User</span>
                                    )}
                                </td>
                                <td>
                                    <Badge
                                        variant="userStatus"
                                        value={entry.isActive ? 'active' : 'inactive'}
                                    />
                                </td>
                                <td className="text-base-content/70">{formatDate(entry.createdAt)}</td>
                                <td>
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            disabled={isMutating}
                                            onClick={() =>
                                                onRequestAction({
                                                    user: entry,
                                                    kind: entry.isPlatformAdmin
                                                        ? 'revokeAdmin'
                                                        : 'grantAdmin',
                                                })
                                            }
                                            className="btn btn-xs btn-ghost border border-base-300 rounded-lg"
                                        >
                                            {entry.isPlatformAdmin ? 'Revoke Admin' : 'Make Admin'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isMutating}
                                            onClick={() =>
                                                onRequestAction({
                                                    user: entry,
                                                    kind: entry.isActive
                                                        ? 'deactivate'
                                                        : 'activate',
                                                })
                                            }
                                            className={`btn btn-xs rounded-lg ${
                                                entry.isActive
                                                    ? 'btn-outline btn-error'
                                                    : 'btn-outline btn-success'
                                            }`}
                                        >
                                            {entry.isActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default AdminUsersTable;
