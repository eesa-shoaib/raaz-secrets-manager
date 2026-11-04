import mongoose, { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import { createMembership } from './membership.service.js';
import { writeAuditEntry } from './audit.service.js';
import { AppError } from '../utils/app-error.js';

export async function listProjectsForUser(userId: string): Promise<any[]> {
  const memberships = await mongoose.model('ProjectMembership').find({ userId: new Types.ObjectId(userId) }).lean();
  const projects = await ProjectModel.find({ _id: { $in: memberships.map((membership) => membership.projectId) } }).lean();
  return projects.map((project) => ({
    ...project,
    role: memberships.find((membership) => membership.projectId.toString() === project._id.toString())?.role,
  }));
}

export async function createProject(userId: string, name: string): Promise<any> {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const project = new ProjectModel({
      name,
      environments: ['development', 'staging', 'production'],
      activeAdminCount: 1,
      status: 'active',
      createdBy: new Types.ObjectId(userId),
    });
    await project.save({ session });
    await createMembership(userId, project._id.toString(), 'projectAdmin', session);
    await writeAuditEntry({ session, userId, projectId: project._id.toString(), action: 'project_created', result: 'allowed' });
    await session.commitTransaction();
    return project.toObject();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function getProject(projectId: string): Promise<any> {
  const project = await ProjectModel.findById(projectId).lean();
  if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found');
  return project;
}
