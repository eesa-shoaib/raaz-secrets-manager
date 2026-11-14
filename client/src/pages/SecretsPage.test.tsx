import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toaster';
import * as downloadLib from '../lib/download';
import SecretsPage from './SecretsPage';

const mockUseSecretsPage = vi.fn();
const mockWriteText = vi.fn();
const mockGenerateEnvExample = vi.fn();
const mockPermissions = {
    role: 'projectAdmin' as 'projectAdmin' | 'developer' | 'auditor',
    isAdmin: true,
    isDeveloper: false,
    can: vi.fn(() => 'enabled' as 'enabled' | 'disabled' | 'hidden'),
};

vi.mock('../hooks/useSecrets', () => ({
    useSecretsPage: (projectId: string, env: string, params: unknown) =>
        mockUseSecretsPage(projectId, env, params),
    useCreateSecret: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useEditSecret: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteSecret: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useGenerateEnvExample: () => ({ mutateAsync: mockGenerateEnvExample, isPending: false }),
}));

vi.mock('../hooks/usePermissions', () => ({
    usePermissions: () => mockPermissions,
}));

vi.mock('../components/SecretValueCell', () => ({
    SecretValueCell: ({ secretKey }: { secretKey: string }) => (
        <span data-testid={`masked-${secretKey}`}>••••••••</span>
    ),
}));

const renderSecretsPage = (initialEntry = '/projects/proj-1/secrets?environment=development') =>
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path="/projects/:projectId/secrets" element={<SecretsPage />} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>,
    );

describe('SecretsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPermissions.role = 'projectAdmin';
        mockPermissions.isAdmin = true;
        mockPermissions.isDeveloper = false;
        mockPermissions.can = vi.fn(() => 'enabled');
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute('open', '');
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute('open');
        };

        mockWriteText.mockResolvedValue(undefined);
        mockGenerateEnvExample.mockResolvedValue({
            filename: '.env.development.example',
            content: '# .env.example — Demo (development)\nDATABASE_URL=\n',
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: mockWriteText },
        });

        mockUseSecretsPage.mockReturnValue({
            data: {
                data: [
                    {
                        id: 'sec-1',
                        projectId: 'proj-1',
                        environment: 'development',
                        key: 'DATABASE_URL',
                        maskedValue: '••••••••',
                        createdAt: '2026-11-11T08:00:00.000Z',
                        updatedAt: '2026-11-11T08:00:00.000Z',
                        lastAccessedAt: null,
                    },
                ],
                nextCursor: 'cursor-next-1',
                hasMore: true,
            },
            isLoading: false,
            isFetching: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    it('copies only the secret key to the clipboard when Copy is clicked', async () => {
        renderSecretsPage();

        const copyBtn = screen.getByRole('button', { name: 'Copy key DATABASE_URL' });
        await act(async () => {
            fireEvent.click(copyBtn);
        });

        expect(mockWriteText).toHaveBeenCalledTimes(1);
        expect(mockWriteText).toHaveBeenCalledWith('DATABASE_URL');
        expect(screen.getByRole('button', { name: 'Copy key DATABASE_URL' }).textContent).toContain(
            'Copied!',
        );
    });

    it('supports cursor pagination via Next and Previous controls', () => {
        renderSecretsPage();

        expect(mockUseSecretsPage).toHaveBeenLastCalledWith('proj-1', 'development', {
            cursor: null,
            limit: 25,
            search: undefined,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(mockUseSecretsPage).toHaveBeenLastCalledWith('proj-1', 'development', {
            cursor: 'cursor-next-1',
            limit: 25,
            search: undefined,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        expect(mockUseSecretsPage).toHaveBeenLastCalledWith('proj-1', 'development', {
            cursor: null,
            limit: 25,
            search: undefined,
        });
    });

    it('debounces key search queries and resets cursor', () => {
        vi.useFakeTimers();
        renderSecretsPage();

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(mockUseSecretsPage).toHaveBeenLastCalledWith('proj-1', 'development', {
            cursor: 'cursor-next-1',
            limit: 25,
            search: undefined,
        });

        fireEvent.change(screen.getByLabelText('Search secret keys'), {
            target: { value: 'stripe' },
        });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(mockUseSecretsPage).toHaveBeenLastCalledWith('proj-1', 'development', {
            cursor: null,
            limit: 25,
            search: 'stripe',
        });
    });

    it('resets cursor when switching environments', () => {
        renderSecretsPage();

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(screen.getByRole('button', { name: /Staging/i }));

        expect(mockUseSecretsPage).toHaveBeenLastCalledWith('proj-1', 'staging', {
            cursor: null,
            limit: 25,
            search: undefined,
        });
    });

    it('omits Last Accessed and Created columns and uses accessible icon buttons', () => {
        renderSecretsPage();

        expect(screen.queryByRole('columnheader', { name: 'Last Accessed' })).toBeNull();
        expect(screen.queryByRole('columnheader', { name: 'Created' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Copy key DATABASE_URL' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Edit DATABASE_URL' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Delete DATABASE_URL' })).toBeTruthy();
    });

    it('generates, copies, and downloads .env.example for the active environment', async () => {
        const downloadSpy = vi.spyOn(downloadLib, 'downloadTextFile').mockImplementation(() => {});
        renderSecretsPage();

        fireEvent.click(screen.getByRole('button', { name: /Generate \.env\.example/i }));

        await waitFor(() => {
            expect(mockGenerateEnvExample).toHaveBeenCalledWith('development');
            expect(screen.getByTestId('env-example-preview').textContent).toContain(
                'DATABASE_URL=',
            );
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Copy \.env\.example/i }));
        });
        expect(mockWriteText).toHaveBeenCalledWith(
            '# .env.example — Demo (development)\nDATABASE_URL=\n',
        );

        fireEvent.click(screen.getByRole('button', { name: /Download \.env\.example/i }));
        expect(downloadSpy).toHaveBeenCalledWith(
            '.env.development.example',
            '# .env.example — Demo (development)\nDATABASE_URL=\n',
        );
        downloadSpy.mockRestore();
    });
});
