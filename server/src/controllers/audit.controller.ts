import {
    auditLogEntrySchema,
    auditLogQuerySchema,
    createCursorPaginatedResponseSchema,
} from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import {
    listProjectAuditEntries,
    listProjectAuditEntriesCursor,
} from '../services/audit.service.js';

const paginatedAuditSchema = createCursorPaginatedResponseSchema(auditLogEntrySchema);

export async function listProjectAuditController(req: Request, res: Response): Promise<void> {
    const query = auditLogQuerySchema.parse(req.query);
    if (query.cursor !== undefined || query.mode === 'cursor') {
        const result = await listProjectAuditEntriesCursor(req.params.projectId, query);
        res.json(paginatedAuditSchema.parse(result));
        return;
    }
    res.json(await listProjectAuditEntries(req.params.projectId, query));
}
