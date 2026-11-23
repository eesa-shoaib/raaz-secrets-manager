import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountApi from '../api/account';
import * as authApi from '../api/auth';
import { startOAuth } from '../api/oauth';
import { ToastProvider } from '../components/Toaster';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import type { ApiError } from '../lib/errorHandling';
import { queryKeys } from '../lib/queryClient';
import SettingsPage from './SettingsPage';

vi.mock('../api/oauth', () => ({ getOAuthProviders: vi.fn(), startOAuth: vi.fn() }));

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
    deactivateAccount: vi.fn(),
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
    return (
        <div data-testid="login-reason">{(loc.state as { reason?: string } | null)?.reason}</div>
    );
}

describe('SettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute('open', '');
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute('open');
        };
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
                    <ThemeProvider>
                        <AuthProvider>
                            <ToastProvider>
                                <Routes>
                                    <Route path="/settings" element={<SettingsPage />} />
                                    <Route path="/login" element={<LoginSentinel />} />
                                </Routes>
                            </ToastProvider>
                        </AuthProvider>
                    </ThemeProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );
        return { client, ...utils };
    }

    it('uses provider confirmation instead of password controls for an OAuth-only user', async () => {
        vi.mocked(authApi.getMe).mockResolvedValue({
            ...BASE_USER,
            hasPassword: false,
            oauthProvider: 'google',
        });
        vi.mocked(startOAuth).mockReturnValue(new Promise(() => {}));
        renderSettings();
        fireEvent.click(await screen.findByRole('button', { name: 'Account' }));
        expect(screen.getByText('Signed in with Google')).toBeTruthy();
        expect(
            (screen.getByRole('button', { name: 'Password settings' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Deactivate Account' }));
        expect(screen.queryByLabelText('Confirm Current Password')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Confirm Deactivation' }));
        await waitFor(() => expect(startOAuth).toHaveBeenCalledWith('google', true));
        expect(accountApi.deactivateAccount).not.toHaveBeenCalled();
    });

    it('preserves a profile draft when switching compact settings sections', async () => {
        renderSettings();
        const username = await screen.findByLabelText('Username');
        expect((screen.getByLabelText('Email') as HTMLInputElement).readOnly).toBe(true);
        fireEvent.change(username, { target: { value: 'unsaved_name' } });

        fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
        expect(screen.queryByLabelText('Username')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Appearance' }).getAttribute('aria-current'),
        ).toBe('page');
        expect(screen.queryByRole('button', { name: 'Deactivate Account' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Account' }));
        expect(screen.getByRole('button', { name: 'Password settings' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Select Default theme/i })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
        expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('unsaved_name');
        expect(accountApi.updateProfile).not.toHaveBeenCalled();
    });

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
        const openFilePicker = vi.spyOn(fileInput as HTMLInputElement, 'click');
        fireEvent.click(screen.getByRole('button', { name: 'Edit profile picture' }));
        expect(openFilePicker).toHaveBeenCalledOnce();
        expect(screen.queryByText('Change photo')).toBeNull();
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

    it('opens Password settings modal, validates confirm password, handles 401/429, resets on cancel, and redirects on 204', async () => {
        const { client } = renderSettings();
        fireEvent.click(await screen.findByRole('button', { name: 'Account' }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Password settings/i })).toBeTruthy();
        });

        // Inline password form should not be mounted before opening modal
        expect(screen.queryByLabelText(/Current password/i)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Password settings/i }));

        await waitFor(() => {
            expect(screen.getByLabelText(/Current password/i)).toBeTruthy();
            expect(screen.getByLabelText(/^New password/i)).toBeTruthy();
            expect(screen.getByLabelText(/Confirm new password/i)).toBeTruthy();
        });

        // Client-side mismatch validation prevents submission
        fireEvent.change(screen.getByLabelText(/Current password/i), {
            target: { value: 'wrong-pass-123' },
        });
        fireEvent.change(screen.getByLabelText(/^New password/i), {
            target: { value: 'NewValidPass123!' },
        });
        fireEvent.change(screen.getByLabelText(/Confirm new password/i), {
            target: { value: 'DifferentPass999!' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

        await waitFor(() => {
            expect(screen.getByText('New passwords do not match')).toBeTruthy();
        });
        expect(authApi.changePassword).not.toHaveBeenCalled();

        // Matching confirm password triggers API call -> 401 keeps session intact
        fireEvent.change(screen.getByLabelText(/Confirm new password/i), {
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
            expect(screen.getByRole('alert').textContent).toContain(
                'Current password is incorrect.',
            );
        });
        expect(authApi.changePassword).toHaveBeenCalledWith({
            currentPassword: 'wrong-pass-123',
            newPassword: 'NewValidPass123!',
        });
        expect(screen.queryByTestId('login-reason')).toBeNull();

        // Cancel resets fields and server error on reopen
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => {
            expect(screen.queryByLabelText(/Current password/i)).toBeNull();
        });

        fireEvent.click(screen.getByRole('button', { name: /Password settings/i }));
        await waitFor(() => {
            expect((screen.getByLabelText(/Current password/i) as HTMLInputElement).value).toBe('');
        });
        expect(screen.queryByText('Current password is incorrect.')).toBeNull();

        // 429 rate-limit feedback
        fireEvent.change(screen.getByLabelText(/Current password/i), {
            target: { value: 'CurrentPass123!' },
        });
        fireEvent.change(screen.getByLabelText(/^New password/i), {
            target: { value: 'FreshValidPass123!' },
        });
        fireEvent.change(screen.getByLabelText(/Confirm new password/i), {
            target: { value: 'FreshValidPass123!' },
        });
        vi.mocked(authApi.changePassword).mockRejectedValueOnce({
            status: 429,
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            name: 'ApiError',
        } satisfies ApiError);

        fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain(
                'Too many attempts, try again in 15 minutes.',
            );
        });

        // 204 success clears cache and navigates to /login
        vi.mocked(authApi.changePassword).mockResolvedValueOnce(undefined);
        fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
        await waitFor(() => {
            expect(screen.getByTestId('login-reason').textContent).toBe('password-changed');
        });
        expect(client.getQueryData(queryKeys.me)).toBeNull();
    });

    it('handles self-deactivation 401/409 errors and redirects to login on 204', async () => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute('open', '');
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute('open');
        };

        const { client } = renderSettings();
        fireEvent.click(await screen.findByRole('button', { name: 'Account' }));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Deactivate Account' })).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Deactivate Account' }));

        await waitFor(() => {
            expect(screen.getByLabelText('Confirm Current Password')).toBeTruthy();
        });

        fireEvent.change(screen.getByLabelText('Confirm Current Password'), {
            target: { value: 'wrongpassword' },
        });

        vi.mocked(accountApi.deactivateAccount).mockRejectedValueOnce({
            status: 401,
            code: 'UNAUTHENTICATED',
            message: 'Invalid password',
            name: 'ApiError',
        } satisfies ApiError);

        fireEvent.click(screen.getByRole('button', { name: 'Confirm Deactivation' }));

        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain(
                'Current password is incorrect.',
            );
        });
        expect(screen.queryByTestId('login-reason')).toBeNull();

        vi.mocked(accountApi.deactivateAccount).mockRejectedValueOnce({
            status: 409,
            code: 'CONFLICT',
            message: 'Cannot deactivate the last active Platform Admin.',
            name: 'ApiError',
        } satisfies ApiError);

        fireEvent.click(screen.getByRole('button', { name: 'Confirm Deactivation' }));

        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain(
                'Cannot deactivate the last active Platform Admin.',
            );
        });

        vi.mocked(accountApi.deactivateAccount).mockResolvedValueOnce(undefined);
        fireEvent.click(screen.getByRole('button', { name: 'Confirm Deactivation' }));

        await waitFor(() => {
            expect(screen.getByTestId('login-reason').textContent).toBe('account-deactivated');
        });
        expect(client.getQueryData(queryKeys.me)).toBeNull();
    });

    it('renders theme palette options and switches themes with localStorage persistence', async () => {
        window.localStorage.clear();
        document.documentElement.removeAttribute('data-theme');

        renderSettings();
        fireEvent.click(await screen.findByRole('button', { name: 'Appearance' }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy();
        });

        // Verify all 4 themes are rendered
        expect(screen.getByRole('button', { name: /select default theme/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /select midnight theme/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /select nordic forest theme/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /select velvet sunset theme/i })).toBeTruthy();

        // Default theme starts active
        expect(document.documentElement.getAttribute('data-theme')).toBe('default');
        const defaultBtn = screen.getByRole('button', { name: /select default theme/i });
        expect(defaultBtn.getAttribute('aria-pressed')).toBe('true');

        // Switch to Midnight theme
        const midnightBtn = screen.getByRole('button', { name: /select midnight theme/i });
        fireEvent.click(midnightBtn);

        expect(document.documentElement.getAttribute('data-theme')).toBe('midnight');
        expect(window.localStorage.getItem('raaz_theme')).toBe('midnight');
        expect(midnightBtn.getAttribute('aria-pressed')).toBe('true');
        expect(defaultBtn.getAttribute('aria-pressed')).toBe('false');

        // Switch to Nordic Forest (emerald)
        const emeraldBtn = screen.getByRole('button', { name: /select nordic forest theme/i });
        fireEvent.click(emeraldBtn);
        expect(document.documentElement.getAttribute('data-theme')).toBe('emerald');
        expect(window.localStorage.getItem('raaz_theme')).toBe('emerald');

        // Switch to Velvet Sunset (amethyst)
        const amethystBtn = screen.getByRole('button', { name: /select velvet sunset theme/i });
        fireEvent.click(amethystBtn);
        expect(document.documentElement.getAttribute('data-theme')).toBe('amethyst');
        expect(window.localStorage.getItem('raaz_theme')).toBe('amethyst');

        // Switch back to Default
        fireEvent.click(defaultBtn);
        expect(document.documentElement.getAttribute('data-theme')).toBe('default');
        expect(window.localStorage.getItem('raaz_theme')).toBe('default');
    });
});
