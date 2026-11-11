import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectAuditLogPage from './ProjectAuditLogPage';

const mockUseProjectAuditLogPage = vi.fn();

vi.mock('../hooks/useAuditLog', () => ({
    useProjectAuditLogPage: (projectId: string, filters: unknown) =>
        mockUseProjectAuditLogPage(projectId, filters),
}));

const renderAuditPage = () =>
    render(
        <MemoryRouter initialEntries={['/projects/proj-1/audit']}>
            <Routes>
                <Route path="/projects/:projectId/audit" element={<ProjectAuditLogPage />} />
            </Routes>
        </MemoryRouter>,
    );

describe('ProjectAuditLogPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
});
