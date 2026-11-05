import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformConfigModel } from '../models/PlatformConfig.js';
import { UserModel } from '../models/User.js';
import { updateUser } from './admin.service.js';
import { writeAuditEntry } from './audit.service.js';

vi.mock('./audit.service.js', () => ({ writeAuditEntry: vi.fn().mockResolvedValue(undefined) }));

describe('platform admin invariant', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('deactivates a non-final admin and writes its audit record in the transaction', async () => {
        const session = {
            withTransaction: async (fn: () => Promise<void>) => fn(),
            endSession: vi.fn(),
        };
        vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
        const user = {
            _id: new mongoose.Types.ObjectId(),
            email: 'admin@example.com',
            isActive: true,
            isPlatformAdmin: true,
            tokenVersion: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(UserModel, 'findById').mockReturnValue({ session: async () => user } as never);
        vi.spyOn(PlatformConfigModel, 'findOneAndUpdate').mockResolvedValue({} as never);
        const actor = new mongoose.Types.ObjectId().toString();
        const response = await updateUser(actor, user._id.toString(), { isActive: false });
        expect(response.isActive).toBe(false);
        expect(user.tokenVersion).toBe(1);
        expect(user.save).toHaveBeenCalledWith({ session });
        expect(writeAuditEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                session,
                userId: actor,
                action: 'user_deactivated',
                result: 'allowed',
            }),
        );
    });
    it.each([{ isActive: false }, { isPlatformAdmin: false }])(
        'rejects removing the final active admin',
        async (input) => {
            const session = {
                withTransaction: async (fn: () => Promise<void>) => fn(),
                endSession: vi.fn(),
            };
            vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);
            const save = vi.fn();
            const user = {
                _id: new mongoose.Types.ObjectId(),
                isActive: true,
                isPlatformAdmin: true,
                tokenVersion: 0,
                save,
            };
            vi.spyOn(UserModel, 'findById').mockReturnValue({ session: async () => user } as never);
            const counter = vi
                .spyOn(PlatformConfigModel, 'findOneAndUpdate')
                .mockResolvedValue(null as never);
            await expect(
                updateUser(new mongoose.Types.ObjectId().toString(), user._id.toString(), input),
            ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
            expect(counter).toHaveBeenCalledWith(
                { _id: 'singleton', activePlatformAdminCount: { $gt: 1 } },
                { $inc: { activePlatformAdminCount: -1 } },
                { session },
            );
            expect(save).not.toHaveBeenCalled();
            expect(session.endSession).toHaveBeenCalled();
        },
    );
});
