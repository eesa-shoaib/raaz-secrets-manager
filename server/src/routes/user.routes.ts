import { Router } from 'express';
import { z } from 'zod';
import { getUserAvatarController } from '../controllers/profile.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const userIdParamSchema = z.object({
    params: z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) }),
});

router.get(
    '/:userId/avatar',
    authenticate,
    validate(userIdParamSchema),
    asyncHandler(getUserAvatarController),
);

export const userRoutes = router;
