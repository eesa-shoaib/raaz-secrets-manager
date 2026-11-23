import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectInput } from '@raaz/shared-schemas';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { PROJECTS_PAGE_SIZE } from '../api/projects';
import { FormField } from '../components/FormField';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { PaginationControls } from '../components/PaginationControls';
import { ProjectCard } from '../components/ProjectCard';
import { SearchInput } from '../components/SearchInput';
import { useToast } from '../components/Toaster';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useProjectsPage, useCreateProject } from '../hooks/useProjects';
import { isApiError } from '../lib/errorHandling';
import {
    initialProjectsListState,
    readProjectsListState,
    type ProjectsListState,
} from '../lib/projectsNavigation';

export function ProjectsPage() {
    useDocumentTitle('Raaz');
    const location = useLocation();
    const navigate = useNavigate();
    const listState = readProjectsListState(location.state) ?? initialProjectsListState;
    const { search: debouncedSearch, cursor, cursorHistory } = listState;
    const [searchInput, setSearchInput] = useState(listState.search);
    const updateListState = useCallback(
        (next: ProjectsListState) => {
            navigate('/projects', { replace: true, state: { projectsList: next } });
        },
        [navigate],
    );

    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed === debouncedSearch) return;
        const timer = setTimeout(() => {
            updateListState({ search: trimmed, cursor: null, cursorHistory: [] });
        }, 250);
        return () => clearTimeout(timer);
    }, [searchInput, debouncedSearch, updateListState]);

    const { data, isLoading, isFetching, isError, error, refetch } = useProjectsPage({
        cursor,
        limit: PROJECTS_PAGE_SIZE,
        search: debouncedSearch || undefined,
    });
    const projects = data?.data ?? [];
    const { mutateAsync: createProject, isPending: isCreating } = useCreateProject();
    const { toast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CreateProjectInput>({
        resolver: zodResolver(createProjectSchema),
        defaultValues: {
            name: '',
            description: '',
        },
    });

    const handleNext = () => {
        if (!data?.nextCursor) return;
        updateListState({
            ...listState,
            cursor: data.nextCursor,
            cursorHistory: [...cursorHistory, cursor],
        });
    };

    const handlePrevious = () => {
        if (cursorHistory.length === 0) return;
        const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
        updateListState({
            ...listState,
            cursor: previousCursor,
            cursorHistory: cursorHistory.slice(0, -1),
        });
    };

    const handleFirstPage = () => {
        if (cursorHistory.length === 0 && cursor === null) return;
        updateListState({ ...listState, cursor: null, cursorHistory: [] });
    };

    const handleOpenModal = () => {
        reset();
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        reset();
        setModalError(null);
    };

    const onSubmit = async (data: CreateProjectInput) => {
        setModalError(null);
        try {
            const created = await createProject(data);
            toast.success(`Project "${created.name}" created successfully`);
            handleCloseModal();
            navigate(`/projects/${created.id}/secrets`, { state: { projectsList: listState } });
        } catch (err: unknown) {
            if (isApiError(err)) {
                setModalError(err.message || 'Failed to create project');
            } else {
                setModalError('Something went wrong — the action was not applied');
            }
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Projects"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <SearchInput
                            value={searchInput}
                            onChange={setSearchInput}
                            onClear={() => {
                                updateListState(initialProjectsListState);
                            }}
                            placeholder="Search projects..."
                            ariaLabel="Search projects"
                            className="w-full sm:w-64"
                        />
                        <button
                            type="button"
                            onClick={handleOpenModal}
                            className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl flex items-center gap-2 hover:opacity-90"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                            New Project
                        </button>
                    </div>
                }
            />

            {isLoading ? (
                <Skeleton shape="card" count={3} />
            ) : isError ? (
                <ErrorState
                    message={
                        isApiError(error)
                            ? error.message
                            : 'Failed to load projects. Please try again.'
                    }
                    onRetry={() => refetch()}
                />
            ) : projects.length > 0 ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <ProjectCard key={project.id} project={project} listState={listState} />
                        ))}
                    </div>
                    <PaginationControls
                        hasPrevious={cursorHistory.length > 0}
                        hasNext={Boolean(data?.hasMore && data?.nextCursor)}
                        onFirstPage={handleFirstPage}
                        onPrevious={handlePrevious}
                        onNext={handleNext}
                        pageNumber={cursorHistory.length + 1}
                        totalPages={
                            data ? Math.max(1, Math.ceil(data.total / data.limit)) : undefined
                        }
                        itemCount={projects.length}
                        isFetching={isFetching}
                        noun="projects"
                    />
                </div>
            ) : debouncedSearch ? (
                <EmptyState
                    title="No matching projects"
                    action={
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput('');
                                updateListState(initialProjectsListState);
                            }}
                            className="btn btn-outline btn-sm rounded-xl"
                        >
                            Clear Search
                        </button>
                    }
                />
            ) : (
                <EmptyState
                    title="No projects yet"
                    action={
                        <button
                            type="button"
                            onClick={handleOpenModal}
                            className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl"
                        >
                            New Project
                        </button>
                    }
                />
            )}

            {/* Create Project Modal */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Create New Project">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    {modalError && (
                        <div
                            role="alert"
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-error-content font-medium"
                        >
                            <span>{modalError}</span>
                        </div>
                    )}

                    <FormField
                        label="Project Name"
                        hint="A clear, human-readable name for your project"
                        error={errors.name?.message}
                        required
                    >
                        {({ id, ...props }) => (
                            <input
                                id={id}
                                type="text"
                                placeholder="e.g. Payment Gateway"
                                autoFocus
                                className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-ui ${
                                    errors.name ? 'input-error' : ''
                                }`}
                                {...register('name')}
                                {...props}
                            />
                        )}
                    </FormField>

                    <FormField
                        label="Description"
                        hint="Optional summary shown in the project overview (up to 500 characters)"
                        error={errors.description?.message}
                    >
                        {({ id, ...props }) => (
                            <textarea
                                id={id}
                                rows={3}
                                placeholder="What does this project manage?"
                                className={`textarea textarea-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-ui ${
                                    errors.description ? 'textarea-error' : ''
                                }`}
                                {...register('description')}
                                {...props}
                            />
                        )}
                    </FormField>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            disabled={isCreating}
                            className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl text-sm"
                        >
                            {isCreating ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                'Create Project'
                            )}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

export default ProjectsPage;
