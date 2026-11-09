import mongoose, { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipDoc } from '../models/ProjectMembership.js';
import { SecretModel } from '../models/Secret.js';
import type { SecretDoc } from '../models/Secret.js';
import { encrypt, decrypt } from '../services/encryption.service.js';
import { AppError } from '../utils/app-error.js';
import { buildCursorCondition, decodeCursor, encodeCursor, escapeRegex } from '../utils/pagination.js';
import { writeAuditEntry } from './audit.service.js';

function toSecretSummary(secret: Pick<SecretDoc, 'key' | 'environment' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'> & { _id: Types.ObjectId }) {
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
        return { data: [], nextCursor: null, hasMore: false, limit: query.limit };
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
    if (decoded) {
        conditions.push(buildCursorCondition(decoded));
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };
    const rows = await SecretModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(query.limit + 1)
        .lean()
        .select('key environment createdAt updatedAt lastAccessedAt');

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
    // Generate secret ID before encryption
    const secretId = new Types.ObjectId();

    const encrypted = encrypt(value, projectId, secretId.toString(), environment);

    const secret: SecretDoc = new SecretModel({
        _id: secretId,
        projectId,
        environment,
        key,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        encryptionKeyVersion: encrypted.encryptionKeyVersion,
        createdBy: userId,
        lastEditedBy: null,
        lastAccessedAt: null,
        lastAccessedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await secret.save({ session });
        await writeAuditEntry({
            session,
            userId,
            projectId,
            secretId: secretId.toString(),
            secretKey: key,
            environment: secret.environment,
            action: 'create',
            result: 'allowed',
        });
        await session.commitTransaction();
        return secret;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}

export async function editSecret(
    userId: string,
    projectId: string,
    secretId: string,
    value: string,
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

    const encrypted = encrypt(value, projectId, secretId, oldSecret.environment);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const updated = await SecretModel.findOneAndUpdate(
            { _id: secretObjectId, projectId },
            {
                $set: {
                    ciphertext: encrypted.ciphertext,
                    iv: encrypted.iv,
                    authTag: encrypted.authTag,
                    encryptionKeyVersion: encrypted.encryptionKeyVersion,
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
            secretKey: oldSecret.key,
            environment: oldSecret.environment,
            action: 'edit',
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
    session.startTransaction();
    try {
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

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
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
    session.startTransaction();
    try {
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
        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }

    return { value };
}
