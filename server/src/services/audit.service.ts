import { auditLogEntrySchema, type AuditLogQuery } from '@raaz/shared-schemas';
import { Types, type ClientSession } from 'mongoose';
import { AuditLogEntryModel, type AuditLogEntryDoc } from '../models/AuditLogEntry.js';
import { UserModel } from '../models/User.js';
import { buildCursorCondition, decodeCursor, encodeCursor } from '../utils/pagination.js';

async function hydrateAuditEntries(
    entries: (Pick<
        AuditLogEntryDoc,
        | 'action'
        | 'result'
        | 'createdAt'
        | 'userId'
        | 'targetUserId'
        | 'secretKey'
        | 'environment'
        | 'previousRole'
        | 'newRole'
    > & { _id: Types.ObjectId })[],
) {
    if (entries.length === 0) return [];
    const ids = entries
        .flatMap((entry) => [entry.userId, entry.targetUserId])
        .filter((id): id is Types.ObjectId => id != null);
    const users = await UserModel.find({ _id: { $in: ids } })
        .select('email username hasAvatar avatarUpdatedAt')
        .lean();
    const actors = new Map(
        users.map((user) => [
            user._id.toString(),
            {
                id: user._id.toString(),
                email: user.email,
                username: user.username ?? null,
                hasAvatar: user.hasAvatar ?? false,
                avatarUpdatedAt: user.avatarUpdatedAt ?? null,
            },
        ]),
    );
    return entries.map((entry) =>
        auditLogEntrySchema.parse({
            id: entry._id.toString(),
            action: entry.action,
            result: entry.result,
            createdAt: entry.createdAt,
            user: actors.get(entry.userId.toString()) ?? null,
            ...(entry.targetUserId
                ? { targetUser: actors.get(entry.targetUserId.toString()) ?? null }
                : {}),
            ...(entry.secretKey != null ? { secretKey: entry.secretKey } : {}),
            ...(entry.environment != null ? { environment: entry.environment } : {}),
            ...(entry.previousRole != null ? { previousRole: entry.previousRole } : {}),
            ...(entry.newRole != null ? { newRole: entry.newRole } : {}),
        }),
    );
}

function buildAuditCriteria(filters: AuditLogQuery): Record<string, unknown> {
    return {
        ...(filters.action !== undefined ? { action: filters.action } : {}),
        ...(filters.result !== undefined ? { result: filters.result } : {}),
        ...(filters.environment !== undefined ? { environment: filters.environment } : {}),
    };
}

export async function listProjectAuditEntries(projectId: string, filters: AuditLogQuery) {
    const limit = filters.limit ?? 100;
    const entries = await AuditLogEntryModel.find({
        projectId,
        ...buildAuditCriteria(filters),
    })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .lean();
    return hydrateAuditEntries(entries);
}

export async function listProjectAuditEntriesCursor(projectId: string, filters: AuditLogQuery) {
    const limit = filters.limit ?? 25;
    const criteria = buildAuditCriteria(filters);
    const scope = `audit:${projectId}:${filters.action ?? ''}:${filters.result ?? ''}:${filters.environment ?? ''}`;
    const decoded = filters.cursor ? decodeCursor(filters.cursor, scope) : null;

    const baseCriteria: Record<string, unknown> = {
        projectId: new Types.ObjectId(projectId),
        ...criteria,
    };
    const filter = decoded ? { $and: [baseCriteria, buildCursorCondition(decoded)] } : baseCriteria;

    const rows = await AuditLogEntryModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
        hasMore && last ? encodeCursor(scope, last.createdAt, last._id.toString()) : null;

    return {
        data: await hydrateAuditEntries(items),
        nextCursor,
        hasMore,
        limit,
    };
}

interface WriteAuditEntryParams {
    session?: ClientSession;
    userId: string;
    projectId?: string | null;
    secretId?: string | null;
    secretKey?: string | null;
    targetUserId?: string | null;
    previousRole?: 'projectAdmin' | 'developer' | 'auditor' | null;
    newRole?: 'projectAdmin' | 'developer' | 'auditor' | null;
    environment?: 'development' | 'staging' | 'production' | null;
    action: AuditLogEntryDoc['action'];
    result: 'allowed' | 'denied';
}

export async function writeAuditEntry(params: WriteAuditEntryParams): Promise<void> {
    const projectActions: AuditLogEntryDoc['action'][] = [
        'reveal',
        'create',
        'edit',
        'delete',
        'member_added',
        'member_role_changed',
        'member_removed',
        'project_created',
        'project_renamed',
        'project_updated',
        'project_environments_changed',
        'project_archived',
        'project_restored',
    ];
    const platformActions: AuditLogEntryDoc['action'][] = [
        'user_activated',
        'user_deactivated',
        'platform_admin_granted',
        'platform_admin_revoked',
        'bootstrap_admin',
        'password_changed',
        'profile_updated',
        'avatar_updated',
        'avatar_removed',
    ];
    if (
        (!projectActions.includes(params.action) && !platformActions.includes(params.action)) ||
        projectActions.includes(params.action) !== Boolean(params.projectId)
    )
        throw new Error('Invalid audit action scope');
    const entry = new AuditLogEntryModel({
        userId: new Types.ObjectId(params.userId),
        projectId: params.projectId ? new Types.ObjectId(params.projectId) : undefined,
        secretId: params.secretId ? new Types.ObjectId(params.secretId) : undefined,
        secretKey: params.secretKey,
        targetUserId: params.targetUserId ? new Types.ObjectId(params.targetUserId) : undefined,
        previousRole: params.previousRole,
        newRole: params.newRole,
        environment: params.environment,
        action: params.action,
        result: params.result,
    });

    if (params.session) {
        await entry.save({ session: params.session });
    } else {
        await entry.save();
    }
}

export async function writeDeniedAuditEntry(
    params: Omit<WriteAuditEntryParams, 'result'>,
): Promise<void> {
    await writeAuditEntry({ ...params, result: 'denied' });
}
