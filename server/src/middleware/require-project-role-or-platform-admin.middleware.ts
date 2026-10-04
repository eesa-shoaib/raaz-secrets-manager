import type { Request, Response, NextFunction } from 'express';
import { getUserRole } from '../services/membership.service.js';

export function requireProjectRoleOrPlatformAdmin(
  ...allowedRoles: ('projectAdmin' | 'developer' | 'auditor')[]
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user!.isPlatformAdmin) {
      next();
      return;
    }

    const projectId = req.params.projectId;
    const userId = req.user!.id;

    const role = await getUserRole(userId, projectId);
    if (!role) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    if (!allowedRoles.includes(role)) {
      res
        .status(403)
        .json({ error: { code: 'FORBIDDEN', message: 'Insufficient role for this action' } });
      return;
    }

    req.projectRole = role;
    next();
  };
}
