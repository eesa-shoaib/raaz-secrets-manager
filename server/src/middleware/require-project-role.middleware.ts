import type { Request, Response, NextFunction } from 'express';
import { writeDeniedAuditEntry } from '../services/audit.service.js';
import { getUserRole } from '../services/membership.service.js';
import { getSecretAuditMetadata } from '../services/secrets.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export function requireProjectRole(...allowedRoles: ('projectAdmin' | 'developer' | 'auditor')[]) {
    return asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
                const secret = await getSecretAuditMetadata(projectId, secretId);
                await writeDeniedAuditEntry({
                    userId,
                    projectId,
                    secretId: secret?._id.toString() ?? secretId,
                    secretKey: secret?.key ?? null,
                    environment: secret?.environment ?? null,
                    action:
                        req.method === 'POST'
                            ? 'reveal'
                            : req.method === 'PATCH'
                              ? 'edit'
                              : req.method === 'DELETE'
                                ? 'delete'
                                : 'reveal',
                });
            } else if (req.method === 'PATCH') {
                const hasNameOnly =
                    typeof req.body?.name === 'string' && req.body?.description === undefined;
                await writeDeniedAuditEntry({
                    userId,
                    projectId,
                    action: hasNameOnly ? 'project_renamed' : 'project_updated',
                });
            } else if (req.method === 'POST') {
                await writeDeniedAuditEntry({
                    userId,
                    projectId,
                    secretKey: req.body?.key,
                    environment: req.body?.environment,
                    action: 'create',
                });
            }

            res.status(403).json({
                error: { code: 'FORBIDDEN', message: 'Insufficient role for this action' },
            });
            return;
        }

        req.projectRole = role;
        next();
    });
}
