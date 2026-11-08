import { auditLogEntrySchema, type AuditLogQuery } from '@raaz/shared-schemas';
import { Types, type ClientSession } from 'mongoose';
import { AuditLogEntryModel, type AuditLogEntryDoc } from '../models/AuditLogEntry.js';
import { UserModel } from '../models/User.js';

export async function listProjectAuditEntries(projectId: string, filters: AuditLogQuery) {
    const { limit = 100, ...criteria } = filters;
    const entries = await AuditLogEntryModel.find({ projectId, ...criteria })
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .lean();
    const ids = entries
        .flatMap((entry) => [entry.userId, entry.targetUserId])
        .filter((id): id is Types.ObjectId => id != null);
    const users = await UserModel.find({ _id: { $in: ids } })
        .select('email')
        .lean();
    const actors = new Map(
        users.map((user) => [user._id.toString(), { id: user._id.toString(), email: user.email }]),
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
