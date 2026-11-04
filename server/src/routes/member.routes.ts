import { Router } from 'express';
import { z } from 'zod';
import {
    addMemberController,
    changeMemberRoleController,
    listMembersController,
    removeMemberController,
} from '../controllers/member.controller.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requireProjectRoleOrPlatformAdmin } from '../middleware/require-project-role-or-platform-admin.middleware.js';
import { requireProjectRole } from '../middleware/require-project-role.middleware.js';
import { requireProjectStatus } from '../middleware/require-project-status.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router({ mergeParams: true });
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const projectParams = z.object({ params: z.object({ projectId: objectId }) });
const memberParams = z.object({ params: z.object({ projectId: objectId, userId: objectId }) });
const role = z.enum(['projectAdmin', 'developer', 'auditor']);

router.get(
    '/',
    authenticate,
    validate(projectParams),
    requireProjectRole('projectAdmin', 'developer', 'auditor'),
    requireProjectStatus,
    asyncHandler(listMembersController),
);
router.post(
    '/',
    authenticate,
    validate(
        projectParams.extend({ body: z.object({ email: z.string().email().toLowerCase(), role }) }),
    ),
    requireProjectRoleOrPlatformAdmin('projectAdmin'),
    requireProjectStatus,
    asyncHandler(addMemberController),
);
router.patch(
    '/:userId',
    authenticate,
    validate(memberParams.extend({ body: z.object({ role }) })),
    requireProjectRoleOrPlatformAdmin('projectAdmin'),
    requireProjectStatus,
    asyncHandler(changeMemberRoleController),
);
router.delete(
    '/:userId',
    authenticate,
    validate(memberParams),
    requireProjectRoleOrPlatformAdmin('projectAdmin'),
    requireProjectStatus,
    asyncHandler(removeMemberController),
);

export const memberRoutes = router;
