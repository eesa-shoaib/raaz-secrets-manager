import { useCallback, useMemo } from 'react';
import { useProject } from './useProjects';
import {
  can as canPermission,
  type Action,
  type Environment,
  type Permission,
  type Role,
} from '../lib/permissions';

export function usePermissions(projectId: string | undefined) {
  const { data: project } = useProject(projectId);
  const role: Role = (project?.role as Role) ?? null;

  const can = useCallback(
    (action: Action, environment?: Environment): Permission => {
      return canPermission(role, action, environment);
    },
    [role],
  );

  return useMemo(
    () => ({
      role,
      can,
      isAdmin: role === 'projectAdmin',
      isDeveloper: role === 'developer',
      isAuditor: role === 'auditor',
    }),
    [role, can],
  );
}

export default usePermissions;
