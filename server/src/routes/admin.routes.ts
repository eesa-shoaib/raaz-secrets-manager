import { updateUserSchema } from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import { listUsersController, updateUserController } from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requirePlatformAdmin } from '../middleware/require-platform-admin.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const pagination = z.object({
    query: z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(20),
        })
        .strict(),
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
export const adminRoutes = router;
