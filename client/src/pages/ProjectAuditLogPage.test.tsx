import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toaster';
import { can as realCan, type Role } from '../lib/permissions';
import ProjectAuditLogPage from './ProjectAuditLogPage';

const mockUseProjectAuditLogPage = vi.fn();
const mockExportAuditLog = vi.fn();
let currentMockRole: Role = 'projectAdmin';

vi.mock('../hooks/useAuditLog', () => ({
    useProjectAuditLogPage: (projectId: string, filters: unknown) =>
        mockUseProjectAuditLogPage(projectId, filters),
    useExportProjectAuditLog: () => ({
        mutateAsync: mockExportAuditLog,
        isPending: false,
    }),
}));

vi.mock('../hooks/usePermissions', () => ({
    usePermissions: () => ({
        role: currentMockRole,
        can: (action: Parameters<typeof realCan>[1], env?: Parameters<typeof realCan>[2]) =>
            realCan(currentMockRole, action, env),
    }),
}));

const renderAuditPage = (initialEntry = '/projects/proj-1/audit') =>
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path="/projects/:projectId/audit" element={<ProjectAuditLogPage />} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>,
    );

describe('ProjectAuditLogPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentMockRole = 'projectAdmin';
        mockExportAuditLog.mockResolvedValue('audit-log-proj-1.csv');
        mockUseProjectAuditLogPage.mockReturnValue({
            data: {
                data: [
                    {
                        id: 'audit-1',
                        projectId: 'proj-1',
                        user: {
                            id: 'user-1',
                            email: 'alice@example.com',
                            username: 'alice',
                            hasAvatar: false,
                            avatarUpdatedAt: null,
                        },
                        action: 'project_updated',
                        result: 'allowed',
                        createdAt: '2026-11-11T09:00:00.000Z',
                    },
                ],
                nextCursor: 'audit-cursor-2',
                hasMore: true,
            },
            isLoading: false,
            isFetching: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        });
    });

    it('renders actor username/title and MVP 2 project update actions', () => {
        renderAuditPage();

        const actorLabel = screen.getByText('@alice');
        expect(actorLabel).toBeTruthy();
        expect(actorLabel.getAttribute('title')).toBe('alice@example.com');
        expect(screen.getByRole('cell', { name: 'Update project details' })).toBeTruthy();
    });

    it('paginates with cursor and resets cursor when a filter changes', () => {
        renderAuditPage();

        expect(mockUseProjectAuditLogPage).toHaveBeenLastCalledWith('proj-1', {
            action: undefined,
            result: undefined,
            environment: undefined,
            cursor: null,
            limit: 25,
        });

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(mockUseProjectAuditLogPage).toHaveBeenLastCalledWith('proj-1', {
            action: undefined,
            result: undefined,
            environment: undefined,
            cursor: 'audit-cursor-2',
            limit: 25,
        });

        fireEvent.change(screen.getByDisplayValue('All Results'), {
            target: { value: 'denied' },
        });

        expect(mockUseProjectAuditLogPage).toHaveBeenLastCalledWith('proj-1', {
            action: undefined,
            result: 'denied',
            environment: undefined,
            cursor: null,
            limit: 25,
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('renders Export CSV and Export JSON for projectAdmin and auditor passing active filters, and hides them for developer', async () => {
        renderAuditPage(
            '/projects/proj-1/audit?action=reveal&result=denied&environment=production',
        );

        fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
        await waitFor(() => {
            expect(mockExportAuditLog).toHaveBeenCalledWith({
                format: 'csv',
                action: 'reveal',
                result: 'denied',
                environment: 'production',
            });
        });

        fireEvent.click(screen.getByRole('button', { name: /Export JSON/i }));
        await waitFor(() => {
            expect(mockExportAuditLog).toHaveBeenCalledWith({
                format: 'json',
                action: 'reveal',
                result: 'denied',
                environment: 'production',
            });
        });

        cleanup();
        currentMockRole = 'auditor';
        renderAuditPage();
        expect(screen.getByRole('button', { name: /Export CSV/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Export JSON/i })).toBeTruthy();

        cleanup();
        currentMockRole = 'developer';
        renderAuditPage();
        expect(screen.queryByRole('button', { name: /Export CSV/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /Export JSON/i })).toBeNull();
    });
});
