import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOAuthProviders, startOAuth } from '../api/oauth';
import { ToastProvider } from '../components/Toaster';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';
vi.mock('../api/oauth', () => ({ getOAuthProviders: vi.fn(), startOAuth: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ login: vi.fn(), signup: vi.fn() }) }));

function Location() {
    return <span data-testid="search">{useLocation().search}</span>;
}
function show(page: React.ReactElement, entry = '/login') {
    return render(
        <QueryClientProvider
            client={
                new QueryClient({
                    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
                })
            }
        >
            <MemoryRouter initialEntries={[entry]}>
                <ToastProvider>
                    {page}
                    <Location />
                </ToastProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOAuthProviders).mockResolvedValue(['google', 'github']);
});
afterEach(cleanup);
describe('OAuth auth forms', () => {
    it.each([
        ['login', <LoginPage />],
        ['signup', <SignupPage />],
    ])('keeps password login and configured provider buttons on %s', async (_name, page) => {
        show(page);
        expect(screen.getByLabelText(/Email address/)).toBeTruthy();
        expect(screen.getByLabelText(/^Password/)).toBeTruthy();
        expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeTruthy();
    });
    it('hides provider buttons when no provider is configured', async () => {
        vi.mocked(getOAuthProviders).mockResolvedValue([]);
        show(<LoginPage />);
        await waitFor(() => expect(getOAuthProviders).toHaveBeenCalled());
        expect(screen.queryByRole('button', { name: /Continue with/ })).toBeNull();
    });
    it('starts the selected provider without credentials and prevents duplicate clicks', async () => {
        vi.mocked(startOAuth).mockReturnValue(new Promise(() => {}));
        show(<LoginPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Continue with GitHub' }));
        await waitFor(() => expect(startOAuth).toHaveBeenCalledWith('github', false));
        await waitFor(() =>
            expect(
                (screen.getByRole('button', { name: /Continue with Google/ }) as HTMLButtonElement)
                    .disabled,
            ).toBe(true),
        );
    });
    it('shows a callback failure once and removes its flag from the URL', async () => {
        show(<LoginPage />, '/login?oauth=failed');
        expect(await screen.findByText(/Unable to continue with that provider/)).toBeTruthy();
        await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
        expect(screen.getAllByText(/Unable to continue with that provider/)).toHaveLength(1);
    });
    it('shows a retryable toast when starting a provider fails', async () => {
        vi.mocked(startOAuth).mockRejectedValue(new Error('Unavailable'));
        show(<SignupPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
        expect(await screen.findByText(/Unable to contact the sign-in provider/)).toBeTruthy();
    });
});
