import type { PublicUser } from '@raaz/shared-schemas';
import React from 'react';
import { UserAvatar } from './UserAvatar';

export interface AdminUserActionRequest {
    user: PublicUser;
    kind: 'activate' | 'deactivate' | 'grantAdmin' | 'revokeAdmin';
}

interface AdminUsersTableProps {
    users: PublicUser[];
    currentUserId: string;
    isMutating?: boolean;
    onManageUser: (user: PublicUser) => void;
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
    onManageUser,
}: AdminUsersTableProps) {
    const sortedUsers = [...users].sort(
        (a, b) => Number(b.isPlatformAdmin) - Number(a.isPlatformAdmin),
    );

    return (
        <div className="overflow-hidden rounded-3xl border border-base-300 bg-base-200 shadow-sm">
            <table className="table w-full table-fixed font-ui text-sm">
                <thead>
                    <tr className="border-b border-base-300 font-heading text-xs uppercase tracking-wider text-base-content/60">
                        <th className="w-[46%] py-4 pl-6">User</th>
                        <th className="w-[24%] py-4">Platform Role</th>
                        <th className="w-[18%] py-4">Joined</th>
                        <th className="w-[12%] py-4 pr-6 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-base-300/60">
                    {sortedUsers.map((entry) => {
                        const isSelf = entry.id === currentUserId;
                        return (
                            <tr key={entry.id} className="hover:bg-base-300/30 transition-colors">
                                <td className="py-4 pl-6">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <UserAvatar
                                            userId={entry.id}
                                            email={entry.email}
                                            username={entry.username}
                                            hasAvatar={entry.hasAvatar}
                                            avatarUpdatedAt={entry.avatarUpdatedAt}
                                            size="md"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span
                                                    className="block max-w-[11rem] sm:max-w-[16rem] truncate font-medium text-base-content"
                                                    title={
                                                        entry.username
                                                            ? `@${entry.username}`
                                                            : entry.email
                                                    }
                                                >
                                                    {entry.username
                                                        ? `@${entry.username}`
                                                        : entry.email}
                                                </span>
                                                <span
                                                    className="tooltip tooltip-top shrink-0 inline-flex items-center"
                                                    data-tip={
                                                        entry.isActive
                                                            ? 'Active account'
                                                            : 'Inactive account'
                                                    }
                                                    aria-label={
                                                        entry.isActive
                                                            ? `Active status for ${entry.email}`
                                                            : `Inactive status for ${entry.email}`
                                                    }
                                                    role="img"
                                                >
                                                    {entry.isActive ? (
                                                        <svg
                                                            aria-hidden="true"
                                                            className="h-4 w-4 text-success"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2.2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <circle cx="12" cy="12" r="10" />
                                                            <path d="m9 12 2 2 4-4" />
                                                        </svg>
                                                    ) : (
                                                        <svg
                                                            aria-hidden="true"
                                                            className="h-4 w-4 text-error"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2.2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <circle cx="12" cy="12" r="10" />
                                                            <path d="m4.9 4.9 14.2 14.2" />
                                                        </svg>
                                                    )}
                                                </span>
                                                {isSelf && (
                                                    <kbd className="kbd kbd-xs shrink-0 bg-base-300 font-ui text-base-content/80">
                                                        You
                                                    </kbd>
                                                )}
                                            </div>
                                            {entry.username && (
                                                <div
                                                    className="mt-0.5 max-w-[12rem] sm:max-w-[18rem] truncate text-xs text-base-content/60"
                                                    title={entry.email}
                                                >
                                                    {entry.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4">
                                    {entry.isPlatformAdmin ? (
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-primary text-xs">
                                            <svg
                                                aria-hidden="true"
                                                className="h-4 w-4 shrink-0"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                                                <path d="m9 12 2 2 4-4" />
                                            </svg>
                                            <span>Platform Admin</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-base-content/75 text-xs">
                                            <svg
                                                aria-hidden="true"
                                                className="h-4 w-4 shrink-0 text-base-content/50"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                            <span>User</span>
                                        </span>
                                    )}
                                </td>
                                <td className="py-4 text-xs text-base-content/70 whitespace-nowrap">
                                    {formatDate(entry.createdAt)}
                                </td>
                                <td className="py-4 pr-6 text-right">
                                    <button
                                        type="button"
                                        disabled={isMutating}
                                        onClick={() => onManageUser(entry)}
                                        aria-label={`Manage ${entry.email}`}
                                        title={`Manage ${entry.email}`}
                                        className="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/70 hover:text-primary disabled:opacity-40"
                                    >
                                        <svg
                                            aria-hidden="true"
                                            className="h-4 w-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <circle cx="12" cy="12" r="1" />
                                            <circle cx="19" cy="12" r="1" />
                                            <circle cx="5" cy="12" r="1" />
                                        </svg>
                                        <span className="sr-only">Manage</span>
                                    </button>
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
