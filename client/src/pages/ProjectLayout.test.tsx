import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), status: 'active' }));
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
            role: 'developer',
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
        window.history.replaceState(originalState, '');
    });
    it('shows project details separately from the routed content', () => {
        render(<ProjectLayout />);
        expect(
            screen.getByRole('complementary', { name: 'Project information' }).textContent,
        ).toContain('Test project');
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
    it('navigates to the previous in-app page when history exists', () => {
        window.history.replaceState({ idx: 1 }, '');
        render(<ProjectLayout />);
        fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
        expect(mocks.navigate).toHaveBeenCalledWith(-1);
    });
    it('falls back to projects for a direct entry', () => {
        window.history.replaceState({ idx: 0 }, '');
        render(<ProjectLayout />);
        fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
        expect(mocks.navigate).toHaveBeenCalledWith('/projects', { replace: true });
    });
});
