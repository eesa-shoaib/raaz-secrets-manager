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

    it('paginates users, toggles activation/admin status, and surfaces 409 last-admin error', async () => {
        vi.mocked(authApi.getMe).mockResolvedValue(ADMIN_ME);
        vi.mocked(adminApi.getAdminUsers).mockImplementation(async (params) => {
            if (params?.cursor === 'cursor-page-2') {
                return {
                    data: [
                        {
                            ...ADMIN_ME,
                            id: 'cccccccccccccccccccccccc',
                            email: 'bob@raaz.dev',
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
                    ADMIN_ME,
                    {
                        ...ADMIN_ME,
                        id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
                        email: 'alice@raaz.dev',
                        username: 'alice',
                        isPlatformAdmin: false,
                        isActive: true,
                    },
                ],
                nextCursor: 'cursor-page-2',
                hasMore: true,
                limit: 25,
            };
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
            expect(screen.getByText('@alice')).toBeTruthy();
        });

        // Page forward via Next button
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => {
            expect(screen.getByText('bob@raaz.dev')).toBeTruthy();
        });

        // Attempt to activate bob
        vi.mocked(adminApi.updateAdminUser).mockResolvedValueOnce({
            ...ADMIN_ME,
            id: 'cccccccccccccccccccccccc',
            email: 'bob@raaz.dev',
            username: null,
            isPlatformAdmin: false,
            isActive: true,
        });
        fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
        expect(screen.getByText('Activate User Account')).toBeTruthy();
        const activateButtons = screen.getAllByRole('button', { name: 'Activate' });
        fireEvent.click(activateButtons[activateButtons.length - 1]);

        await waitFor(() => {
            expect(adminApi.updateAdminUser).toHaveBeenCalledWith('cccccccccccccccccccccccc', {
                isActive: true,
            });
        });

        // Page back and test 409 conflict on self revoke
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        await waitFor(() => {
            expect(screen.getByText('@root')).toBeTruthy();
        });

        vi.mocked(adminApi.updateAdminUser).mockRejectedValueOnce({
            status: 409,
            code: 'CONFLICT',
            message: 'Cannot remove last Platform Admin',
            name: 'ApiError',
        } satisfies ApiError);

        fireEvent.click(screen.getByRole('button', { name: 'Revoke Admin' }));
        const revokeButtons = screen.getAllByRole('button', { name: 'Revoke Admin' });
        fireEvent.click(revokeButtons[revokeButtons.length - 1]);

        await waitFor(() => {
            expect(screen.getByText('Cannot remove last Platform Admin')).toBeTruthy();
        });
    });
});
