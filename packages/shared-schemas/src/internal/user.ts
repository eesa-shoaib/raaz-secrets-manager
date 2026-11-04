import { z } from 'zod';
import { publicUserSchema } from '../user.js';

export const internalUserSchema = publicUserSchema.extend({
    passwordHash: z.string(),
    tokenVersion: z.number().int().nonnegative().default(0),
});
export type InternalUser = z.infer<typeof internalUserSchema>;
