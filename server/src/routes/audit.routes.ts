import { auditLogQuerySchema } from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import { listProjectAuditController } from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requireProjectRole } from '../middleware/require-project-role.middleware.js';
import { requireProjectStatus } from '../middleware/require-project-status.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router({ mergeParams: true });
const schema = z.object({
    params: z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i) }),
    query: auditLogQuerySchema.strict(),
});
router.get(
    '/',
    authenticate,
    validate(schema),
    requireProjectRole('projectAdmin', 'developer', 'auditor'),
    requireProjectStatus,
    asyncHandler(listProjectAuditController),
);
export const auditRoutes = router;
