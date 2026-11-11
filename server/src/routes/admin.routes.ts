import {
    adminAuditLogQuerySchema,
    adminUsersQuerySchema,
    updateUserSchema,
} from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import {
    listAdminAuditController,
    listUsersController,
    updateUserController,
} from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requirePlatformAdmin } from '../middleware/require-platform-admin.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const pagination = z.object({
    query: adminUsersQuerySchema,
});
const auditQuery = z.object({
    query: adminAuditLogQuerySchema,
});
const update = z.object({
    params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) }),
    body: updateUserSchema
        .strict()
        .refine((body) => body.isActive !== undefined || body.isPlatformAdmin !== undefined),
});
router.get(
    '/users',
    authenticate,
    requirePlatformAdmin,
    validate(pagination),
    asyncHandler(listUsersController),
);
router.patch(
    '/users/:userId',
    authenticate,
    requirePlatformAdmin,
    validate(update),
    asyncHandler(updateUserController),
);
router.get(
    '/audit-log',
    authenticate,
    requirePlatformAdmin,
    validate(auditQuery),
    asyncHandler(listAdminAuditController),
);
export const adminRoutes = router;
