import { Router } from 'express';
import { z } from 'zod';
import {
    createProjectController,
    getProjectController,
    listProjectsController,
} from '../controllers/project.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requireProjectRole } from '../middleware/require-project-role.middleware.js';
import { requireProjectStatus } from '../middleware/require-project-status.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

router.get('/', authenticate, asyncHandler(listProjectsController));
router.post(
    '/',
    authenticate,
    validate(z.object({ body: z.object({ name: z.string().min(1).max(100) }) })),
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

export const projectRoutes = router;
