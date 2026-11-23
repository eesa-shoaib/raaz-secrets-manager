import { zodResolver } from '@hookform/resolvers/zod';
import {
    createProjectSchema,
    type CreateProjectInput,
    type GitHubRepository,
} from '@raaz/shared-schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import * as githubApi from '../api/github';
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
import { useGitHubConnection } from '../hooks/useGitHub';
import { useProjectsPage, useCreateProject } from '../hooks/useProjects';
import { isApiError } from '../lib/errorHandling';
import {
    initialProjectsListState,
    readProjectsListState,
    type ProjectsListState,
} from '../lib/projectsNavigation';
import { queryKeys } from '../lib/queryClient';

export function ProjectsPage() {
    useDocumentTitle('Raaz');
    const location = useLocation();
    const navigate = useNavigate();
    const listState = readProjectsListState(location.state) ?? initialProjectsListState;
    const { search: debouncedSearch, cursor, cursorHistory } = listState;
    const [searchInput, setSearchInput] = useState(listState.search);
    const github = useGitHubConnection('projects');
    const client = useQueryClient();
    const [isImportOpen, setIsImportOpen] = useState(
        () => new URLSearchParams(location.search).get('github') === 'connected',
    );
    const [accountPage, setAccountPage] = useState(1);
    const [installationId, setInstallationId] = useState<number | null>(null);
    const [repositoryPage, setRepositoryPage] = useState(1);
    const [repositorySearch, setRepositorySearch] = useState('');
    const [repositoryFilter, setRepositoryFilter] = useState('');
    const [selectedRepository, setSelectedRepository] = useState<GitHubRepository | null>(null);
    const [importName, setImportName] = useState('');
    const [seedExampleSecrets, setSeedExampleSecrets] = useState(true);
    const [importError, setImportError] = useState<string | null>(null);
    const installations = useQuery({
        queryKey: ['github', 'installations', accountPage],
        queryFn: () => githubApi.getGitHubInstallations(accountPage),
        staleTime: 0,
        enabled: isImportOpen && github.status.data?.connected === true,
    });
    useEffect(() => {
        if (
            installations.data?.data.length &&
            !installations.data.data.some((item) => item.id === installationId)
        )
            setInstallationId(installations.data.data[0].id);
    }, [installations.data, installationId]);
    useEffect(() => {
        const timer = setTimeout(() => {
            setRepositoryFilter(repositorySearch.trim());
            setRepositoryPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [repositorySearch]);
    const repositories = useQuery({
        staleTime: 0,
        queryKey: ['github', 'repositories', installationId, repositoryPage, repositoryFilter],
        queryFn: () =>
            githubApi.getGitHubRepositories(installationId!, repositoryPage, repositoryFilter),
        enabled: isImportOpen && github.status.data?.connected === true && installationId !== null,
    });
    const importMutation = useMutation({
        mutationFn: githubApi.importGitHubRepository,
        retry: 0,
        onSuccess: (result) => {
            client.invalidateQueries({ queryKey: queryKeys.projects });
            setIsImportOpen(false);
            toast.success(
                result.created
                    ? result.mockSecretsCreated
                        ? `Project imported with ${result.mockSecretsCreated} mock development secrets`
                        : 'Project imported'
                    : 'Opened existing imported project',
            );
            navigate(`/projects/${result.project.id}/secrets`, {
                state: { projectsList: listState },
            });
        },
        onError: (error) =>
            setImportError(isApiError(error) ? error.message : 'Unable to import repository'),
    });
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
                        {github.status.data?.enabled && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedRepository(null);
                                    setImportError(null);
                                    setSeedExampleSecrets(true);
                                    setIsImportOpen(true);
                                }}
                                className="btn btn-primary btn-sm h-9 rounded-xl text-primary-content"
                            >
                                Import from GitHub
                            </button>
                        )}
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
                            className="btn btn-neutral btn-sm rounded-xl"
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

            {isImportOpen && (
                <Modal
                    isOpen
                    title="Import from GitHub"
                    maxWidth="xl"
                    onClose={() => {
                        if (!importMutation.isPending) setIsImportOpen(false);
                    }}
                >
                    <div className="space-y-4">
                        {importError && (
                            <p role="alert" className="text-sm text-error">
                                {importError}
                            </p>
                        )}
                        {!github.status.data?.connected ? (
                            <div className="space-y-3">
                                <p className="text-sm text-base-content/75">
                                    Connect a GitHub account and grant access to the repositories
                                    you want to import.
                                </p>
                                <button
                                    type="button"
                                    disabled={
                                        github.connect.isPending || !github.status.data?.enabled
                                    }
                                    onClick={() => github.connect.mutate()}
                                    className="btn btn-primary btn-sm rounded-lg"
                                >
                                    {github.connect.isPending ? 'Connecting…' : 'Connect GitHub'}
                                </button>
                            </div>
                        ) : selectedRepository ? (
                            <form
                                className="space-y-4"
                                noValidate
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    const parsed = createProjectSchema.safeParse({
                                        name: importName,
                                        description: selectedRepository.description.slice(0, 500),
                                    });
                                    if (!parsed.success) {
                                        setImportError(
                                            'Enter a project name (1–100 characters) and a description of at most 500 characters.',
                                        );
                                        return;
                                    }
                                    if (installationId)
                                        importMutation.mutate({
                                            ...parsed.data,
                                            installationId,
                                            repositoryId: selectedRepository.id,
                                            seedExampleSecrets,
                                        });
                                }}
                            >
                                <a
                                    href={selectedRepository.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="link link-primary break-all text-sm"
                                >
                                    {selectedRepository.owner}/{selectedRepository.name}
                                </a>
                                <FormField label="Project name" required>
                                    {({ id, ...props }) => (
                                        <input
                                            id={id}
                                            {...props}
                                            value={importName}
                                            onChange={(event) => setImportName(event.target.value)}
                                            maxLength={100}
                                            disabled={importMutation.isPending}
                                            className="input input-bordered h-10 w-full bg-base-300 rounded-lg"
                                        />
                                    )}
                                </FormField>
                                <label className="flex items-start gap-3 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary checkbox-sm"
                                        checked={seedExampleSecrets}
                                        disabled={importMutation.isPending}
                                        onChange={(event) =>
                                            setSeedExampleSecrets(event.target.checked)
                                        }
                                    />
                                    <span>Add mock development secrets from .env.example</span>
                                </label>
                                <p className="text-xs text-base-content/65">
                                    Example values are ignored. Mock values must be replaced before
                                    use. Requires GitHub Contents read-only access.
                                </p>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                        type="button"
                                        disabled={importMutation.isPending}
                                        onClick={() => {
                                            setSelectedRepository(null);
                                            setImportError(null);
                                        }}
                                        className="btn btn-sm btn-ghost"
                                    >
                                        Back to repositories
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={importMutation.isPending}
                                        className="btn btn-primary btn-sm rounded-lg"
                                    >
                                        {importMutation.isPending ? 'Importing…' : 'Import project'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <label
                                            htmlFor="github-installation"
                                            className="mb-1 block text-sm font-medium"
                                        >
                                            GitHub account
                                        </label>
                                        <select
                                            id="github-installation"
                                            value={installationId ?? ''}
                                            disabled={installations.isFetching}
                                            onChange={(event) => {
                                                setInstallationId(Number(event.target.value));
                                                setRepositoryPage(1);
                                            }}
                                            className="select select-bordered select-sm w-full rounded-lg bg-base-300"
                                        >
                                            {!installationId && (
                                                <option value="">Choose an account</option>
                                            )}
                                            {installations.data?.data.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.account}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Refresh repositories"
                                        title="Refresh repositories"
                                        className="btn btn-primary btn-sm btn-square rounded-lg"
                                        disabled={
                                            installations.isFetching || repositories.isFetching
                                        }
                                        onClick={() => {
                                            void client.invalidateQueries({
                                                queryKey: ['github', 'installations'],
                                            });
                                            void client.invalidateQueries({
                                                queryKey: ['github', 'repositories'],
                                            });
                                        }}
                                    >
                                        <svg
                                            aria-hidden="true"
                                            className={`h-4 w-4 ${installations.isFetching || repositories.isFetching ? 'animate-spin' : ''}`}
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M20 7v5h-5" />
                                            <path d="M4 17v-5h5" />
                                            <path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 17.9 17" />
                                        </svg>
                                    </button>
                                    {github.status.data.manageUrl && (
                                        <a
                                            href={github.status.data.manageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="link link-primary text-sm"
                                        >
                                            Manage GitHub access
                                        </a>
                                    )}
                                </div>
                                {installations.data && installations.data.total > 25 && (
                                    <PaginationControls
                                        pageNumber={accountPage}
                                        totalPages={Math.ceil(installations.data.total / 25)}
                                        itemCount={installations.data.data.length}
                                        hasPrevious={accountPage > 1}
                                        hasNext={accountPage * 25 < installations.data.total}
                                        isFetching={installations.isFetching}
                                        onPrevious={() => {
                                            setAccountPage(accountPage - 1);
                                            setInstallationId(null);
                                        }}
                                        onNext={() => {
                                            setAccountPage(accountPage + 1);
                                            setInstallationId(null);
                                        }}
                                    />
                                )}
                                <p className="text-xs text-base-content/65">
                                    {installations.data?.data.find(
                                        (item) => item.id === installationId,
                                    )?.selection === 'all'
                                        ? 'New repositories are included automatically. Refresh to see them.'
                                        : 'For selected-repository access, grant new repositories in Manage GitHub access, then refresh.'}
                                </p>
                                <SearchInput
                                    value={repositorySearch}
                                    onChange={setRepositorySearch}
                                    placeholder="Search repositories…"
                                    ariaLabel="Search GitHub repositories"
                                    className="w-full"
                                />
                                {installations.isError || repositories.isError ? (
                                    <div className="space-y-2">
                                        <p role="alert" className="text-sm text-error">
                                            {isApiError(installations.error ?? repositories.error)
                                                ? (installations.error ?? repositories.error)
                                                      ?.message
                                                : 'Unable to load GitHub repositories'}
                                        </p>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-neutral"
                                            disabled={github.connect.isPending}
                                            onClick={() => github.connect.mutate()}
                                        >
                                            Reconnect GitHub
                                        </button>
                                    </div>
                                ) : installations.isPending || repositories.isFetching ? (
                                    <p role="status" className="text-sm text-base-content/65">
                                        Loading repositories…
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {repositories.data?.data.map((repo) => (
                                            <button
                                                key={repo.id}
                                                type="button"
                                                aria-label={`Select ${repo.owner}/${repo.name}`}
                                                className="block w-full rounded-xl border border-base-content/20 bg-base-300 p-3 text-left text-base-content shadow-sm hover:border-primary/60 hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                                                onClick={() => {
                                                    setSelectedRepository(repo);
                                                    setImportName(repo.name.slice(0, 100));
                                                    setImportError(null);
                                                }}
                                            >
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="break-all text-sm font-semibold">
                                                        {repo.owner}/{repo.name}
                                                    </span>
                                                    <span className="text-xs text-base-content/60">
                                                        {repo.private ? 'Private' : 'Public'}
                                                    </span>
                                                </span>
                                            </button>
                                        ))}
                                        {!repositories.data?.data.length && (
                                            <p className="p-4 text-sm text-base-content/65">
                                                No repositories available
                                            </p>
                                        )}
                                    </div>
                                )}
                                {repositories.data && (
                                    <PaginationControls
                                        pageNumber={repositoryPage}
                                        totalPages={Math.max(
                                            1,
                                            Math.ceil(repositories.data.total / 10),
                                        )}
                                        itemCount={repositories.data.data.length}
                                        hasPrevious={repositoryPage > 1}
                                        hasNext={repositoryPage * 10 < repositories.data.total}
                                        isFetching={repositories.isFetching}
                                        onPrevious={() => setRepositoryPage(repositoryPage - 1)}
                                        onNext={() => setRepositoryPage(repositoryPage + 1)}
                                    />
                                )}
                            </>
                        )}
                        <div className="flex justify-end border-t border-base-300 pt-3">
                            <button
                                type="button"
                                disabled={importMutation.isPending}
                                className="btn btn-sm btn-ghost"
                                onClick={() => setIsImportOpen(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
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
