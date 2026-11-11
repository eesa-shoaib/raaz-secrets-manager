import mongoose, { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import type { ProjectDoc } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { AppError } from '../utils/app-error.js';
import { buildCursorCondition, decodeCursor, encodeCursor, escapeRegex } from '../utils/pagination.js';
import { writeAuditEntry } from './audit.service.js';
import { createMembership } from './membership.service.js';

export type ProjectView = Pick<
    ProjectDoc,
    'name' | 'description' | 'environments' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt'
> & {
    _id: Types.ObjectId;
    role?: 'projectAdmin' | 'developer' | 'auditor';
    memberCount?: number;
};

async function getMemberCountsMap(projectIds: Types.ObjectId[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const counts = await ProjectMembershipModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { projectId: { $in: projectIds } } },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]);
    return new Map(counts.map((entry) => [entry._id.toString(), entry.count]));
}

export async function listProjectsForUser(
    userId: string,
    search?: string,
): Promise<ProjectView[]> {
    const memberships = await ProjectMembershipModel.find({
        userId: new Types.ObjectId(userId),
    }).lean();
    if (memberships.length === 0) return [];
    const filter: Record<string, unknown> = {
        _id: { $in: memberships.map((membership) => membership.projectId) },
    };
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ name: pattern }, { description: pattern }];
    }
    const projects = await ProjectModel.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
    const countsMap = await getMemberCountsMap(projects.map((p) => p._id));
    return projects.map((project) => ({
        ...project,
        description: project.description ?? '',
        role: memberships.find(
            (membership) => membership.projectId.toString() === project._id.toString(),
        )?.role,
        memberCount: countsMap.get(project._id.toString()) ?? 0,
    }));
}

export async function listProjectsCursor(
    userId: string,
    query: { cursor?: string; limit: number; search?: string },
): Promise<{
    data: ProjectView[];
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
}> {
    const scope = `projects:${userId}:${query.search ?? ''}`;
    const decoded = query.cursor ? decodeCursor(query.cursor, scope) : null;
    const memberships = await ProjectMembershipModel.find({
        userId: new Types.ObjectId(userId),
    }).lean();
    if (memberships.length === 0) {
        return { data: [], nextCursor: null, hasMore: false, limit: query.limit };
    }

    const conditions: Record<string, unknown>[] = [
        { _id: { $in: memberships.map((membership) => membership.projectId) } },
    ];
    if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), 'i');
        conditions.push({ $or: [{ name: pattern }, { description: pattern }] });
    }
    if (decoded) {
        conditions.push(buildCursorCondition(decoded));
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };
    const rows = await ProjectModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(query.limit + 1)
        .lean();

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const countsMap = await getMemberCountsMap(items.map((p) => p._id));
    const roleMap = new Map(memberships.map((m) => [m.projectId.toString(), m.role]));

    const last = items[items.length - 1];
    const nextCursor =
        hasMore && last ? encodeCursor(scope, last.createdAt, last._id.toString()) : null;

    return {
        data: items.map((project) => ({
            ...project,
            description: project.description ?? '',
            role: roleMap.get(project._id.toString()),
            memberCount: countsMap.get(project._id.toString()) ?? 0,
        })),
        nextCursor,
        hasMore,
        limit: query.limit,
    };
}

export async function createProject(
    userId: string,
    name: string,
    description = '',
): Promise<ProjectView> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const project = new ProjectModel({
            name,
            description,
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
        return { ...project.toObject(), memberCount: 1 };
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
    const memberCount = await ProjectMembershipModel.countDocuments({
        projectId: project._id,
    });
    return {
        ...project,
        description: project.description ?? '',
        memberCount,
    };
}

export async function updateProjectDetails(
    projectId: string,
    actorUserId: string,
    input: { name?: string; description?: string },
): Promise<ProjectView> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const updates: Record<string, string> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined) updates.description = input.description;

        const project = await ProjectModel.findByIdAndUpdate(
            projectId,
            { $set: updates },
            { new: true, runValidators: true, session },
        ).lean();
        if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found');

        const action =
            input.description === undefined && input.name !== undefined
                ? 'project_renamed'
                : 'project_updated';
        await writeAuditEntry({
            session,
            userId: actorUserId,
            projectId,
            action,
            result: 'allowed',
        });

        await session.commitTransaction();
        const memberCount = await ProjectMembershipModel.countDocuments({
            projectId: project._id,
        });
        return {
            ...project,
            description: project.description ?? '',
            memberCount,
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}

export async function getProjectStatus(projectId: string) {
    return ProjectModel.findById(projectId).select('status').lean();
}
