import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as github from '../api/github';
import { ToastProvider } from '../components/Toaster';
import { ApiError } from '../lib/errorHandling';
import ProjectsPage from './ProjectsPage';

vi.mock('../api/github', () => ({
    getGitHubConnection: vi.fn(),
    startGitHubConnection: vi.fn(),
    disconnectGitHub: vi.fn(),
    getGitHubInstallations: vi.fn(),
    getGitHubRepositories: vi.fn(),
    importGitHubRepository: vi.fn(),
}));
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'user', email: 'person@example.test' } }),
}));
vi.mock('../hooks/useProjects', () => ({
    useProjectsPage: () => ({ data: { data: [], total: 0, limit: 9 }, isLoading: false }),
    useCreateProject: () => ({ mutateAsync: vi.fn() }),
}));
const repository = {
    id: 101,
    owner: 'team',
    name: 'api',
    description: 'Backend service',
    url: 'https://github.com/team/api',
    private: true,
};
const status = {
    enabled: true,
    connected: true,
    login: 'connected-user',
    manageUrl: 'https://github.com/apps/raaz/installations/new',
};
beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open');
    };
    vi.mocked(github.getGitHubConnection).mockResolvedValue(status);
    vi.mocked(github.getGitHubInstallations).mockResolvedValue({
        data: [{ id: 11, account: 'team', selection: 'selected' }],
        page: 1,
        limit: 25,
        total: 1,
    });
    vi.mocked(github.getGitHubRepositories).mockResolvedValue({
        data: [repository],
        page: 1,
        limit: 10,
        total: 1,
    });
});
afterEach(cleanup);
function show() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/projects']}>
                <ToastProvider>
                    <Routes>
                        <Route path="/projects" element={<ProjectsPage />} />
                        <Route
                            path="/projects/:id/secrets"
                            element={<p>Imported project opened</p>}
                        />
                    </Routes>
                </ToastProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}
async function open() {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Import from GitHub' }));
}
describe('GitHub repository import UI', () => {
    it('reviews the name without descriptions, enables mocks and opens the project', async () => {
        vi.mocked(github.importGitHubRepository).mockResolvedValue({
            created: true,
            mockSecretsCreated: 2,
            project: {
                id: 'imported',
                name: 'Reviewed API',
                description: 'Backend service',
                environments: ['development', 'staging', 'production'],
                status: 'active',
                createdBy: 'user',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        await open();
        fireEvent.click(await screen.findByRole('button', { name: 'Select team/api' }));
        const dialog = screen.getByRole('dialog', { name: 'Import from GitHub' });
        expect(within(dialog).queryByLabelText('Project description')).toBeNull();
        expect(within(dialog).queryByText('Backend service')).toBeNull();
        fireEvent.change(within(dialog).getByLabelText(/Project name/), {
            target: { value: 'Reviewed API' },
        });
        expect(github.importGitHubRepository).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Import project' }));
        await screen.findByText('Imported project opened');
        expect(vi.mocked(github.importGitHubRepository).mock.calls[0][0]).toEqual({
            installationId: 11,
            repositoryId: 101,
            name: 'Reviewed API',
            description: 'Backend service',
            seedExampleSecrets: true,
        });
    });
    it('refreshes newly added repositories without another login and supports literal search', async () => {
        await open();
        await screen.findByRole('button', { name: 'Select team/api' });
        vi.mocked(github.getGitHubRepositories).mockResolvedValue({
            data: [repository, { ...repository, id: 102, name: 'future' }],
            page: 1,
            limit: 10,
            total: 2,
        });
        await waitFor(() =>
            expect(
                (screen.getByRole('button', { name: 'Refresh repositories' }) as HTMLButtonElement)
                    .disabled,
            ).toBe(false),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Refresh repositories' }));
        await screen.findByRole('button', { name: 'Select team/future' });
        fireEvent.change(screen.getByLabelText('Search GitHub repositories'), {
            target: { value: '.*' },
        });
        await waitFor(() =>
            expect(github.getGitHubRepositories).toHaveBeenLastCalledWith(11, 1, '.*'),
        );
        expect(github.startGitHubConnection).not.toHaveBeenCalled();
    });
    it('requires explicit connect and never silently links by email', async () => {
        vi.mocked(github.getGitHubConnection).mockResolvedValue({
            ...status,
            connected: false,
            login: null,
        });
        vi.mocked(github.startGitHubConnection).mockReturnValue(new Promise(() => {}));
        await open();
        expect(github.getGitHubRepositories).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
        await waitFor(() => expect(github.startGitHubConnection).toHaveBeenCalledWith('projects'));
    });
    it('keeps Raaz usable when repository authorization expires', async () => {
        vi.mocked(github.getGitHubRepositories).mockRejectedValue(
            new ApiError(409, 'CONFLICT', 'Reconnect GitHub to continue'),
        );
        await open();
        expect((await screen.findByRole('alert')).textContent).toContain('Reconnect GitHub');
        expect(screen.getByRole('button', { name: 'Reconnect GitHub' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByRole('heading', { name: 'Projects' })).toBeTruthy();
        expect(github.importGitHubRepository).not.toHaveBeenCalled();
    });
});
