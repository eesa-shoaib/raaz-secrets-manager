import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from '../api/account';
import * as authApi from '../api/auth';
import { ToastProvider } from '../components/Toaster';
import { AuthProvider } from '../context/AuthContext';
import type { ApiError } from '../lib/errorHandling';
import { queryKeys } from '../lib/queryClient';
import SettingsPage from './SettingsPage';

vi.mock('../api/auth', () => ({
    getMe: vi.fn(),
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
}));

vi.mock('../api/account', () => ({
    updateProfile: vi.fn(),
    uploadAvatarFile: vi.fn(),
    uploadAvatarBase64: vi.fn(),
    deleteAvatar: vi.fn(),
    getUserAvatarUrl: vi.fn((id: string) => `/api/users/${id}/avatar`),
}));

const BASE_USER = {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    email: 'user@raaz.dev',
    username: 'old_name',
    hasAvatar: false,
    avatarUpdatedAt: null,
    isPlatformAdmin: false,
    isActive: true,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
};

function LoginSentinel() {
    const loc = useLocation();
    return <div data-testid="login-reason">{(loc.state as { reason?: string } | null)?.reason}</div>;
}

describe('SettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(authApi.getMe).mockResolvedValue(BASE_USER);
    });

    afterEach(() => {
        cleanup();
    });

    function renderSettings() {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });
        const utils = render(
            <QueryClientProvider client={client}>
                <MemoryRouter initialEntries={['/settings']}>
                    <AuthProvider>
                        <ToastProvider>
                            <Routes>
                                <Route path="/settings" element={<SettingsPage />} />
                                <Route path="/login" element={<LoginSentinel />} />
                            </Routes>
                        </ToastProvider>
                    </AuthProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );
        return { client, ...utils };
    }

    it('updates username and handles 409 username conflict inline', async () => {
        renderSettings();
        await waitFor(() => {
            expect(screen.getByLabelText('Username')).toBeTruthy();
        });

        const input = screen.getByLabelText('Username') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'taken_user' } });

        vi.mocked(accountApi.updateProfile).mockRejectedValueOnce({
            status: 409,
            code: 'CONFLICT',
            message: 'Username is already taken',
            name: 'ApiError',
        } satisfies ApiError);

        fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain('Username is already taken');
        });

        vi.mocked(accountApi.updateProfile).mockResolvedValueOnce({
            ...BASE_USER,
            username: 'fresh_user',
        });
        fireEvent.change(input, { target: { value: 'fresh_user' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));
        await waitFor(() => {
            expect(accountApi.updateProfile).toHaveBeenCalledWith({ username: 'fresh_user' });
        });
    });

    it('rejects invalid file types and supports uploading/removing avatars', async () => {
        renderSettings();
        await waitFor(() => {
            expect(screen.getByLabelText('Upload profile photo')).toBeTruthy();
        });

        const fileInput = screen.getByLabelText('Upload profile photo');
        const svgFile = new File(['<svg></svg>'], 'bad.svg', { type: 'image/svg+xml' });
        fireEvent.change(fileInput, { target: { files: [svgFile] } });

        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain('Unsupported image format');
        });
        expect(accountApi.uploadAvatarFile).not.toHaveBeenCalled();

        const pngFile = new File([new Uint8Array([137, 80, 78, 71])], 'ok.png', {
            type: 'image/png',
        });
        vi.mocked(accountApi.uploadAvatarFile).mockResolvedValueOnce({
            ...BASE_USER,
            hasAvatar: true,
            avatarUpdatedAt: '2026-11-10T12:00:00Z',
        });
        fireEvent.change(fileInput, { target: { files: [pngFile] } });
        await waitFor(() => {
            expect(accountApi.uploadAvatarFile).toHaveBeenCalledTimes(1);
        });
    });

    it('keeps session on wrong current password 401 and redirects on 204 password change', async () => {
        const { client } = renderSettings();
        await waitFor(() => {
            expect(screen.getByLabelText('Current Password')).toBeTruthy();
        });

        fireEvent.change(screen.getByLabelText('Current Password'), {
            target: { value: 'wrong-pass-123' },
        });
        fireEvent.change(screen.getByLabelText('New Password'), {
            target: { value: 'NewValidPass123!' },
        });

        vi.mocked(authApi.changePassword).mockRejectedValueOnce({
            status: 401,
            code: 'UNAUTHENTICATED',
            message: 'Invalid password',
            name: 'ApiError',
        } satisfies ApiError);

        fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain('Current password is incorrect.');
        });
        expect(screen.queryByTestId('login-reason')).toBeNull();

        vi.mocked(authApi.changePassword).mockResolvedValueOnce(undefined);
        fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
        await waitFor(() => {
            expect(screen.getByTestId('login-reason').textContent).toBe('password-changed');
        });
        expect(client.getQueryData(queryKeys.me)).toBeNull();
    });
});
