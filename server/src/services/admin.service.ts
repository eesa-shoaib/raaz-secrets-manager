import { publicUserSchema } from '@raaz/shared-schemas';
import mongoose from 'mongoose';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/app-error.js';
import {
    buildAdminUsersCursorCondition,
    decodeAdminUsersCursor,
    encodeAdminUsersCursor,
} from '../utils/pagination.js';
import { writeAuditEntry } from './audit.service.js';

function publicUser(user: {
    _id: mongoose.Types.ObjectId;
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

export async function listUsers(page: number, limit: number) {
    const [users, total] = await Promise.all([
        UserModel.find()
            .sort({ isPlatformAdmin: -1, createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        UserModel.countDocuments(),
    ]);
    return { data: users.map(publicUser), page, limit, total };
}

export async function listUsersCursor(cursor?: string, limit = 25) {
    const filter = cursor ? buildAdminUsersCursorCondition(decodeAdminUsersCursor(cursor)) : {};
    const rows = await UserModel.find(filter)
        .sort({ isPlatformAdmin: -1, createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean();

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows.at(-1);
    const nextCursor =
        hasMore && last
            ? encodeAdminUsersCursor(last.isPlatformAdmin, last.createdAt, last._id.toString())
            : null;

    return {
        data: pageRows.map(publicUser),
        nextCursor,
        hasMore,
        limit,
    };
}

export async function updateUser(
    actorId: string,
    userId: string,
    input: { isActive?: boolean; isPlatformAdmin?: boolean },
) {
    const session = await mongoose.startSession();
    try {
        let result: ReturnType<typeof publicUser> | undefined;
        await session.withTransaction(async () => {
            const user = await UserModel.findById(userId).session(session);
            if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
            const wasActiveAdmin = user.isActive && user.isPlatformAdmin;
            const nextActive = input.isActive ?? user.isActive;
            const nextAdmin = input.isPlatformAdmin ?? user.isPlatformAdmin;
            const willBeActiveAdmin = nextActive && nextAdmin;
            if (wasActiveAdmin && !willBeActiveAdmin) {
                const updated = await PlatformConfigModel.findOneAndUpdate(
                    { _id: 'singleton', activePlatformAdminCount: { $gt: 1 } },
                    { $inc: { activePlatformAdminCount: -1 } },
                    { session },
                );
                if (!updated)
                    throw new AppError(
                        409,
                        'CONFLICT',
                        'Cannot remove the last active platform admin',
                    );
            } else if (!wasActiveAdmin && willBeActiveAdmin) {
                const updated = await PlatformConfigModel.findOneAndUpdate(
                    { _id: 'singleton' },
                    { $inc: { activePlatformAdminCount: 1 } },
                    { session },
                );
                if (!updated) throw new Error('Platform admin counter is missing');
            }
            if (actorId === userId && (!nextActive || !nextAdmin)) {
                throw new AppError(
                    403,
                    'FORBIDDEN',
                    'Platform Admins cannot revoke their own admin role or deactivate their own account from user management',
                );
            }
            const activeChanged = user.isActive !== nextActive;
            const roleChanged = user.isPlatformAdmin !== nextAdmin;
            user.isActive = nextActive;
            user.isPlatformAdmin = nextAdmin;
            if ((activeChanged && !nextActive) || (roleChanged && !nextAdmin))
                user.tokenVersion += 1;
            await user.save({ session });
            if (activeChanged)
                await writeAuditEntry({
                    session,
                    userId: actorId,
                    targetUserId: userId,
                    action: nextActive ? 'user_activated' : 'user_deactivated',
                    result: 'allowed',
                });
            if (roleChanged)
                await writeAuditEntry({
                    session,
                    userId: actorId,
                    targetUserId: userId,
                    action: nextAdmin ? 'platform_admin_granted' : 'platform_admin_revoked',
                    result: 'allowed',
                });
            result = publicUser(user);
        });
        return result!;
    } finally {
        await session.endSession();
    }
}
