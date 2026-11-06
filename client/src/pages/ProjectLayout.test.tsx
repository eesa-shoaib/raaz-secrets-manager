import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => mocks.navigate,
    useParams: () => ({ projectId: 'aaaaaaaaaaaaaaaaaaaaaaaa' }),
    useLocation: () => ({ pathname: '/projects/aaaaaaaaaaaaaaaaaaaaaaaa/secrets' }),
    Outlet: () => null,
}));
vi.mock('../hooks/useProjects', () => ({
    useProject: () => ({
        data: {
            id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'Test project',
            role: 'developer',
            status: 'active',
        },
        isLoading: false,
        isError: false,
    }),
}));
vi.mock('../components/TabNav', () => ({ TabNav: () => null }));
import { ProjectLayout } from './ProjectLayout';

describe('project back navigation', () => {
    const originalState = window.history.state;
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        window.history.replaceState(originalState, '');
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
