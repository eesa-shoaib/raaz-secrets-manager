import mongoose, { Types, type ClientSession } from 'mongoose';
import { SecretModel } from '../models/Secret.js';
import { ProjectModel } from '../models/Project.js';
import { UserModel } from '../models/User.js';
import { encrypt, decrypt } from '../services/encryption.service.js';
import { writeAuditEntry } from './audit.service.js';
import { AppError } from '../utils/app-error.js';
import { ProjectMembershipDoc } from '../models/ProjectMembership.js';
import type { SecretDoc } from '../models/Secret.js';

export async function listSecretsForUser(
  userId: string,
  projectId: string,
): Promise<any[]> {
  const membership = await mongoose
    .model('ProjectMembership')
    .findOne({ userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) })
    .lean() as ProjectMembershipDoc | null;
  if (!membership) return [];

  const secrets = await SecretModel.find({ projectId: new Types.ObjectId(projectId) })
    .lean()
    .select('key environment ciphertext iv authTag encryptionKeyVersion');

  return secrets.map((secret) => {
    const role = membership.role;
    let maskedValue = '••••••••';
    if (role === 'projectAdmin' || role === 'developer') {
      if (secret.environment === 'development') {
        maskedValue = '••••••••';
      }
    }
    return {
      id: secret._id.toString(),
      key: secret.key,
      environment: secret.environment,
      maskedValue,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    };
  });
}

export async function createSecret(
  userId: string,
  projectId: string,
  key: string,
  environment: string,
  value: string,
): Promise<SecretDoc> {
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
  key: string,
  environment: string,
  value: string,
): Promise<void> {
  const secretObjectId = new Types.ObjectId(secretId);

  // Check membership and role
  const membership = await mongoose
    .model('ProjectMembership')
    .findOne({ userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) })
    .lean() as ProjectMembershipDoc | null;

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient role for this action');
  }

  // Developer write restriction: only allowed in development environment
  if (membership.role === 'developer' && environment !== 'development') {
    throw new AppError(403, 'FORBIDDEN', 'Developers can only edit secrets in development environment');
  }

  const oldSecret = await SecretModel.findById(secretObjectId).lean();
  if (!oldSecret) {
    throw new AppError(404, 'NOT_FOUND', 'Secret not found');
  }

  const encrypted = encrypt(value, projectId, secretId, environment);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await SecretModel.findOneAndUpdate(
      { _id: secretObjectId },
      {
        $set: {
          key,
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

    await writeAuditEntry({
      session,
      userId,
      projectId,
      secretId,
      action: 'secret_edited',
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

  const membership = await mongoose
    .model('ProjectMembership')
    .findOne({ userId: new Types.ObjectId(userId), projectId: new Types.ObjectId(projectId) })
    .lean() as ProjectMembershipDoc | null;

  if (!membership) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient role for this action');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await SecretModel.deleteOne({ _id: secretObjectId }, { session }).exec();

    await writeAuditEntry({
      session,
      userId,
      projectId,
      secretId,
      action: 'secret_deleted',
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

export async function getSecretMetadata(
  secretId: string,
): Promise<any> {
  return SecretModel.findById(secretId).lean();
}

export async function revealSecret(
  userId: string,
  projectId: string,
  secretId: string,
): Promise<{ value: string } | null> {
  const secret = await SecretModel.findOne(
    { _id: new Types.ObjectId(secretId), projectId: new Types.ObjectId(projectId) },
    { environment: 1, key: 1, ciphertext: 1, iv: 1, authTag: 1, encryptionKeyVersion: 1 },
    { lean: true },
  ).exec();

  if (!secret) return null;

  try {
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
        action: 'secret_revealed',
        result: 'allowed',
      });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    return { value };
  } catch (error) {
    // Log decryption failure and write denied audit entry
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await writeAuditEntry({
        session,
        userId,
        projectId,
        secretId,
        environment: secret?.environment ?? null,
        action: 'secret_reveal_failed',
        result: 'denied',
      });
      await session.commitTransaction();
    } catch (error2) {
      await session.abortTransaction();
      throw error2;
    } finally {
      await session.endSession();
    }
    return null;
  }
}