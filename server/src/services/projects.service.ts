import mongoose, { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import type { ProjectDoc } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { AppError } from '../utils/app-error.js';
import { writeAuditEntry } from './audit.service.js';
import { createMembership } from './membership.service.js';

export type ProjectView = Pick<
    ProjectDoc,
    'name' | 'environments' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'
> & {
    _id: Types.ObjectId;
    role?: 'projectAdmin' | 'developer' | 'auditor';
};

export async function listProjectsForUser(userId: string): Promise<ProjectView[]> {
    const memberships = await ProjectMembershipModel.find({
        userId: new Types.ObjectId(userId),
    }).lean();
    const projects = await ProjectModel.find({
        _id: { $in: memberships.map((membership) => membership.projectId) },
    }).lean();
    return projects.map((project) => ({
        ...project,
        role: memberships.find(
            (membership) => membership.projectId.toString() === project._id.toString(),
        )?.role,
    }));
}

export async function createProject(userId: string, name: string): Promise<ProjectView> {
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
        await writeAuditEntry({
            session,
            userId,
            projectId: project._id.toString(),
            action: 'project_created',
            result: 'allowed',
        });
        await session.commitTransaction();
        return project.toObject();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}

export async function getProject(projectId: string): Promise<ProjectView> {
    const project = await ProjectModel.findById(projectId).lean();
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found');
    return project;
}

export async function getProjectStatus(projectId: string) {
    return ProjectModel.findById(projectId).select('status').lean();
}
