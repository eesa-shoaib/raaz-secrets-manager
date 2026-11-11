import { profileUpdateInputSchema } from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import {
    removeAvatarController,
    updateProfileController,
    uploadAvatarController,
} from '../controllers/profile.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const profileSchema = z.object({ body: profileUpdateInputSchema });

router.patch(
    '/profile',
    authenticate,
    validate(profileSchema),
    asyncHandler(updateProfileController),
);
router.put('/avatar', authenticate, asyncHandler(uploadAvatarController));
router.delete('/avatar', authenticate, asyncHandler(removeAvatarController));

export const accountRoutes = router;
