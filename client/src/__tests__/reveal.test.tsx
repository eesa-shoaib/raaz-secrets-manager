/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as secretsApi from '../api/secrets';
import { SecretValueCell } from '../components/SecretValueCell';
import { ToastProvider } from '../components/Toaster';

vi.mock('../api/secrets', () => ({
    revealSecret: vi.fn(),
    getSecrets: vi.fn(),
    createSecret: vi.fn(),
    editSecret: vi.fn(),
    deleteSecret: vi.fn(),
}));

describe('SecretValueCell reveal security and lifecycle', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });

        if (typeof window !== 'undefined' && window.HTMLDialogElement) {
            window.HTMLDialogElement.prototype.showModal = vi.fn(function (
                this: HTMLDialogElement,
            ) {
                this.open = true;
            });
            window.HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
                this.open = false;
            });
        }
    });

    function renderCell(environment: 'development' | 'production' = 'development') {
        return render(
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <SecretValueCell
                        secretId="507f1f77bcf86cd799439011"
                        secretKey="DATABASE_URL"
                        projectId="507f191e810c19729de860ea"
                        environment={environment}
                        canReveal={true}
                    />
                </ToastProvider>
            </QueryClientProvider>,
        );
    }

    it('renders fixed-width mask in idle state without value', () => {
        renderCell('development');
        expect(screen.getByText('••••••••')).toBeDefined();
        expect(screen.getByRole('button', { name: /reveal secret database_url/i })).toBeDefined();
    });

    it('reveals secret in development without confirmation dialog', async () => {
        vi.mocked(secretsApi.revealSecret).mockResolvedValueOnce({
            value: 'postgres://user:secret@localhost:5432/db',
        });

        renderCell('development');
        const revealBtn = screen.getByRole('button', { name: /reveal secret database_url/i });
        fireEvent.click(revealBtn);

        await waitFor(() => {
            expect(secretsApi.revealSecret).toHaveBeenCalledWith(
                '507f191e810c19729de860ea',
                '507f1f77bcf86cd799439011',
                false, // confirm: false in non-production
            );
            expect(screen.getByText('postgres://user:secret@localhost:5432/db')).toBeDefined();
        });

        // Security invariant: value is NOT stored in QueryClient cache!
        const queryCacheData = JSON.stringify(queryClient.getQueryCache().getAll());
        expect(queryCacheData).not.toContain('postgres://user:secret@localhost:5432/db');

        // Click Hide to clear value
        const hideBtn = screen.getByRole('button', { name: /hide secret value/i });
        fireEvent.click(hideBtn);

        expect(screen.queryByText('postgres://user:secret@localhost:5432/db')).toBeNull();
        expect(screen.getByText('••••••••')).toBeDefined();
    });

    it('requires confirmation before revealing a production secret', async () => {
        vi.mocked(secretsApi.revealSecret).mockResolvedValueOnce({
            value: 'prod-secret-password-xyz',
        });

        renderCell('production');
        const revealBtn = screen.getByRole('button', { name: /reveal secret database_url/i });
        fireEvent.click(revealBtn);

        // Dialog appears; NO request sent yet!
        expect(screen.getByText(/reveal production secret/i)).toBeDefined();
        expect(secretsApi.revealSecret).not.toHaveBeenCalled();

        // Cancel sends nothing and returns to idle
        const cancelBtn = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelBtn);

        expect(secretsApi.revealSecret).not.toHaveBeenCalled();

        // Open again and confirm
        fireEvent.click(revealBtn);
        const confirmBtn = screen.getByRole('button', { name: /confirm reveal/i });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(secretsApi.revealSecret).toHaveBeenCalledWith(
                '507f191e810c19729de860ea',
                '507f1f77bcf86cd799439011',
                true, // confirm: true after production modal confirmation
            );
            expect(screen.getByText('prod-secret-password-xyz')).toBeDefined();
        });
    });

    it('does not render reveal button for roles without reveal permission', () => {
        render(
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <SecretValueCell
                        secretId="507f1f77bcf86cd799439011"
                        secretKey="DATABASE_URL"
                        projectId="507f191e810c19729de860ea"
                        environment="development"
                        canReveal={false}
                    />
                </ToastProvider>
            </QueryClientProvider>,
        );

        expect(screen.getByText('••••••••')).toBeDefined();
        expect(screen.queryByRole('button', { name: /reveal/i })).toBeNull();
    });
});
