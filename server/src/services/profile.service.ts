import { publicUserSchema } from '@raaz/shared-schemas';
import { internalUserAvatarSchema } from '@raaz/shared-schemas/internal';
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { UserModel } from '../models/User.js';
import { UserAvatarModel } from '../models/UserAvatar.js';
import { AppError } from '../utils/app-error.js';
import { normalizeAvatarImage, type SupportedAvatarContentType } from '../utils/avatar-image.js';
import { writeAuditEntry } from './audit.service.js';

function toPublicUser(user: {
    _id: Types.ObjectId;
    email: string;
    username?: string | null;
    hasAvatar?: boolean;
    avatarUpdatedAt?: Date | null;
    isPlatformAdmin: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}) {
    return publicUserSchema.parse({
        id: user._id.toString(),
        email: user.email,
        username: user.username ?? null,
        hasAvatar: Boolean(user.hasAvatar),
        avatarUpdatedAt: user.avatarUpdatedAt ?? null,
        isPlatformAdmin: user.isPlatformAdmin,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    });
}

export async function updateProfile(userId: string, username: string | null) {
    if (username !== null) {
        const existing = await UserModel.findOne({
            username,
            _id: { $ne: new Types.ObjectId(userId) },
        }).lean();
        if (existing) {
            throw new AppError(409, 'CONFLICT', 'Username is already taken');
        }
    }

    const session = await mongoose.startSession();
    try {
        let updatedUser: ReturnType<typeof toPublicUser> | undefined;
        await session.withTransaction(async () => {
            const user = await UserModel.findById(userId).session(session);
            if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

            user.username = username;
            await user.save({ session });

            await writeAuditEntry({
                session,
                userId,
                targetUserId: userId,
                action: 'profile_updated',
                result: 'allowed',
            });

            updatedUser = toPublicUser(user);
        });
        return updatedUser!;
    } finally {
        await session.endSession();
    }
}

export async function uploadAvatar(
    userId: string,
    rawBytes: Buffer,
    contentType: SupportedAvatarContentType,
) {
    const normalized = normalizeAvatarImage(rawBytes, contentType);
    const now = new Date();

    const session = await mongoose.startSession();
    try {
        let updatedUser: ReturnType<typeof toPublicUser> | undefined;
        await session.withTransaction(async () => {
            const existingAvatar = await UserAvatarModel.findOne({
                userId: new Types.ObjectId(userId),
            })
                .select('version')
                .session(session)
                .lean();
            const nextVersion = (existingAvatar?.version ?? 0) + 1;

            const validatedPayload = internalUserAvatarSchema.parse({
                userId,
                data: normalized.data,
                contentType: normalized.contentType,
                width: normalized.width,
                height: normalized.height,
                byteLength: normalized.byteLength,
                version: nextVersion,
            });

            await UserAvatarModel.findOneAndUpdate(
                { userId: new Types.ObjectId(userId) },
                {
                    $set: {
                        data: validatedPayload.data,
                        contentType: validatedPayload.contentType,
                        width: validatedPayload.width,
                        height: validatedPayload.height,
                        byteLength: validatedPayload.byteLength,
                        version: validatedPayload.version,
                    },
                },
                { upsert: true, new: true, session },
            );

            const user = await UserModel.findByIdAndUpdate(
                userId,
                { $set: { hasAvatar: true, avatarUpdatedAt: now } },
                { new: true, session },
            ).lean();
            if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

            await writeAuditEntry({
                session,
                userId,
                targetUserId: userId,
                action: 'avatar_updated',
                result: 'allowed',
            });

            updatedUser = toPublicUser(user);
        });
        return updatedUser!;
    } finally {
        await session.endSession();
    }
}

export async function removeAvatar(userId: string) {
    const session = await mongoose.startSession();
    try {
        let updatedUser: ReturnType<typeof toPublicUser> | undefined;
        await session.withTransaction(async () => {
            await UserAvatarModel.deleteOne({ userId: new Types.ObjectId(userId) }, { session });

            const user = await UserModel.findByIdAndUpdate(
                userId,
                { $set: { hasAvatar: false, avatarUpdatedAt: null } },
                { new: true, session },
            ).lean();
            if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

            await writeAuditEntry({
                session,
                userId,
                targetUserId: userId,
                action: 'avatar_removed',
                result: 'allowed',
            });

            updatedUser = toPublicUser(user);
        });
        return updatedUser!;
    } finally {
        await session.endSession();
    }
}

export async function getAuthorizedAvatar(
    requesterId: string,
    isPlatformAdmin: boolean,
    targetUserId: string,
) {
    let authorized = requesterId === targetUserId || isPlatformAdmin;

    if (!authorized) {
        const requesterProjectIds = await ProjectMembershipModel.distinct('projectId', {
            userId: new Types.ObjectId(requesterId),
        });
        if (requesterProjectIds.length > 0) {
            const shared = await ProjectMembershipModel.exists({
                userId: new Types.ObjectId(targetUserId),
                projectId: { $in: requesterProjectIds },
            });
            authorized = Boolean(shared);
        }
    }

    if (!authorized) {
        throw new AppError(404, 'NOT_FOUND', 'Avatar not found');
    }

    const avatar = await UserAvatarModel.findOne({
        userId: new Types.ObjectId(targetUserId),
    }).lean();
    if (!avatar) {
        throw new AppError(404, 'NOT_FOUND', 'Avatar not found');
    }

    return {
        data: Buffer.isBuffer(avatar.data)
            ? avatar.data
            : Buffer.from((avatar.data as { buffer: Uint8Array }).buffer),
        contentType: avatar.contentType,
        byteLength: avatar.byteLength,
        version: avatar.version,
    };
}

export async function deactivateOwnAccount(userId: string, currentPassword: string): Promise<void> {
    const existing = await UserModel.findById(userId).select('+passwordHash').lean();
    if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const passwordMatches = await bcrypt.compare(currentPassword, existing.passwordHash);
    if (!passwordMatches) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Current password is incorrect');
    }

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const user = await UserModel.findById(userId).session(session);
            if (!user || !user.isActive) {
                throw new AppError(401, 'UNAUTHENTICATED', 'Account is not active');
            }

            if (user.isPlatformAdmin) {
                const updated = await PlatformConfigModel.findOneAndUpdate(
                    { _id: 'singleton', activePlatformAdminCount: { $gt: 1 } },
                    { $inc: { activePlatformAdminCount: -1 } },
                    { session },
                );
                if (!updated) {
                    throw new AppError(
                        409,
                        'CONFLICT',
                        'Cannot deactivate the last active platform admin',
                    );
                }
            }

            user.isActive = false;
            user.tokenVersion += 1;
            await user.save({ session });

            await writeAuditEntry({
                session,
                userId,
                targetUserId: userId,
                action: 'user_deactivated',
                result: 'allowed',
            });
        });
    } finally {
        await session.endSession();
    }
}
