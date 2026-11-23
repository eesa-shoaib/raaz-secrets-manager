import type { ProjectResponse } from '@raaz/shared-schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as projectsApi from '../api/projects';
import { ToastProvider } from '../components/Toaster';
import { useProjectsPage } from '../hooks/useProjects';
import { queryKeys } from '../lib/queryClient';
import ProjectsPage from './ProjectsPage';

vi.mock('../api/projects', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../api/projects')>();
    return {
        ...actual,
        getProjectsPage: vi.fn(),
        createProject: vi.fn(),
    };
});

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        user: {
            id: 'user-1',
            email: 'owner@raaz.dev',
            username: 'owner',
            hasAvatar: false,
            avatarUpdatedAt: null,
            isPlatformAdmin: false,
            isActive: true,
        },
    }),
}));

function makeProjects(count: number, offset = 0): ProjectResponse[] {
    return Array.from({ length: count }, (_, idx) => ({
        id: `proj-${offset + idx + 1}`,
        name: `Project ${offset + idx + 1}`,
        description: '',
        environments: ['development', 'staging', 'production'],
        status: 'active',
        createdBy: 'user-1',
        role: 'projectAdmin',
        createdAt: '2026-11-12T10:00:00.000Z',
        updatedAt: '2026-11-12T10:00:00.000Z',
    }));
}

describe('ProjectsPage 9-item pagination', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        HTMLDialogElement.prototype.showModal = vi.fn();
        HTMLDialogElement.prototype.close = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    function renderProjectsPage() {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });
        return {
            client,
            ...render(
                <QueryClientProvider client={client}>
                    <ToastProvider>
                        <MemoryRouter initialEntries={['/projects']}>
                            <Routes>
                                <Route path="/projects" element={<ProjectsPage />} />
                            </Routes>
                        </MemoryRouter>
                    </ToastProvider>
                </QueryClientProvider>,
            ),
        };
    }

    it('requests 9 projects per page and supports Next, Previous, and First page controls', async () => {
        vi.mocked(projectsApi.getProjectsPage).mockImplementation(async (params) => {
            if (params?.cursor === 'cursor-page-2') {
                return {
                    data: makeProjects(9, 9),
                    nextCursor: 'cursor-page-3',
                    hasMore: true,
                    total: 21,
                    limit: 9,
                };
            }
            if (params?.cursor === 'cursor-page-3') {
                return {
                    data: makeProjects(3, 18),
                    nextCursor: null,
                    hasMore: false,
                    total: 21,
                    limit: 9,
                };
            }
            return {
                data: makeProjects(9, 0),
                nextCursor: 'cursor-page-2',
                hasMore: true,
                total: 21,
                limit: 9,
            };
        });

        renderProjectsPage();

        await waitFor(() => {
            expect(screen.getByText('Project 1')).toBeTruthy();
            expect(screen.getByText('Project 9')).toBeTruthy();
            expect(screen.getByLabelText('Page 1 of 3')).toBeTruthy();
        });
        expect(projectsApi.getProjectsPage).toHaveBeenLastCalledWith({
            cursor: null,
            limit: 9,
            search: undefined,
        });
        expect(
            (screen.getByRole('button', { name: 'First page' }) as HTMLButtonElement).disabled,
        ).toBe(true);
        expect(
            (screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled,
        ).toBe(true);

        // Navigate to page 2
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => {
            expect(screen.getByText('Project 10')).toBeTruthy();
            expect(screen.getByLabelText('Page 2 of 3')).toBeTruthy();
        });
        expect(projectsApi.getProjectsPage).toHaveBeenLastCalledWith({
            cursor: 'cursor-page-2',
            limit: 9,
            search: undefined,
        });

        // Navigate to page 3
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => {
            expect(screen.getByText('Project 19')).toBeTruthy();
            expect(screen.getByLabelText('Page 3 of 3')).toBeTruthy();
        });
        expect(projectsApi.getProjectsPage).toHaveBeenLastCalledWith({
            cursor: 'cursor-page-3',
            limit: 9,
            search: undefined,
        });
        expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(
            true,
        );

        // Step back one page with Previous
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        await waitFor(() => {
            expect(screen.getByText('Project 10')).toBeTruthy();
            expect(
                (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled,
            ).toBe(false);
        });

        // Advance back to page 3 then jump straight to First page
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => {
            expect(screen.getByText('Project 19')).toBeTruthy();
            expect(
                (screen.getByRole('button', { name: 'First page' }) as HTMLButtonElement).disabled,
            ).toBe(false);
        });
        fireEvent.click(screen.getByRole('button', { name: 'First page' }));
        await waitFor(() => {
            expect(screen.getByText('Project 1')).toBeTruthy();
        });
        expect(
            (screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled,
        ).toBe(true);
    });

    it('resets cursor pagination back to page 1 when search query changes', async () => {
        vi.mocked(projectsApi.getProjectsPage)
            .mockResolvedValueOnce({
                data: makeProjects(9, 0),
                nextCursor: 'cursor-page-2',
                hasMore: true,
                total: 11,
                limit: 9,
            })
            .mockResolvedValueOnce({
                data: makeProjects(2, 9),
                nextCursor: null,
                hasMore: false,
                total: 11,
                limit: 9,
            })
            .mockResolvedValueOnce({
                data: makeProjects(1, 0),
                nextCursor: null,
                hasMore: false,
                total: 1,
                limit: 9,
            });

        renderProjectsPage();

        await waitFor(() => {
            expect(screen.getByText('Project 1')).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => {
            expect(screen.getByText('Project 10')).toBeTruthy();
        });

        fireEvent.change(screen.getByLabelText('Search projects'), {
            target: { value: 'Project 1' },
        });

        await waitFor(
            () => {
                expect(projectsApi.getProjectsPage).toHaveBeenLastCalledWith({
                    cursor: null,
                    limit: 9,
                    search: 'Project 1',
                });
            },
            { timeout: 1000 },
        );
    });

    it('includes { cursor, limit: 9, search } in useProjectsPage query key', async () => {
        vi.mocked(projectsApi.getProjectsPage).mockResolvedValueOnce({
            data: makeProjects(9, 0),
            nextCursor: null,
            hasMore: false,
            total: 0,
            limit: 9,
        });

        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );

        const { result } = renderHook(() => useProjectsPage({ cursor: null, search: 'core' }), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        const cached = client.getQueryData(
            queryKeys.projectsList({ cursor: null, limit: 9, search: 'core' }),
        );
        expect(cached).toBeTruthy();
        expect(projectsApi.getProjectsPage).toHaveBeenCalledWith({
            cursor: null,
            limit: 9,
            search: 'core',
        });
    });
});
