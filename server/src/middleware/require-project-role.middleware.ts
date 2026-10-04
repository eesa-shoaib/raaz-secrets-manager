import type { Request, Response, NextFunction } from 'express';
import { getUserRole } from '../services/membership.service.js';
import { SecretModel } from '../models/Secret.js';
import { writeDeniedAuditEntry } from '../services/audit.service.js';

export function requireProjectRole(...allowedRoles: ('projectAdmin' | 'developer' | 'auditor')[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const projectId = req.params.projectId;
    const userId = req.user!.id;

    const role = await getUserRole(userId, projectId);
    if (!role) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    if (!allowedRoles.includes(role)) {
      const secretId = req.params.secretId;
      if (secretId) {
        const secret = await SecretModel.findOne({ _id: secretId, projectId }, { environment: 1, key: 1 }).lean();
        await writeDeniedAuditEntry({
          userId,
          projectId,
          secretId: secret?._id.toString() ?? secretId,
          secretKey: secret?.key ?? null,
          environment: secret?.environment ?? null,
          action: req.method === 'POST' ? 'create' : req.method === 'PATCH' ? 'edit' : req.method === 'DELETE' ? 'delete' : 'reveal',
        });
      } else {
        await writeDeniedAuditEntry({
          userId,
          projectId,
          action: 'create',
        });
      }

      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role for this action' } });
      return;
    }

    req.projectRole = role;
    next();
  };
}