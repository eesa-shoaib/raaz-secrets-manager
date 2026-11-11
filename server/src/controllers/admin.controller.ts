import { adminAuditLogQuerySchema, adminUsersQuerySchema } from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import { listUsers, listUsersCursor, updateUser } from '../services/admin.service.js';
import { listPlatformAuditEntriesCursor } from '../services/audit.service.js';

export async function listUsersController(req: Request, res: Response): Promise<void> {
    const query = adminUsersQuerySchema.parse(req.query);
    if (query.mode === 'cursor') {
        res.json(await listUsersCursor(query.cursor, query.limit));
        return;
    }
    res.json(await listUsers(query.page ?? 1, query.limit));
}
export async function updateUserController(req: Request, res: Response): Promise<void> {
    res.json(await updateUser(req.user!.id, req.params.userId, req.body));
}

export async function listAdminAuditController(req: Request, res: Response): Promise<void> {
    const query = adminAuditLogQuerySchema.parse(req.query);
    res.json(await listPlatformAuditEntriesCursor(query));
}
