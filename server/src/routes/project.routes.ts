import {
    createProjectSchema,
    projectsListQuerySchema,
    updateProjectSchema,
} from '@raaz/shared-schemas';
import { Router } from 'express';
import { z } from 'zod';
import {
    createProjectController,
    getProjectController,
    listProjectsController,
    updateProjectController,
} from '../controllers/project.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requireProjectRole } from '../middleware/require-project-role.middleware.js';
import { requireProjectStatus } from '../middleware/require-project-status.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

router.get(
    '/',
    authenticate,
    validate(z.object({ query: projectsListQuerySchema })),
    asyncHandler(listProjectsController),
);
router.post(
    '/',
    authenticate,
    validate(z.object({ body: createProjectSchema })),
    asyncHandler(createProjectController),
);
router.get(
    '/:projectId',
    authenticate,
    validate(z.object({ params: z.object({ projectId: objectId }) })),
    requireProjectRole('projectAdmin', 'developer', 'auditor'),
    requireProjectStatus,
    asyncHandler(getProjectController),
);
router.patch(
    '/:projectId',
    authenticate,
    validate(z.object({ params: z.object({ projectId: objectId }), body: updateProjectSchema })),
    requireProjectRole('projectAdmin'),
    requireProjectStatus,
    asyncHandler(updateProjectController),
);

export const projectRoutes = router;
