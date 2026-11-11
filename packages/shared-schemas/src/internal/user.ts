import { z } from 'zod';
import { avatarContentTypeEnum, publicUserSchema } from '../user.js';

export const internalUserSchema = publicUserSchema.extend({
    passwordHash: z.string(),
    tokenVersion: z.number().int().nonnegative().default(0),
});
export type InternalUser = z.infer<typeof internalUserSchema>;

export const MAX_AVATAR_STORAGE_BYTES = 131_072; // 128 KiB
export const MAX_AVATAR_DIMENSION = 256;

export const internalUserAvatarSchema = z.object({
    userId: z.string(),
    data: z
        .instanceof(Buffer)
        .refine((buf) => buf.byteLength > 0 && buf.byteLength <= MAX_AVATAR_STORAGE_BYTES, {
            message: 'Avatar binary payload must be between 1 and 131072 bytes',
        }),
    contentType: avatarContentTypeEnum,
    width: z.number().int().min(1).max(MAX_AVATAR_DIMENSION),
    height: z.number().int().min(1).max(MAX_AVATAR_DIMENSION),
    byteLength: z.number().int().min(1).max(MAX_AVATAR_STORAGE_BYTES),
    version: z.number().int().min(1),
    createdAt: z.string().or(z.date()).optional(),
    updatedAt: z.string().or(z.date()).optional(),
});
export type InternalUserAvatar = z.infer<typeof internalUserAvatarSchema>;
