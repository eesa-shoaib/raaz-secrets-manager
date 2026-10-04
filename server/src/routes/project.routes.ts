import { Router } from 'express';
import { z } from 'zod';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requireProjectRole } from '../middleware/require-project-role.middleware.js';
import { requireProjectStatus } from '../middleware/require-project-status.middleware.js';
import { ProjectModel } from '../models/Project.js';
import { incrementAdminCount } from '../services/membership.service.js';
import { writeAuditEntry } from '../services/audit.service.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const memberships = await mongoose
    .model('ProjectMembership')
    .find({ userId: new Types.ObjectId(req.user!.id) })
    .lean();
  const projectIds = memberships.map((m) => m.projectId);
  const projects = await ProjectModel.find({ _id: { $in: projectIds } }).lean();
  const projectsWithRole = projects.map((p) => {
    const membership = memberships.find((m) => m.projectId.toString() === p._id.toString());
    return { ...p, role: membership?.role };
  });
  res.json(projectsWithRole);
});

const createProjectSchema = z.object({
  body: z.object({ name: z.string().min(1).max(100) }),
});

router.post('/', authenticate, validate(createProjectSchema), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const project = new ProjectModel({
      name: req.body.name,
      environments: ['development', 'staging', 'production'],
      activeAdminCount: 1,
      status: 'active',
      createdBy: new Types.ObjectId(req.user!.id),
    });
    await project.save({ session });

    await incrementAdminCount(project._id.toString(), session);

    await writeAuditEntry({
      session,
      userId: req.user!.id,
      projectId: project._id.toString(),
      action: 'project_created',
      result: 'allowed',
    });

    await session.commitTransaction();
    res.status(201).json(project);
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
});

router.get(
  '/:projectId',
  authenticate,
  requireProjectRole('projectAdmin', 'developer', 'auditor'),
  requireProjectStatus,
  async (req, res) => {
    const project = await ProjectModel.findById(req.params.projectId).lean();
    if (!project) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }
    res.json({ ...project, role: req.projectRole });
  },
);

export const projectRoutes = router;
