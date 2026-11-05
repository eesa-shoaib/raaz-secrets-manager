import { auditLogQuerySchema } from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import { listProjectAuditEntries } from '../services/audit.service.js';

export async function listProjectAuditController(req: Request, res: Response): Promise<void> {
    res.json(
        await listProjectAuditEntries(req.params.projectId, auditLogQuerySchema.parse(req.query)),
    );
}
