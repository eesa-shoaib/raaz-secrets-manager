import mongoose, { Types, type ClientSession } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipModel, type ProjectMembershipDoc } from '../models/ProjectMembership.js';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/app-error.js';
import { buildCursorCondition, decodeCursor, encodeCursor } from '../utils/pagination.js';
import { writeAuditEntry } from './audit.service.js';

async function hydrateMemberRows(
    memberships: (Pick<ProjectMembershipDoc, 'userId' | 'role' | 'createdAt'> & {
        _id: Types.ObjectId;
    })[],
) {
    if (memberships.length === 0) return [];
    const users = await UserModel.find({
        _id: { $in: memberships.map((membership) => membership.userId) },
    })
        .select('email username hasAvatar avatarUpdatedAt')
        .lean();
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    return memberships.map((membership) => {
        const user = userMap.get(membership.userId.toString());
        return {
            userId: membership.userId.toString(),
            email: user?.email ?? 'unknown',
            username: user?.username ?? null,
            hasAvatar: user?.hasAvatar ?? false,
            avatarUpdatedAt: user?.avatarUpdatedAt ?? null,
            role: membership.role,
            createdAt: membership.createdAt,
        };
    });
}

export async function listProjectMembers(projectId: string) {
    const memberships = await ProjectMembershipModel.find({
        projectId: new Types.ObjectId(projectId),
    })
        .sort({ createdAt: -1, _id: -1 })
        .lean();
    return hydrateMemberRows(memberships);
}

export async function listProjectMembersCursor(
    projectId: string,
    query: { cursor?: string; limit: number },
) {
    const scope = `members:${projectId}`;
    const decoded = query.cursor ? decodeCursor(query.cursor, scope) : null;
    const baseFilter = { projectId: new Types.ObjectId(projectId) };
    const filter = decoded ? { $and: [baseFilter, buildCursorCondition(decoded)] } : baseFilter;

    const rows = await ProjectMembershipModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(query.limit + 1)
        .lean();

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
        hasMore && last ? encodeCursor(scope, last.createdAt, last._id.toString()) : null;

    return {
        data: await hydrateMemberRows(items),
        nextCursor,
        hasMore,
        limit: query.limit,
    };
}

export async function addProjectMember(
    actorId: string,
    projectId: string,
    email: string,
    role: 'projectAdmin' | 'developer' | 'auditor',
) {
    const user = await UserModel.findOne({ email }).lean();
    if (!user) throw new AppError(404, 'NOT_FOUND', 'No account with that email');
    if (await findMembership(user._id.toString(), projectId))
        throw new AppError(409, 'CONFLICT', 'Already a member');
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await createMembership(user._id.toString(), projectId, role, session);
        if (role === 'projectAdmin') await incrementAdminCount(projectId, session);
        await writeAuditEntry({
            session,
            userId: actorId,
            projectId,
            targetUserId: user._id.toString(),
            newRole: role,
            action: 'member_added',
            result: 'allowed',
        });
        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}

export async function changeProjectMemberRole(
    actorId: string,
    projectId: string,
    userId: string,
    role: 'projectAdmin' | 'developer' | 'auditor',
) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const membership = await ProjectMembershipModel.findOne({ userId, projectId }).session(
                session,
            );
            if (!membership) throw new AppError(404, 'NOT_FOUND', 'Member not found');
            if (membership.role === role) return;
            if (membership.role === 'projectAdmin' && role !== 'projectAdmin')
                await removeProjectAdminCount(projectId, session);
            if (membership.role !== 'projectAdmin' && role === 'projectAdmin')
                await incrementAdminCount(projectId, session);
            const previousRole = membership.role;
            membership.role = role;
            await membership.save({ session });
            await writeAuditEntry({
                session,
                userId: actorId,
                projectId,
                targetUserId: userId,
                previousRole,
                newRole: role,
                action: 'member_role_changed',
                result: 'allowed',
            });
        });
    } finally {
        await session.endSession();
    }
}

export async function removeProjectMember(actorId: string, projectId: string, userId: string) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const membership = await ProjectMembershipModel.findOne({ userId, projectId }).session(
                session,
            );
            if (!membership) throw new AppError(404, 'NOT_FOUND', 'Member not found');
            if (membership.role === 'projectAdmin')
                await removeProjectAdminCount(projectId, session);
            await membership.deleteOne({ session });
            await writeAuditEntry({
                session,
                userId: actorId,
                projectId,
                targetUserId: userId,
                action: 'member_removed',
                result: 'allowed',
            });
        });
    } finally {
        await session.endSession();
    }
}

export async function findMembership(
    userId: string,
    projectId: string,
): Promise<ProjectMembershipDoc | null> {
    const result = await ProjectMembershipModel.findOne({
        userId: new Types.ObjectId(userId),
        projectId: new Types.ObjectId(projectId),
    }).lean();
    return result as ProjectMembershipDoc | null;
}

export async function getUserRole(
    userId: string,
    projectId: string,
): Promise<'projectAdmin' | 'developer' | 'auditor' | null> {
    const membership = await findMembership(userId, projectId);
    return membership?.role ?? null;
}

export async function createMembership(
    userId: string,
    projectId: string,
    role: 'projectAdmin' | 'developer' | 'auditor',
    session?: ClientSession,
): Promise<ProjectMembershipDoc> {
    const membership = new ProjectMembershipModel({
        userId: new Types.ObjectId(userId),
        projectId: new Types.ObjectId(projectId),
        role,
    });
    return membership.save({ session });
}

export async function updateMembershipRole(
    userId: string,
    projectId: string,
    role: 'projectAdmin' | 'developer' | 'auditor',
    session?: ClientSession,
): Promise<ProjectMembershipDoc | null> {
    const result = await ProjectMembershipModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) },
        { $set: { role } },
        { new: true, session },
    ).lean();
    return result as ProjectMembershipDoc | null;
}

export async function deleteMembership(
    userId: string,
    projectId: string,
    session?: ClientSession,
): Promise<void> {
    await ProjectMembershipModel.deleteOne(
        { userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) },
        { session },
    ).exec();
}

export async function incrementAdminCount(
    projectId: string,
    session?: ClientSession,
): Promise<void> {
    await ProjectModel.findByIdAndUpdate(
        projectId,
        { $inc: { activeAdminCount: 1 } },
        { session },
    ).exec();
}

export async function decrementAdminCount(
    projectId: string,
    session?: ClientSession,
): Promise<void> {
    await ProjectModel.findByIdAndUpdate(
        projectId,
        { $inc: { activeAdminCount: -1 } },
        { session },
    ).exec();
}

export async function removeProjectAdminCount(
    projectId: string,
    session: ClientSession,
): Promise<void> {
    const project = await ProjectModel.findOneAndUpdate(
        { _id: projectId, activeAdminCount: { $gt: 1 } },
        { $inc: { activeAdminCount: -1 } },
        { session },
    ).exec();

    if (!project) {
        throw new AppError(409, 'CONFLICT', 'Cannot remove the last project admin');
    }
}
