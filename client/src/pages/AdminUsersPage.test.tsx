import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminApi from '../api/admin';
import * as authApi from '../api/auth';
import { RequirePlatformAdmin } from '../components/Guards';
import { ToastProvider } from '../components/Toaster';
import { AuthProvider } from '../context/AuthContext';
import type { ApiError } from '../lib/errorHandling';
import AdminUsersPage from './AdminUsersPage';

vi.mock('../api/auth', () => ({
    getMe: vi.fn(),
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
}));

vi.mock('../api/admin', () => ({
    getAdminUsers: vi.fn(),
    updateAdminUser: vi.fn(),
    getAdminAuditLog: vi.fn(),
}));

function makeClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
}

const ADMIN_ME = {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    email: 'root@raaz.dev',
    username: 'root',
    hasAvatar: false,
    avatarUpdatedAt: null,
    isPlatformAdmin: true,
    isActive: true,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
};

describe('AdminUsersPage and RequirePlatformAdmin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(adminApi.getAdminAuditLog).mockResolvedValue({
            data: [],
            nextCursor: null,
            hasMore: false,
            limit: 25,
        });
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute('open', '');
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute('open');
        };
    });

    afterEach(() => {
        cleanup();
    });

    it('renders 403 status page when a non-platform-admin visits /admin/users', async () => {
        vi.mocked(authApi.getMe).mockResolvedValueOnce({
            ...ADMIN_ME,
            isPlatformAdmin: false,
        });

        render(
            <QueryClientProvider client={makeClient()}>
                <MemoryRouter initialEntries={['/admin/users']}>
                    <AuthProvider>
                        <ToastProvider>
                            <Routes>
                                <Route element={<RequirePlatformAdmin />}>
                                    <Route path="/admin/users" element={<AdminUsersPage />} />
                                </Route>
                            </Routes>
                        </ToastProvider>
                    </AuthProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('403')).toBeTruthy();
        });
        expect(adminApi.getAdminUsers).not.toHaveBeenCalled();
    });

    it('sorts admins first, truncates emails, blocks self-revoke/deactivate, opens Manage modal, and shows platform audit log', async () => {
        vi.mocked(authApi.getMe).mockResolvedValue(ADMIN_ME);
        vi.mocked(adminApi.getAdminUsers).mockImplementation(async (params) => {
            if (params?.cursor === 'cursor-page-2') {
                return {
                    data: [
                        {
                            ...ADMIN_ME,
                            id: 'cccccccccccccccccccccccc',
                            email: 'very.long.engineer.email.address@organization.example.com',
                            username: null,
                            isPlatformAdmin: false,
                            isActive: false,
                        },
                    ],
                    nextCursor: null,
                    hasMore: false,
                    limit: 25,
                };
            }
            return {
                data: [
                    {
                        ...ADMIN_ME,
                        id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
                        email: 'alice@raaz.dev',
                        username: 'alice',
                        isPlatformAdmin: false,
                        isActive: true,
                    },
                    ADMIN_ME,
                ],
                nextCursor: 'cursor-page-2',
                hasMore: true,
                limit: 25,
            };
        });

        const { container } = render(
            <QueryClientProvider client={makeClient()}>
                <MemoryRouter initialEntries={['/admin/users']}>
                    <AuthProvider>
                        <ToastProvider>
                            <Routes>
                                <Route element={<RequirePlatformAdmin />}>
                                    <Route path="/admin/users" element={<AdminUsersPage />} />
                                </Route>
                            </Routes>
                        </ToastProvider>
                    </AuthProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('@alice')).toBeTruthy();
        });

        // No Status column, no DaisyUI badges, admins sorted first above regular users
        expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull();
        expect(container.querySelector('.badge')).toBeNull();
        const rows = screen.getAllByRole('row').slice(1);
        expect(rows[0].textContent).toContain('@root');
        expect(rows[1].textContent).toContain('@alice');

        // Self row opens Manage modal with Revoke Admin & Deactivate Account disabled
        fireEvent.click(screen.getByRole('button', { name: 'Manage root@raaz.dev' }));
        expect(screen.getByText('Manage User')).toBeTruthy();
        expect(
            (screen.getByRole('button', { name: 'Revoke Admin' }) as HTMLButtonElement).disabled,
        ).toBe(true);
        expect(
            (screen.getByRole('button', { name: 'Deactivate Account' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        // Page forward via Next button to bob's row with long email & inactive status icon
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => {
            expect(
                screen.getByText('very.long.engineer.email.address@organization.example.com'),
            ).toBeTruthy();
        });
        const longEmailEl = screen.getByText(
            'very.long.engineer.email.address@organization.example.com',
        );
        expect(longEmailEl.className).toContain('truncate');
        expect(
            screen.getByRole('img', {
                name: 'Inactive status for very.long.engineer.email.address@organization.example.com',
            }),
        ).toBeTruthy();

        // Attempt to activate user via Manage modal + inline confirm
        vi.mocked(adminApi.updateAdminUser).mockResolvedValueOnce({
            ...ADMIN_ME,
            id: 'cccccccccccccccccccccccc',
            email: 'very.long.engineer.email.address@organization.example.com',
            username: null,
            isPlatformAdmin: false,
            isActive: true,
        });
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Manage very.long.engineer.email.address@organization.example.com',
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Activate Account' }));
        const confirmActivateButtons = screen.getAllByRole('button', {
            name: 'Activate Account',
        });
        fireEvent.click(confirmActivateButtons[confirmActivateButtons.length - 1]);

        await waitFor(() => {
            expect(adminApi.updateAdminUser).toHaveBeenCalledWith('cccccccccccccccccccccccc', {
                isActive: true,
            });
        });

        // Navigate back and verify 409 conflict error inside Manage modal when revoking another admin
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        await waitFor(() => {
            expect(screen.getByText('@alice')).toBeTruthy();
        });

        vi.mocked(adminApi.updateAdminUser).mockRejectedValueOnce({
            status: 409,
            code: 'CONFLICT',
            message: 'Cannot remove last Platform Admin',
            name: 'ApiError',
        } satisfies ApiError);

        fireEvent.click(screen.getByRole('button', { name: 'Manage alice@raaz.dev' }));
        fireEvent.click(screen.getByRole('button', { name: 'Make Admin' }));
        const confirmMakeButtons = screen.getAllByRole('button', { name: 'Make Admin' });
        fireEvent.click(confirmMakeButtons[confirmMakeButtons.length - 1]);

        await waitFor(() => {
            expect(screen.getByText('Cannot remove last Platform Admin')).toBeTruthy();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        // Switch to Audit Log tab and verify role change entry renders
        vi.mocked(adminApi.getAdminAuditLog).mockResolvedValueOnce({
            data: [
                {
                    id: 'audit-platform-1',
                    user: {
                        id: ADMIN_ME.id,
                        email: ADMIN_ME.email,
                        username: ADMIN_ME.username,
                        hasAvatar: false,
                        avatarUpdatedAt: null,
                    },
                    targetUser: {
                        id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
                        email: 'alice@raaz.dev',
                        username: 'alice',
                        hasAvatar: false,
                        avatarUpdatedAt: null,
                    },
                    action: 'platform_admin_granted',
                    result: 'allowed',
                    createdAt: '2026-11-11T10:00:00.000Z',
                },
            ],
            nextCursor: null,
            hasMore: false,
            limit: 25,
        });

        fireEvent.click(screen.getByRole('tab', { name: 'Audit Log' }));
        await waitFor(() => {
            expect(screen.getByRole('cell', { name: 'Grant Platform Admin' })).toBeTruthy();
        });
        expect(screen.getByText('alice@raaz.dev')).toBeTruthy();
        expect(screen.getByText('User')).toBeTruthy();
        expect(screen.getByText('Platform Admin')).toBeTruthy();
    });
});
