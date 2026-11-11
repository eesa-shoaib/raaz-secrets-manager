import { deactivateAccountInputSchema, profileUpdateInputSchema } from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import {
    deactivateAccountController,
    removeAvatarController,
    updateProfileController,
    uploadAvatarController,
} from '../controllers/profile.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { passwordChangeLimiter } from '../middleware/rate-limiters.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const profileSchema = z.object({ body: profileUpdateInputSchema });
const deactivateSchema = z.object({ body: deactivateAccountInputSchema });

router.patch(
    '/profile',
    authenticate,
    validate(profileSchema),
    asyncHandler(updateProfileController),
);
router.put('/avatar', authenticate, asyncHandler(uploadAvatarController));
router.delete('/avatar', authenticate, asyncHandler(removeAvatarController));
router.post(
    '/deactivate',
    authenticate,
    passwordChangeLimiter,
    validate(deactivateSchema),
    asyncHandler(deactivateAccountController),
);

export const accountRoutes = router;
