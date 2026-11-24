import mongoose, { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipDoc } from '../models/ProjectMembership.js';
import { SecretModel } from '../models/Secret.js';
import type { SecretDoc } from '../models/Secret.js';
import { encrypt, decrypt } from '../services/encryption.service.js';
import { AppError } from '../utils/app-error.js';
import {
    buildCursorCondition,
    decodeCursor,
    encodeCursor,
    escapeRegex,
} from '../utils/pagination.js';
import { writeAuditEntry } from './audit.service.js';
import { lockActiveProject } from './project-write.service.js';

function toSecretSummary(
    secret: Pick<
        SecretDoc,
        'key' | 'environment' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'
    > & { _id: Types.ObjectId },
) {
    return {
        id: secret._id.toString(),
        key: secret.key,
        environment: secret.environment,
        maskedValue: '••••••••',
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
        lastAccessedAt: secret.lastAccessedAt,
    };
}

export async function listSecretsForUser(
    userId: string,
    projectId: string,
    environment: string,
    search?: string,
) {
    const membership = (await mongoose
        .model('ProjectMembership')
        .findOne({ userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) })
        .lean()) as ProjectMembershipDoc | null;
    if (!membership) return [];

    const project = await ProjectModel.findById(projectId).lean();
    if (!project?.environments.includes(environment as SecretDoc['environment']))
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid environment');

    const filter: Record<string, unknown> = {
        projectId: new Types.ObjectId(projectId),
        environment,
    };
    if (search) {
        filter.key = { $regex: new RegExp(escapeRegex(search), 'i') };
    }

    const secrets = await SecretModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .lean()
        .select('key environment createdAt updatedAt lastAccessedAt');

    return secrets.map(toSecretSummary);
}

export async function listSecretsCursor(
    userId: string,
    projectId: string,
    query: { environment: string; cursor?: string; limit: number; search?: string },
) {
    const membership = (await mongoose
        .model('ProjectMembership')
        .findOne({ userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) })
        .lean()) as ProjectMembershipDoc | null;
    if (!membership) {
        return { data: [], nextCursor: null, hasMore: false, limit: query.limit, total: 0 };
    }

    const project = await ProjectModel.findById(projectId).lean();
    if (!project?.environments.includes(query.environment as SecretDoc['environment']))
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid environment');

    const scope = `secrets:${projectId}:${query.environment}:${query.search ?? ''}`;
    const decoded = query.cursor ? decodeCursor(query.cursor, scope) : null;

    const conditions: Record<string, unknown>[] = [
        { projectId: new Types.ObjectId(projectId), environment: query.environment },
    ];
    if (query.search) {
        conditions.push({ key: { $regex: new RegExp(escapeRegex(query.search), 'i') } });
    }
    const countFilter = conditions.length === 1 ? conditions[0] : { $and: [...conditions] };
    if (decoded) {
        conditions.push(buildCursorCondition(decoded));
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };
    const [rows, total] = await Promise.all([
        SecretModel.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .limit(query.limit + 1)
            .lean()
            .select('key environment createdAt updatedAt lastAccessedAt'),
        SecretModel.countDocuments(countFilter),
    ]);

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
        hasMore && last ? encodeCursor(scope, last.createdAt, last._id.toString()) : null;

    return {
        data: items.map(toSecretSummary),
        nextCursor,
        hasMore,
        limit: query.limit,
        total,
    };
}

export async function createSecret(
    userId: string,
    projectId: string,
    key: string,
    environment: string,
    value: string,
): Promise<SecretDoc> {
    const project = await ProjectModel.findById(projectId).lean();
    if (!project?.environments.includes(environment as SecretDoc['environment']))
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid environment');
    const role = (await mongoose
        .model('ProjectMembership')
        .findOne({ userId, projectId })
        .lean()) as ProjectMembershipDoc | null;
    if (role?.role === 'developer' && environment !== 'development') {
        await writeAuditEntry({
            userId,
            projectId,
            secretKey: key,
            environment: environment as SecretDoc['environment'],
            action: 'create',
            result: 'denied',
        });
        throw new AppError(403, 'FORBIDDEN', 'Developers can only create secrets in development');
    }
    const session = await mongoose.startSession();
    try {
        let secret: SecretDoc | null = null;
        await session.withTransaction(async () => {
            secret = await createSecretInTransaction(
                userId,
                projectId,
                key,
                environment as SecretDoc['environment'],
                value,
                session,
            );
        });
        return secret!;
    } finally {
        await session.endSession();
    }
}

// Internal write primitive: callers establish authorization and own the transaction.
export async function createSecretInTransaction(
    userId: string,
    projectId: string,
    key: string,
    environment: SecretDoc['environment'],
    value: string,
    session: mongoose.ClientSession,
): Promise<SecretDoc> {
    await lockActiveProject(projectId, session);
    const secretId = new Types.ObjectId();
    const encrypted = encrypt(value, projectId, secretId.toString(), environment);
    const secret = new SecretModel({
        _id: secretId,
        projectId,
        environment,
        key,
        ...encrypted,
        createdBy: userId,
        lastEditedBy: null,
        lastAccessedAt: null,
        lastAccessedBy: null,
    });
    await secret.save({ session });
    await writeAuditEntry({
        session,
        userId,
        projectId,
        secretId: secretId.toString(),
        secretKey: key,
        environment,
        action: 'create',
        result: 'allowed',
    });
    return secret;
}

export async function editSecret(
    userId: string,
    projectId: string,
    secretId: string,
    value: string | undefined,
    key?: string,
): Promise<void> {
    const secretObjectId = new Types.ObjectId(secretId);

    // Check membership and role
    const membership = (await mongoose
        .model('ProjectMembership')
        .findOne({ userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) })
        .lean()) as ProjectMembershipDoc | null;

    if (!membership) {
        throw new AppError(403, 'FORBIDDEN', 'Insufficient role for this action');
    }

    const oldSecret = await SecretModel.findOne({ _id: secretObjectId, projectId }).lean();
    if (!oldSecret) {
        throw new AppError(404, 'NOT_FOUND', 'Secret not found');
    }

    if (membership.role === 'developer' && oldSecret.environment !== 'development') {
        await writeAuditEntry({
            userId,
            projectId,
            secretId,
            secretKey: oldSecret.key,
            environment: oldSecret.environment,
            action: 'edit',
            result: 'denied',
        });
        throw new AppError(
            403,
            'FORBIDDEN',
            'Developers can only edit secrets in development environment',
        );
    }

    if (value === undefined && (key === undefined || key === oldSecret.key)) return;
    const encrypted =
        value === undefined ? {} : encrypt(value, projectId, secretId, oldSecret.environment);

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const updated = await SecretModel.findOneAndUpdate(
                { _id: secretObjectId, projectId },
                {
                    $set: {
                        ...encrypted,
                        ...(key === undefined ? {} : { key }),
                        lastEditedBy: userId,
                        updatedAt: new Date(),
                    },
                },
                { new: true, session },
            ).exec();
            if (!updated) throw new AppError(404, 'NOT_FOUND', 'Secret not found');

            await writeAuditEntry({
                session,
                userId,
                projectId,
                secretId,
                secretKey: key ?? oldSecret.key,
                environment: oldSecret.environment,
                action: 'edit',
                result: 'allowed',
            });
        });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)
            throw new AppError(
                409,
                'CONFLICT',
                'A secret with that key already exists in this environment',
            );
        throw error;
    } finally {
        await session.endSession();
    }
}

export async function deleteSecret(
    userId: string,
    projectId: string,
    secretId: string,
): Promise<void> {
    const secretObjectId = new Types.ObjectId(secretId);

    const membership = (await mongoose
        .model('ProjectMembership')
        .findOne({ userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) })
        .lean()) as ProjectMembershipDoc | null;

    if (!membership) {
        throw new AppError(403, 'FORBIDDEN', 'Insufficient role for this action');
    }

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const deleted = await SecretModel.findOneAndDelete(
                { _id: secretObjectId, projectId },
                { session },
            ).lean();
            if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Secret not found');

            await writeAuditEntry({
                session,
                userId,
                projectId,
                secretId,
                secretKey: deleted.key,
                environment: deleted.environment,
                action: 'delete',
                result: 'allowed',
            });
        });
    } finally {
        await session.endSession();
    }
}

export async function getSecretMetadata(projectId: string, secretId: string) {
    return SecretModel.findOne({ _id: secretId, projectId }).lean();
}

export async function getSecretAuditMetadata(projectId: string, secretId: string) {
    return SecretModel.findOne({ _id: secretId, projectId }, { environment: 1, key: 1 }).lean();
}

export async function generateEnvExample(
    projectId: string,
    environment: SecretDoc['environment'],
): Promise<{ filename: string; content: string }> {
    const project = await ProjectModel.findById(projectId).select('name environments').lean();
    if (!project) {
        throw new AppError(404, 'NOT_FOUND', 'Project not found');
    }
    if (!project.environments.includes(environment)) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid environment');
    }

    const secrets = await SecretModel.find(
        { projectId: new Types.ObjectId(projectId), environment },
        { key: 1, _id: 0 },
    )
        .sort({ key: 1 })
        .lean();

    const safeProjectName = project.name.replace(/[\r\n]+/g, ' ').trim();
    const header = `# .env.example — ${safeProjectName} (${environment})`;
    const lines = [header, ...secrets.map((secret) => `${secret.key}=`)];

    return {
        filename: `.env.${environment}.example`,
        content: `${lines.join('\n')}\n`,
    };
}

function formatEnvValue(value: string): string {
    if (value === '') return '';
    if (/[\s"'#\\$`\r\n]/.test(value)) {
        const escaped = value
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
        return `"${escaped}"`;
    }
    return value;
}

export async function importSecrets(
    userId: string,
    projectId: string,
    environment: SecretDoc['environment'],
    mode: 'skip_existing' | 'overwrite',
    entries: Array<{ key: string; value: string }>,
): Promise<{ created: number; updated: number; skipped: number; total: number }> {
    const project = await ProjectModel.findById(projectId).select('environments').lean();
    if (!project) {
        throw new AppError(404, 'NOT_FOUND', 'Project not found');
    }
    if (!project.environments.includes(environment)) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid environment');
    }

    const projectObjectId = new Types.ObjectId(projectId);
    const userObjectId = new Types.ObjectId(userId);
    const membership = (await mongoose
        .model('ProjectMembership')
        .findOne({ userId: userObjectId, projectId: projectObjectId })
        .lean()) as ProjectMembershipDoc | null;

    if (!membership) {
        throw new AppError(404, 'NOT_FOUND', 'Project not found');
    }

    if (membership.role === 'developer' && environment !== 'development') {
        await writeAuditEntry({
            userId,
            projectId,
            environment,
            action: 'create',
            result: 'denied',
        });
        throw new AppError(403, 'FORBIDDEN', 'Developers can only import secrets in development');
    }

    const session = await mongoose.startSession();
    try {
        let created = 0;
        let updated = 0;
        let skipped = 0;

        await session.withTransaction(async () => {
            await lockActiveProject(projectId, session);
            created = 0;
            updated = 0;
            skipped = 0;
            const now = new Date();
            const keys = entries.map((entry) => entry.key);

            const existingSecrets = await SecretModel.find(
                { projectId: projectObjectId, environment, key: { $in: keys } },
                { _id: 1, key: 1 },
            )
                .session(session)
                .lean();

            const existingByKey = new Map(
                existingSecrets.map((secret) => [secret.key, secret._id]),
            );

            for (const entry of entries) {
                const existingId = existingByKey.get(entry.key);
                if (existingId) {
                    if (mode === 'skip_existing') {
                        skipped += 1;
                        continue;
                    }

                    const secretId = existingId.toString();
                    const encrypted = encrypt(entry.value, projectId, secretId, environment);
                    await SecretModel.updateOne(
                        { _id: existingId, projectId: projectObjectId },
                        {
                            $set: {
                                ciphertext: encrypted.ciphertext,
                                iv: encrypted.iv,
                                authTag: encrypted.authTag,
                                encryptionKeyVersion: encrypted.encryptionKeyVersion,
                                lastEditedBy: userObjectId,
                                updatedAt: now,
                            },
                        },
                        { session },
                    );
                    await writeAuditEntry({
                        session,
                        userId,
                        projectId,
                        secretId,
                        secretKey: entry.key,
                        environment,
                        action: 'edit',
                        result: 'allowed',
                    });
                    updated += 1;
                } else {
                    const secretId = new Types.ObjectId();
                    const encrypted = encrypt(
                        entry.value,
                        projectId,
                        secretId.toString(),
                        environment,
                    );
                    const secret = new SecretModel({
                        _id: secretId,
                        projectId: projectObjectId,
                        environment,
                        key: entry.key,
                        ciphertext: encrypted.ciphertext,
                        iv: encrypted.iv,
                        authTag: encrypted.authTag,
                        encryptionKeyVersion: encrypted.encryptionKeyVersion,
                        createdBy: userObjectId,
                        lastEditedBy: null,
                        lastAccessedAt: null,
                        lastAccessedBy: null,
                        createdAt: now,
                        updatedAt: now,
                    });
                    secret.isNew = true;
                    await secret.save({ session });
                    await writeAuditEntry({
                        session,
                        userId,
                        projectId,
                        secretId: secretId.toString(),
                        secretKey: entry.key,
                        environment,
                        action: 'create',
                        result: 'allowed',
                    });
                    created += 1;
                }
            }
        });

        return { created, updated, skipped, total: entries.length };
    } finally {
        await session.endSession();
    }
}

export async function exportSecretsEnv(
    userId: string,
    projectId: string,
    environment: SecretDoc['environment'],
    confirm: boolean,
): Promise<{ filename: string; content: string; count: number }> {
    const project = await ProjectModel.findById(projectId).select('name environments').lean();
    if (!project) {
        throw new AppError(404, 'NOT_FOUND', 'Project not found');
    }
    if (!project.environments.includes(environment)) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Invalid environment');
    }

    if (environment === 'production' && !confirm) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Confirmation required for production export');
    }

    const projectObjectId = new Types.ObjectId(projectId);
    const userObjectId = new Types.ObjectId(userId);
    const safeProjectName = project.name.replace(/[\r\n]+/g, ' ').trim();
    const header = `# ${safeProjectName} (${environment})`;

    const session = await mongoose.startSession();
    try {
        let lines: string[] = [header];
        let count = 0;

        await session.withTransaction(async () => {
            lines = [header];
            const now = new Date();
            const secrets = await SecretModel.find(
                { projectId: projectObjectId, environment },
                {
                    key: 1,
                    environment: 1,
                    ciphertext: 1,
                    iv: 1,
                    authTag: 1,
                    encryptionKeyVersion: 1,
                },
            )
                .sort({ key: 1 })
                .session(session)
                .lean();

            count = secrets.length;
            if (secrets.length === 0) {
                return;
            }

            const secretIds: Types.ObjectId[] = [];
            for (const secret of secrets) {
                const value = decrypt(
                    secret.ciphertext,
                    secret.iv,
                    secret.authTag,
                    projectId,
                    secret._id.toString(),
                    secret.environment,
                    secret.encryptionKeyVersion,
                );
                lines.push(`${secret.key}=${formatEnvValue(value)}`);
                secretIds.push(secret._id);
            }

            await SecretModel.updateMany(
                { _id: { $in: secretIds }, projectId: projectObjectId },
                { $set: { lastAccessedAt: now, lastAccessedBy: userObjectId } },
                { session },
            );

            for (const secret of secrets) {
                await writeAuditEntry({
                    session,
                    userId,
                    projectId,
                    secretId: secret._id.toString(),
                    secretKey: secret.key,
                    environment: secret.environment,
                    action: 'reveal',
                    result: 'allowed',
                });
            }
        });

        return {
            filename: `.env.${environment}`,
            content: `${lines.join('\n')}\n`,
            count,
        };
    } finally {
        await session.endSession();
    }
}

export async function revealSecret(
    userId: string,
    projectId: string,
    secretId: string,
    confirm: boolean,
): Promise<{ value: string } | null> {
    const secret = await SecretModel.findOne(
        { _id: new Types.ObjectId(secretId), projectId: new Types.ObjectId(projectId) },
        { environment: 1, key: 1, ciphertext: 1, iv: 1, authTag: 1, encryptionKeyVersion: 1 },
        { lean: true },
    ).exec();

    if (!secret) return null;

    if (secret.environment === 'production' && !confirm) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Confirmation required for production reveal');
    }

    const value = decrypt(
        secret.ciphertext,
        secret.iv,
        secret.authTag,
        projectId,
        secretId,
        secret.environment,
        secret.encryptionKeyVersion,
    );

    // Record access audit entry
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            await writeAuditEntry({
                session,
                userId,
                projectId,
                secretId,
                environment: secret.environment,
                secretKey: secret.key,
                action: 'reveal',
                result: 'allowed',
            });
            await SecretModel.updateOne(
                { _id: secretId, projectId },
                { $set: { lastAccessedAt: new Date(), lastAccessedBy: userId } },
                { session },
            );
        });
    } finally {
        await session.endSession();
    }

    return { value };
}
