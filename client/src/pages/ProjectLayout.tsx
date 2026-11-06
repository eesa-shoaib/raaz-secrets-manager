import React from 'react';
import { useParams, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { PageHeader } from '../components/PageHeader';
import { TabNav } from '../components/TabNav';
import { useProject } from '../hooks/useProjects';
import { isApiError } from '../lib/errorHandling';
import { StatusPage } from './StatusPage';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export function ProjectLayout() {
    const { projectId } = useParams<{ projectId: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    // Validate ObjectId format
    if (!projectId || !OBJECT_ID_REGEX.test(projectId)) {
        return <StatusPage variant="not-found" />;
    }

    const { data: project, isLoading, isError, error, refetch } = useProject(projectId);

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

    return (
        <div className="space-y-6">
            <button
                type="button"
                className="btn btn-ghost btn-sm gap-2 px-2 text-base-content/70 hover:text-base-content"
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
            <PageHeader
                title={project.name}
                description={
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-base-content/70">Your role:</span>
                            <Badge variant="role" value={project.role} />
                        </div>
                        <span className="text-base-content/30">•</span>
                        <Badge variant="projectStatus" value={project.status} />
                    </div>
                }
            />

            <div className="border-b border-base-300">
                <TabNav items={tabItems} />
            </div>

            <Outlet />
        </div>
    );
}

export default ProjectLayout;
