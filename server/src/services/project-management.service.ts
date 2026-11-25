import type { adminProjectsQuerySchema } from '@raaz/shared-schemas';
import mongoose, { Types } from 'mongoose';
import type { z } from 'zod';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { SecretModel } from '../models/Secret.js';
import { AppError } from '../utils/app-error.js';
import {
    buildCursorCondition,
    decodeCursor,
    encodeCursor,
    escapeRegex,
} from '../utils/pagination.js';
import { writeAuditEntry } from './audit.service.js';

export async function listAdminProjects(query: z.infer<typeof adminProjectsQuerySchema>) {
    const scope = `adminProjects:${query.search}:${query.status ?? ''}`;
    const decoded = query.cursor ? decodeCursor(query.cursor, scope) : null;
    const base = {
        ...(query.search ? { name: new RegExp(escapeRegex(query.search), 'i') } : {}),
        ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
        ProjectModel.find(decoded ? { $and: [base, buildCursorCondition(decoded)] } : base)
            .select('_id name status createdAt')
            .sort({ createdAt: -1, _id: -1 })
            .limit(query.limit + 1)
            .lean(),
        ProjectModel.countDocuments(base),
    ]);
    const data = rows.slice(0, query.limit);
    const counts = await ProjectMembershipModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { projectId: { $in: data.map((project) => project._id) } } },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]);
    const map = new Map(counts.map((row) => [row._id.toString(), row.count]));
    const last = data.at(-1);
    return {
        data: data.map((project) => ({
            id: project._id.toString(),
            name: project.name,
            status: project.status,
            createdAt: project.createdAt,
            memberCount: map.get(project._id.toString()) ?? 0,
        })),
        nextCursor:
            rows.length > query.limit && last
                ? encodeCursor(scope, last.createdAt, last._id.toString())
                : null,
        hasMore: rows.length > query.limit,
        total,
        limit: query.limit,
    };
}
export async function setProjectStatus(
    userId: string,
    projectId: string,
    status: 'active' | 'archived',
) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const project = await ProjectModel.findById(projectId).session(session);
            if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found');
            if (project.status === status) return;
            project.status = status;
            await project.save({ session });
            await writeAuditEntry({
                session,
                userId,
                projectId,
                projectName: project.name,
                action: status === 'archived' ? 'project_archived' : 'project_restored',
                result: 'allowed',
            });
        });
    } finally {
        await session.endSession();
    }
}
export async function deleteProject(userId: string, projectId: string, confirmName: string) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const project = await ProjectModel.findById(projectId).session(session);
            if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found');
            if (project.status !== 'active')
                throw new AppError(409, 'CONFLICT', 'Restore the project before deleting it');
            if (project.name !== confirmName)
                throw new AppError(422, 'VALIDATION_ERROR', 'Project name does not match');
            await ProjectModel.deleteOne({ _id: projectId }, { session });
            await SecretModel.deleteMany({ projectId }, { session });
            await ProjectMembershipModel.deleteMany({ projectId }, { session });
            await writeAuditEntry({
                session,
                userId,
                projectId,
                projectName: project.name,
                action: 'project_deleted',
                result: 'allowed',
            });
        });
    } finally {
        await session.endSession();
    }
}
