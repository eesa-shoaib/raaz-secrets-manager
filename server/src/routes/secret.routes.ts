import { Router } from 'express';
import { z } from 'zod';
import {
  listSecretsController,
  createSecretController,
  editSecretController,
  deleteSecretController,
  getSecretMetadataController,
  revealSecretController,
} from '../controllers/secrets.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requireProjectRole } from '../middleware/require-project-role.middleware.js';
import { requireProjectStatus } from '../middleware/require-project-status.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { revealLimiter } from '../middleware/rate-limiters.middleware.js';

const router = Router();

const listSchema = z.object({
  params: z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId') }),
});

const createSchema = z.object({
  body: z.object({
    key: z.string().regex(/^[A-Z0-9_]{1,100}$/),
    environment: z.enum(['development', 'staging', 'production']),
    value: z.string(),
    confirm: z.boolean().default(false),
  }),
});

const editSchema = z.object({
  params: z.object({ secretId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId') }),
  body: z.object({
    key: z.string().regex(/^[A-Z0-9_]{1,100}$/).optional(),
    environment: z.enum(['development', 'staging', 'production']).optional(),
    value: z.string(),
  }),
});

const deleteSchema = z.object({
  params: z.object({ secretId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId') }),
});

const metadataSchema = z.object({
  params: z.object({ secretId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId') }),
});

const revealSchema = z.object({
  params: z.object({ secretId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId') }),
});

router.get(
  '/:projectId/secrets',
  authenticate,
  validate(listSchema),
  requireProjectRole('projectAdmin', 'developer', 'auditor'),
  requireProjectStatus,
  asyncHandler(listSecretsController),
);

router.post(
  '/:projectId/secrets',
  authenticate,
  validate(createSchema),
  requireProjectRole('projectAdmin', 'developer'),
  requireProjectStatus,
  asyncHandler(createSecretController),
);

router.patch(
  '/:projectId/secrets/:secretId',
  authenticate,
  validate(editSchema),
  requireProjectRole('projectAdmin', 'developer'),
  requireProjectStatus,
  asyncHandler(editSecretController),
);

router.delete(
  '/:projectId/secrets/:secretId',
  authenticate,
  validate(deleteSchema),
  requireProjectRole('projectAdmin', 'developer'),
  requireProjectStatus,
  asyncHandler(deleteSecretController),
);

router.get(
  '/:projectId/secrets/:secretId/metadata',
  authenticate,
  validate(metadataSchema),
  requireProjectRole('projectAdmin', 'developer', 'auditor'),
  requireProjectStatus,
  asyncHandler(getSecretMetadataController),
);

router.post(
  '/:projectId/secrets/:secretId/reveal',
  authenticate,
  revealLimiter,
  validate(revealSchema),
  requireProjectRole('projectAdmin', 'developer', 'auditor'),
  requireProjectStatus,
  asyncHandler(revealSecretController),
);

export const secretRoutes = router;