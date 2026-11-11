import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectInput } from '@raaz/shared-schemas';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { PaginationControls } from '../components/PaginationControls';
import { ProjectCard } from '../components/ProjectCard';
import { SearchInput } from '../components/SearchInput';
import { useToast } from '../components/Toaster';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useProjectsPage, useCreateProject } from '../hooks/useProjects';
import { isApiError } from '../lib/errorHandling';

export function ProjectsPage() {
    useDocumentTitle('Raaz');
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [cursor, setCursor] = useState<string | null>(null);
    const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setCursor(null);
            setCursorHistory([]);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const { data, isLoading, isFetching, isError, error, refetch } = useProjectsPage({
        cursor,
        limit: 25,
        search: debouncedSearch || undefined,
    });
    const projects = data?.data ?? [];
    const { mutateAsync: createProject, isPending: isCreating } = useCreateProject();
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

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
        setCursorHistory((prev) => [...prev, cursor]);
        setCursor(data.nextCursor);
    };

    const handlePrevious = () => {
        if (cursorHistory.length === 0) return;
        const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
        setCursorHistory((prev) => prev.slice(0, -1));
        setCursor(previousCursor);
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
            navigate(`/projects/${created.id}/secrets`);
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
                description="Manage encrypted secrets and team memberships across environments"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <SearchInput
                            value={searchInput}
                            onChange={setSearchInput}
                            onClear={() => {
                                setDebouncedSearch('');
                                setCursor(null);
                                setCursorHistory([]);
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
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                    <PaginationControls
                        hasPrevious={cursorHistory.length > 0}
                        hasNext={Boolean(data?.hasMore && data?.nextCursor)}
                        onPrevious={handlePrevious}
                        onNext={handleNext}
                        pageNumber={cursorHistory.length + 1}
                        itemCount={projects.length}
                        isFetching={isFetching}
                        noun="projects"
                    />
                </div>
            ) : debouncedSearch ? (
                <EmptyState
                    title="No matching projects"
                    description={`No projects matched "${debouncedSearch}".`}
                    action={
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput('');
                                setDebouncedSearch('');
                                setCursor(null);
                                setCursorHistory([]);
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
                    description={
                        <span>
                            You&apos;re not a member of any projects yet. Create a project, or ask a
                            Project Admin to add you using your email address:{' '}
                            <strong className="text-base-content font-mono font-semibold">
                                {user?.email}
                            </strong>
                            .
                        </span>
                    }
                    action={
                        <button
                            type="button"
                            onClick={handleOpenModal}
                            className="btn btn-primary text-base-300 font-semibold rounded-xl"
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
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100 font-medium"
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
                            className="btn btn-ghost rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="btn btn-primary text-base-300 font-semibold rounded-xl text-sm"
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
