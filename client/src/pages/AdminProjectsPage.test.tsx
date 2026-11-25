import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from '../api/adminProjects';
import { ToastProvider } from '../components/Toaster';
import { ApiError } from '../lib/errorHandling';
import AdminProjectsPage from './AdminProjectsPage';
vi.mock('../api/adminProjects', () => ({
    getAdminProjects: vi.fn(),
    getAdminProjectAuditLog: vi.fn(),
    setAdminProjectStatus: vi.fn(),
    deleteProject: vi.fn(),
}));
beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open');
    };
    vi.mocked(api.getAdminProjects).mockResolvedValue({
        data: [
            {
                id: 'project-id',
                name: 'Example API',
                status: 'active',
                memberCount: 2,
                createdAt: new Date(),
            },
        ],
        total: 1,
        limit: 25,
        hasMore: false,
        nextCursor: null,
    });
    vi.mocked(api.setAdminProjectStatus).mockResolvedValue(undefined);
    vi.mocked(api.getAdminProjectAuditLog).mockResolvedValue({
        data: [
            {
                id: 'audit-1',
                action: 'project_archived',
                result: 'allowed',
                createdAt: new Date(),
                user: {
                    id: 'admin-1',
                    email: 'admin@example.test',
                    username: 'admin',
                    hasAvatar: false,
                    avatarUpdatedAt: null,
                },
                projectId: 'project-id',
                projectName: 'Example API',
            },
        ],
        total: 1,
        limit: 25,
        hasMore: false,
        nextCursor: null,
    });
});
afterEach(cleanup);
function show() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <ToastProvider>
                    <AdminProjectsPage />
                </ToastProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}
it('requires archive confirmation and supports status and literal search filters', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Example API' }));
    expect(api.setAdminProjectStatus).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(api.setAdminProjectStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Archive Example API' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
        expect(api.setAdminProjectStatus).toHaveBeenCalledWith('project-id', 'archived'),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: '.*' } });
    await waitFor(() =>
        expect(api.getAdminProjects).toHaveBeenLastCalledWith(
            expect.objectContaining({ search: '.*' }),
        ),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));
    await waitFor(() =>
        expect(api.getAdminProjects).toHaveBeenLastCalledWith(
            expect.objectContaining({ status: 'archived' }),
        ),
    );
});
it('keeps a failed status change visible in the confirmation dialog', async () => {
    vi.mocked(api.setAdminProjectStatus).mockRejectedValue(
        new ApiError(500, 'INTERNAL_ERROR', 'Unable to save project'),
    );
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Example API' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to save project');
    expect(screen.getByRole('dialog')).toBeTruthy();
});

it('shows project lifecycle audit entries with action and result filters', async () => {
    show();
    fireEvent.click(screen.getByRole('tab', { name: 'Audit Log' }));
    expect(await screen.findByText('Example API')).toBeTruthy();
    expect(screen.getByText('@admin')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter project audit by action'), {
        target: { value: 'project_archived' },
    });
    await waitFor(() =>
        expect(api.getAdminProjectAuditLog).toHaveBeenLastCalledWith(
            expect.objectContaining({ action: 'project_archived' }),
        ),
    );
    fireEvent.change(screen.getByLabelText('Filter project audit by result'), {
        target: { value: 'denied' },
    });
    await waitFor(() =>
        expect(api.getAdminProjectAuditLog).toHaveBeenLastCalledWith(
            expect.objectContaining({ action: 'project_archived', result: 'denied' }),
        ),
    );
});
