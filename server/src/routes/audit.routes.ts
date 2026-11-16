import { auditLogExportQuerySchema, auditLogQuerySchema } from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import {
    exportProjectAuditController,
    listProjectAuditController,
} from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requireProjectRole } from '../middleware/require-project-role.middleware.js';
import { requireProjectStatus } from '../middleware/require-project-status.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router({ mergeParams: true });
const projectIdParams = z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i) });
const listSchema = z.object({
    params: projectIdParams,
    query: auditLogQuerySchema.strict(),
});
const exportSchema = z.object({
    params: projectIdParams,
    query: auditLogExportQuerySchema,
});
router.get(
    '/',
    authenticate,
    validate(listSchema),
    requireProjectRole('projectAdmin', 'developer', 'auditor'),
    requireProjectStatus,
    asyncHandler(listProjectAuditController),
);
router.get(
    '/export',
    authenticate,
    validate(exportSchema),
    requireProjectRole('projectAdmin', 'auditor'),
    requireProjectStatus,
    asyncHandler(exportProjectAuditController),
);
export const auditRoutes = router;
