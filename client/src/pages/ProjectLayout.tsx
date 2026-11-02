import React from 'react';
import { useParams, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useProject } from '../hooks/useProjects';
import { PageHeader } from '../components/PageHeader';
import { TabNav } from '../components/TabNav';
import { Badge } from '../components/Badge';
import { StatusPage } from './StatusPage';
import { ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { isApiError } from '../lib/errorHandling';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();

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
        message={
          isApiError(error)
            ? error.message
            : 'Failed to load project details'
        }
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
      <PageHeader
        title={project.name}
        description={
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="font-mono text-xs text-base-content/60">
              ID: {project.id}
            </span>
            <span className="text-base-content/30">•</span>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-base-content/70">Your role:</span>
              <Badge variant="role" value={project.role} />
            </div>
            <span className="text-base-content/30">•</span>
            <Badge variant="projectStatus" value={project.status} />
          </div>
        }
      />

      <div className="border-b border-base-300 pb-4">
        <TabNav items={tabItems} />
      </div>

      <Outlet />
    </div>
  );
}

export default ProjectLayout;
