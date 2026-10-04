import { Router } from 'express';
import { z } from 'zod';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate } from '../middleware/authenticate.middleware.js';
import { requireProjectRoleOrPlatformAdmin } from '../middleware/require-project-role-or-platform-admin.middleware.js';
import { requireProjectStatus } from '../middleware/require-project-status.middleware.js';
import { findMembership, createMembership, updateMembershipRole, deleteMembership } from '../services/membership.service.js';
import { writeAuditEntry, writeDeniedAuditEntry } from '../services/audit.service.js';
import { UserModel } from '../models/User.js';
import { ProjectModel } from '../models/Project.js';

const router = Router({ mergeParams: true });

router.get('/', authenticate, requireProjectRoleOrPlatformAdmin('projectAdmin', 'developer', 'auditor'), requireProjectStatus, async (req, res) => {
  const memberships = await mongoose.model('ProjectMembership').find({ projectId: new Types.ObjectId(req.params.projectId) }).lean();
  const userIds = memberships.map((m) => m.userId);
  const users = await UserModel.find({ _id: { $in: userIds } }).select('email').lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u.email]));
  const members = memberships.map((m) => ({
    userId: m.userId.toString(),
    email: userMap.get(m.userId.toString()) ?? 'unknown',
    role: m.role,
    createdAt: m.createdAt,
  }));
  res.json(members);
});

const addMemberSchema = z.object({
  body: z.object({
    email: z.string().email().toLowerCase(),
    role: z.enum(['projectAdmin', 'developer', 'auditor']),
  }),
});

router.post('/', authenticate, requireProjectRoleOrPlatformAdmin('projectAdmin'), requireProjectStatus, validate(addMemberSchema), async (req, res) => {
  const user = await UserModel.findOne({ email: req.body.email }).lean();
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No account with that email' } });
    return;
  }

  const existing = await findMembership(user._id.toString(), req.params.projectId);
  if (existing) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Already a member' } });
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await createMembership(user._id.toString(), req.params.projectId, req.body.role, session);

    await writeAuditEntry({
      session,
      userId: req.user!.id,
      projectId: req.params.projectId,
      targetUserId: user._id.toString(),
      newRole: req.body.role,
      action: 'member_added',
      result: 'allowed',
    });

    await session.commitTransaction();
    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
});

const updateSchema = z.object({
  body: z.object({ role: z.enum(['projectAdmin', 'developer', 'auditor']) }),
  params: z.object({ userId: z.string() }),
});

router.patch('/:userId', authenticate, requireProjectRoleOrPlatformAdmin('projectAdmin'), requireProjectStatus, validate(updateSchema), async (req, res) => {
  const membership = await findMembership(req.params.userId, req.params.projectId);
  if (!membership) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Member not found' } });
    return;
  }

  if (membership.role === 'projectAdmin' && req.body.role !== 'projectAdmin') {
    const adminCount = await ProjectModel.findById(req.params.projectId).select('activeAdminCount').lean();
    if (adminCount?.activeAdminCount === 1) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Cannot remove the last project admin' } });
      return;
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await updateMembershipRole(req.params.userId, req.params.projectId, req.body.role, session);

    await writeAuditEntry({
      session,
      userId: req.user!.id,
      projectId: req.params.projectId,
      targetUserId: req.params.userId,
      previousRole: membership.role,
      newRole: req.body.role,
      action: 'member_role_changed',
      result: 'allowed',
    });

    await session.commitTransaction();
    res.json({ message: 'Member role updated' });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
});

router.delete('/:userId', authenticate, requireProjectRoleOrPlatformAdmin('projectAdmin'), requireProjectStatus, async (req, res) => {
  const membership = await findMembership(req.params.userId, req.params.projectId);
  if (!membership) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Member not found' } });
    return;
  }

  if (membership.role === 'projectAdmin') {
    const adminCount = await ProjectModel.findById(req.params.projectId).select('activeAdminCount').lean();
    if (adminCount?.activeAdminCount === 1) {
      await writeDeniedAuditEntry({
        userId: req.user!.id,
        projectId: req.params.projectId,
        targetUserId: req.params.userId,
        previousRole: 'projectAdmin',
        newRole: null,
        action: 'member_removed',
      });
      res.status(409).json({ error: { code: 'CONFLICT', message: 'Cannot remove the last project admin' } });
      return;
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await deleteMembership(req.params.userId, req.params.projectId, session);

    await writeAuditEntry({
      session,
      userId: req.user!.id,
      projectId: req.params.projectId,
      targetUserId: req.params.userId,
      previousRole: membership.role,
      action: 'member_removed',
      result: 'allowed',
    });

    await session.commitTransaction();
    res.json({ message: 'Member removed' });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
});

export const memberRoutes = router;