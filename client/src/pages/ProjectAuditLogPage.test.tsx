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
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute('open', '');
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute('open');
        };
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

    it('renders single Export button that opens modal with format and filter options for projectAdmin/auditor, and hides it for developer', async () => {
        renderAuditPage(
            '/projects/proj-1/audit?action=reveal&result=denied&environment=production',
        );

        // Open Export Modal
        fireEvent.click(screen.getByRole('button', { name: /^Export$/i }));
        expect(screen.getByText('Export Audit Log')).toBeTruthy();

        // Modal defaults to CSV and pre-fills active page filters
        expect((screen.getByLabelText('Export action filter') as HTMLSelectElement).value).toBe(
            'reveal',
        );
        expect((screen.getByLabelText('Export result filter') as HTMLSelectElement).value).toBe(
            'denied',
        );
        expect(
            (screen.getByLabelText('Export environment filter') as HTMLSelectElement).value,
        ).toBe('production');

        // Submit CSV export
        fireEvent.click(screen.getByRole('button', { name: /Download CSV/i }));
        await waitFor(() => {
            expect(mockExportAuditLog).toHaveBeenCalledWith({
                format: 'csv',
                action: 'reveal',
                result: 'denied',
                environment: 'production',
            });
        });

        // Re-open modal, switch to JSON and adjust filter inside modal
        fireEvent.click(screen.getByRole('button', { name: /^Export$/i }));
        fireEvent.click(screen.getByLabelText(/JSON \(\.json\)/i));
        fireEvent.change(screen.getByLabelText('Export result filter'), {
            target: { value: 'allowed' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Download JSON/i }));

        await waitFor(() => {
            expect(mockExportAuditLog).toHaveBeenCalledWith({
                format: 'json',
                action: 'reveal',
                result: 'allowed',
                environment: 'production',
            });
        });

        cleanup();
        currentMockRole = 'auditor';
        renderAuditPage();
        expect(screen.getByRole('button', { name: /^Export$/i })).toBeTruthy();

        cleanup();
        currentMockRole = 'developer';
        renderAuditPage();
        expect(screen.queryByRole('button', { name: /^Export$/i })).toBeNull();
    });
});
