import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { UserModel } from '../models/User.js';
import { AppError } from '../utils/app-error.js';
import { writeAuditEntry } from './audit.service.js';

export async function claimGitHubUsername(userId: string, login: string) {
    let base = login
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 30);
    if (!base) return;
    if (base.length < 3) base += '-gh';
    const candidates = [
        base,
        `${base.slice(0, 23)}-${userId.slice(-6)}`,
        `${base.slice(0, 23)}-${randomBytes(3).toString('hex')}`,
    ];
    for (const username of candidates) {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const updated = await UserModel.findOneAndUpdate(
                    { _id: userId, isActive: true, username: null },
                    { $set: { username } },
                    { session, new: true },
                );
                if (updated)
                    await writeAuditEntry({
                        session,
                        userId,
                        action: 'profile_updated',
                        result: 'allowed',
                    });
            });
            return;
        } catch (error) {
            if (!(
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 11000
            ))
                throw new AppError(500, 'INTERNAL_ERROR', 'Unable to save account profile');
        } finally {
            await session.endSession();
        }
    }
}
