import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    cleanup,
    fireEvent,
    render as renderView,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function render(element: React.ReactElement) {
    return renderView(
        <QueryClientProvider
            client={
                new QueryClient({
                    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
                })
            }
        >
            {element}
        </QueryClientProvider>,
    );
}
const deletionApi = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock('../api/adminProjects', () => ({
    deleteProject: deletionApi.remove,
    getAdminProjects: vi.fn(),
    setAdminProjectStatus: vi.fn(),
}));
const mocks = vi.hoisted(() => ({
    role: 'developer' as 'developer' | 'projectAdmin',
    navigate: vi.fn(),
    status: 'active',
}));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => mocks.navigate,
    useParams: () => ({ projectId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }),
    useLocation: () => ({ pathname: '/projects/aaaaaaaaaaaaaaaaaaaaaaaa/secrets' }),
    Outlet: () => <div>Project content</div>,
}));
vi.mock('../hooks/useProjects', () => ({
    useProject: () => ({
        data: {
            id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Test project',
            description: 'Project summary text',
            role: mocks.role,
            memberCount: 3,
            status: mocks.status,
        },
        isLoading: false,
        isError: false,
    }),
    useUpdateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../components/Toaster', () => ({
    useToast: () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }),
}));
vi.mock('../components/TabNav', () => ({ TabNav: () => null }));
import { ProjectLayout } from './ProjectLayout';

describe('project back navigation', () => {
    const originalState = window.history.state;
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        mocks.status = 'active';
        mocks.role = 'developer';
        window.history.replaceState(originalState, '');
    });
    it('shows project details separately from the routed content', () => {
        render(<ProjectLayout />);
        const asideText = screen.getByRole('complementary', {
            name: 'Project information',
        }).textContent;
        expect(asideText).toContain('Test project');
        expect(asideText).toContain('Project summary text');
        expect(asideText).toContain('Members');
        expect(asideText).toContain('3');
        expect(screen.getByText('Project')).toBeTruthy();
        expect(screen.getByText('Role')).toBeTruthy();
        expect(screen.queryByText('Active')).toBeNull();
        expect(screen.getByText('Project content')).toBeTruthy();
    });
    it('shows project status when archived', () => {
        mocks.status = 'archived';
        render(<ProjectLayout />);
        expect(screen.getByText('Archived')).toBeTruthy();
    });
    it('returns to the projects list even when tab history exists', () => {
        window.history.replaceState({ idx: 1 }, '');
        render(<ProjectLayout />);
        fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
        expect(mocks.navigate).toHaveBeenCalledWith('/projects', { replace: true });
    });
    it('falls back to projects for a direct entry', () => {
        window.history.replaceState({ idx: 0 }, '');
        render(<ProjectLayout />);
        fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
        expect(mocks.navigate).toHaveBeenCalledWith('/projects', { replace: true });
    });
});

it('requires the exact project name before deleting and returns to Projects', async () => {
    mocks.role = 'projectAdmin';
    deletionApi.remove.mockResolvedValue(undefined);
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open');
    };
    render(<ProjectLayout />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete project' });
    expect(
        (within(dialog).getByRole('button', { name: 'Delete project' }) as HTMLButtonElement)
            .disabled,
    ).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Type the project name/), {
        target: { value: 'wrong' },
    });
    expect(deletionApi.remove).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Type the project name/), {
        target: { value: 'Test project' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete project' }));
    await waitFor(() =>
        expect(deletionApi.remove).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaa', 'Test project'),
    );
    await waitFor(() =>
        expect(mocks.navigate).toHaveBeenCalledWith('/projects', {
            replace: true,
            state: undefined,
        }),
    );
    cleanup();
    mocks.role = 'developer';
});
