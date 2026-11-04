import { z } from 'zod';
import { secretResponseSchema } from '../secret.js';

export const internalSecretSchema = secretResponseSchema.extend({
    projectId: z.string(),
    ciphertext: z.any(),
    iv: z.any(),
    authTag: z.any(),
    encryptionKeyVersion: z.number().int().positive(),
    createdBy: z.string(),
    lastEditedBy: z.string().nullable(),
    lastAccessedAt: z.coerce.date().nullable(),
    lastAccessedBy: z.string().nullable(),
});
export type InternalSecret = z.infer<typeof internalSecretSchema>;
