import { loginInputSchema, signupInputSchema } from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import {
  currentUserController,
  loginController,
  logoutController,
  signupController,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { authLimiter, signupLimiter } from '../middleware/rate-limiters.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const signupSchema = z.object({ body: signupInputSchema });
const loginSchema = z.object({ body: loginInputSchema });

router.post('/signup', signupLimiter, validate(signupSchema), asyncHandler(signupController));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(loginController));
router.post('/logout', authenticate, logoutController);
router.get('/me', authenticate, currentUserController);

export const authRoutes = router;
