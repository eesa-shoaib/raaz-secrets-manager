import {
    changePasswordInputSchema,
    loginInputSchema,
    signupInputSchema,
    oauthStartRequestSchema,
    oauthProviderSchema,
} from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import {
    changePasswordController,
    currentUserController,
    loginController,
    logoutController,
    signupController,
} from '../controllers/auth.controller.js';
import {
    oauthStartController,
    oauthCallbackController,
    oauthProvidersController,
    oauthDeactivateStartController,
} from '../controllers/oauth.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { oauthLimiter } from '../middleware/rate-limiters.middleware.js';
import {
    authLimiter,
    passwordChangeLimiter,
    signupLimiter,
} from '../middleware/rate-limiters.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const signupSchema = z.object({ body: signupInputSchema });
const loginSchema = z.object({ body: loginInputSchema });
const changePasswordSchema = z.object({ body: changePasswordInputSchema });

router.get('/oauth/providers', oauthProvidersController);
router.post(
    '/oauth/:provider/start',
    oauthLimiter,
    validate(oauthStartRequestSchema),
    asyncHandler(oauthStartController),
);
router.post(
    '/oauth/:provider/deactivate/start',
    authenticate,
    passwordChangeLimiter,
    validate(oauthStartRequestSchema),
    asyncHandler(oauthDeactivateStartController),
);
router.get(
    '/oauth/:provider/callback',
    oauthLimiter,
    validate(z.object({ params: z.object({ provider: oauthProviderSchema }) })),
    asyncHandler(oauthCallbackController),
);

router.post('/signup', signupLimiter, validate(signupSchema), asyncHandler(signupController));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(loginController));
router.post('/logout', authenticate, logoutController);
router.post(
    '/change-password',
    authenticate,
    passwordChangeLimiter,
    validate(changePasswordSchema),
    asyncHandler(changePasswordController),
);
router.get('/me', authenticate, currentUserController);

export const authRoutes = router;
