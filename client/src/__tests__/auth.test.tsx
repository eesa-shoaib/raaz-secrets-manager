/**
 * @vitest-environment jsdom
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authApi from '../api/auth';
import { notifyUnauthenticated } from '../api/axios';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { queryClient } from '../lib/queryClient';

vi.mock('../api/auth', () => ({
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    signup: vi.fn(),
}));

function AuthConsumer() {
    const { user, login, logout } = useAuth();
    return (
        <div>
            <div data-testid="user-email">{user ? user.email : 'anonymous'}</div>
            <button onClick={() => login({ email: 'user@example.com', password: 'password123' })}>
                Sign In
            </button>
            <button onClick={() => logout()}>Sign Out</button>
        </div>
    );
}

describe('AuthContext and 401 chain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        queryClient.clear();
    });

    it('bootstraps anonymous state cleanly when getMe returns null', async () => {
        vi.mocked(authApi.getMe).mockResolvedValueOnce(null);

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <AuthProvider>
                        <AuthConsumer />
                    </AuthProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('user-email').textContent).toBe('anonymous');
        });
    });

    it('loads current user when getMe succeeds', async () => {
        vi.mocked(authApi.getMe).mockResolvedValueOnce({
            id: '507f1f77bcf86cd799439011',
            email: 'admin@raaz.dev',
            isPlatformAdmin: false,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <AuthProvider>
                        <AuthConsumer />
                    </AuthProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('user-email').textContent).toBe('admin@raaz.dev');
        });
    });

    it('clears query cache on unauthenticated notification', async () => {
        vi.mocked(authApi.getMe).mockResolvedValueOnce({
            id: '507f1f77bcf86cd799439011',
            email: 'test@raaz.dev',
            isPlatformAdmin: false,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/projects']}>
                    <AuthProvider>
                        <AuthConsumer />
                    </AuthProvider>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId('user-email').textContent).toBe('test@raaz.dev');
        });

        // Seed private query cache data
        queryClient.setQueryData(['projects'], [{ id: 'p1', name: 'Secret Project' }]);
        expect(queryClient.getQueryData(['projects'])).toBeDefined();

        // Trigger 401 unauthenticated notification
        act(() => {
            notifyUnauthenticated();
        });

        // Query client cache should be purged
        expect(queryClient.getQueryData(['projects'])).toBeUndefined();
    });
});
