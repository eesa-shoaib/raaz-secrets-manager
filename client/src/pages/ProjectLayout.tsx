import React from 'react';
import { useParams, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
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
    <div className="mx-2 space-y-6 sm:mx-4">
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
      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
        <div className="min-w-0 space-y-6">
          <div className="border-b border-base-300">
            <TabNav items={tabItems} />
          </div>
          <Outlet />
        </div>

        <aside
          aria-label="Project information"
          className="min-w-0 self-start rounded-sm border-2 border-solid border-base-300 bg-base-200 p-5 shadow-sm lg:mt-16 lg:p-6"
        >
          <p className="font-ui text-xs font-semibold uppercase tracking-wider text-base-content/60">
            Project
          </p>
          <h1 className="mt-2 break-words font-heading text-xl font-bold text-base-content">
            {project.name}
          </h1>
          <dl className="mt-5 space-y-4 border-t border-base-300 pt-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-base-content/70">Role</dt>
              <dd className="font-semibold text-base-content capitalize">
                {project.role === 'projectAdmin' ? 'Project Admin' : project.role}
              </dd>
            </div>
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
    </div>
  );
}

export default ProjectLayout;
