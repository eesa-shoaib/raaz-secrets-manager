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
import { createSecretSchema, editSecretSchema, revealSecretSchema, projectEnvironmentEnum } from '@raaz/shared-schemas';

const router = Router();

const listSchema = z.object({
  params: z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId') }),
  query: z.object({ environment: projectEnvironmentEnum }),
});

const createSchema = z.object({
  params: listSchema.shape.params,
  body: createSecretSchema,
});

const editSchema = z.object({
  params: listSchema.shape.params.extend({ secretId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId') }),
  body: editSecretSchema.strict(),
});

const deleteSchema = z.object({
  params: editSchema.shape.params,
});

const metadataSchema = z.object({
  params: editSchema.shape.params,
});

const revealSchema = z.object({
  params: editSchema.shape.params,
  body: revealSecretSchema,
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
  requireProjectRole('projectAdmin'),
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
  requireProjectRole('projectAdmin', 'developer'),
  requireProjectStatus,
  asyncHandler(revealSecretController),
);

export const secretRoutes = router;
