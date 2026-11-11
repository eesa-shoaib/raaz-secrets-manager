import { zodResolver } from '@hookform/resolvers/zod';
import { updateProjectSchema, type UpdateProjectInput } from '@raaz/shared-schemas';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { FormField } from '../components/FormField';
import { ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { Modal } from '../components/Modal';
import { TabNav } from '../components/TabNav';
import { useToast } from '../components/Toaster';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePermissions } from '../hooks/usePermissions';
import { useProject, useUpdateProject } from '../hooks/useProjects';
import { isApiError } from '../lib/errorHandling';
import { StatusPage } from './StatusPage';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export function ProjectLayout() {
    const { projectId } = useParams<{ projectId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { toast } = useToast();

    const validProjectId = projectId && OBJECT_ID_REGEX.test(projectId) ? projectId : undefined;
    const { data: project, isLoading, isError, error, refetch } = useProject(validProjectId);
    const { can } = usePermissions(validProjectId);
    const updateProjectMutation = useUpdateProject(validProjectId || '');

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<UpdateProjectInput>({
        resolver: zodResolver(updateProjectSchema),
        defaultValues: {
            name: project?.name ?? '',
            description: project?.description ?? '',
        },
    });

    useDocumentTitle(
        !validProjectId || isError
            ? 'Raaz'
            : project
              ? project.name
              : isLoading
                ? undefined
                : 'Raaz',
    );

    // Validate ObjectId format
    if (!projectId || !OBJECT_ID_REGEX.test(projectId)) {
        return <StatusPage variant="not-found" />;
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton shape="header" />
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            </div>
        );
    }

    if (isError) {
        if (isApiError(error) && error.status === 404) {
            return <StatusPage variant="not-found" />;
        }
        return (
            <ErrorState
                message={isApiError(error) ? error.message : 'Failed to load project details'}
                onRetry={() => refetch()}
            />
        );
    }

    if (!project) {
        return <StatusPage variant="not-found" />;
    }

    // Redirect /projects/:projectId -> /projects/:projectId/secrets
    if (
        location.pathname === `/projects/${projectId}` ||
        location.pathname === `/projects/${projectId}/`
    ) {
        return <Navigate to={`/projects/${projectId}/secrets`} replace />;
    }

    const tabItems = [
        {
            to: `/projects/${projectId}/secrets`,
            label: 'Secrets',
        },
        {
            to: `/projects/${projectId}/members`,
            label: 'Members',
        },
        {
            to: `/projects/${projectId}/audit-log`,
            label: 'Audit Log',
        },
    ];

    const canEditProject = can('project.edit') === 'enabled';

    const handleOpenEdit = () => {
        reset({
            name: project.name,
            description: project.description ?? '',
        });
        setEditError(null);
        setIsEditOpen(true);
    };

    const onEditSubmit = async (data: UpdateProjectInput) => {
        setEditError(null);
        try {
            await updateProjectMutation.mutateAsync(data);
            toast.success('Project details updated');
            setIsEditOpen(false);
        } catch (err: unknown) {
            if (isApiError(err)) {
                setEditError(err.message || 'Failed to update project details');
            } else {
                setEditError('Something went wrong — the action was not applied');
            }
        }
    };

    return (
        <div className="space-y-6">
            <button
                type="button"
                className="btn btn-ghost btn-sm h-9 gap-2 px-2 text-base-content/70 hover:text-base-content"
                onClick={() => {
                    if (
                        typeof window.history.state?.idx === 'number' &&
                        window.history.state.idx > 0
                    )
                        navigate(-1);
                    else navigate('/projects', { replace: true });
                }}
                aria-label="Go back"
            >
                <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 12H5m0 0 6-6m-6 6 6 6"
                    />
                </svg>
                Back
            </button>

            <div className="border-b border-base-300">
                <TabNav items={tabItems} />
            </div>

            <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
                <div className="min-w-0">
                    <Outlet />
                </div>

                <aside
                    aria-label="Project information"
                    className="min-w-0 w-full self-start rounded-3xl border border-base-300 bg-base-200 p-6 shadow-sm lg:mt-[3.75rem]"
                >
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-ui text-xs font-semibold uppercase tracking-wider text-base-content/60">
                            Project
                        </p>
                        {canEditProject && (
                            <button
                                type="button"
                                onClick={handleOpenEdit}
                                aria-label="Edit project details"
                                title="Edit project details"
                                className="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/70 hover:text-primary"
                            >
                                <svg
                                    aria-hidden="true"
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <h1 className="mt-2 break-words font-heading text-xl font-bold text-base-content">
                        {project.name}
                    </h1>
                    {project.description ? (
                        <p className="mt-2 break-words whitespace-pre-wrap font-ui text-sm text-base-content/75">
                            {project.description}
                        </p>
                    ) : (
                        <p className="mt-2 font-ui text-sm italic text-base-content/45">
                            No description provided.
                        </p>
                    )}
                    <dl className="mt-5 space-y-3 border-t border-base-300 pt-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <dt className="text-base-content/70">Role</dt>
                            <dd className="font-semibold text-base-content capitalize">
                                {project.role === 'projectAdmin' ? 'Project Admin' : project.role}
                            </dd>
                        </div>
                        {project.memberCount !== undefined && (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <dt className="text-base-content/70">Members</dt>
                                <dd className="font-semibold text-base-content">
                                    {project.memberCount}
                                </dd>
                            </div>
                        )}
                        {project.status === 'archived' && (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <dt className="text-base-content/70">Status</dt>
                                <dd>
                                    <Badge variant="projectStatus" value={project.status} />
                                </dd>
                            </div>
                        )}
                    </dl>
                </aside>
            </div>

            {canEditProject && (
                <Modal
                    isOpen={isEditOpen}
                    onClose={() => {
                        if (!updateProjectMutation.isPending) setIsEditOpen(false);
                    }}
                    title="Edit Project Details"
                >
                    <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4" noValidate>
                        {editError && (
                            <div
                                role="alert"
                                className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100 font-medium"
                            >
                                <span>{editError}</span>
                            </div>
                        )}

                        <FormField label="Project Name" error={errors.name?.message} required>
                            {({ id, ...props }) => (
                                <input
                                    id={id}
                                    type="text"
                                    className={`input input-bordered w-full bg-base-300 rounded-xl text-sm font-ui ${
                                        errors.name ? 'input-error' : ''
                                    }`}
                                    {...register('name')}
                                    {...props}
                                />
                            )}
                        </FormField>

                        <FormField
                            label="Description"
                            hint="Up to 500 characters"
                            error={errors.description?.message}
                        >
                            {({ id, ...props }) => (
                                <textarea
                                    id={id}
                                    rows={3}
                                    className={`textarea textarea-bordered w-full bg-base-300 rounded-xl text-sm font-ui ${
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
                                onClick={() => setIsEditOpen(false)}
                                disabled={updateProjectMutation.isPending}
                                className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={updateProjectMutation.isPending}
                                className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl text-sm"
                            >
                                {updateProjectMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

export default ProjectLayout;
