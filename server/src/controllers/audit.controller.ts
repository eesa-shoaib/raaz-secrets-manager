import {
    auditLogEntrySchema,
    auditLogExportQuerySchema,
    auditLogQuerySchema,
    createCursorPaginatedResponseSchema,
} from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import {
    exportProjectAuditEntries,
    listProjectAuditEntries,
    listProjectAuditEntriesCursor,
} from '../services/audit.service.js';
import { formatAuditEntriesAsCsv } from '../utils/csv.js';

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

export async function exportProjectAuditController(req: Request, res: Response): Promise<void> {
    const query = auditLogExportQuerySchema.parse(req.query);
    const entries = await exportProjectAuditEntries(req.params.projectId, {
        action: query.action,
        result: query.result,
        environment: query.environment,
    });

    res.setHeader('Cache-Control', 'no-store');

    if (query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="audit-log-${req.params.projectId}.csv"`,
        );
        res.status(200).send(formatAuditEntriesAsCsv(entries));
        return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-log-${req.params.projectId}.json"`,
    );
    res.status(200).send(
        JSON.stringify(
            {
                projectId: req.params.projectId,
                exportedAt: new Date().toISOString(),
                count: entries.length,
                entries,
            },
            null,
            2,
        ),
    );
}
