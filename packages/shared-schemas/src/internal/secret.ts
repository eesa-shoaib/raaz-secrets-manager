import { z } from 'zod';
import { secretResponseSchema } from '../secret.js';

export const internalSecretSchema = secretResponseSchema.extend({
  ciphertext: z.any(),
  iv: z.any(),
  authTag: z.any(),
  encryptionKeyVersion: z.number().int().positive(),
  createdBy: z.string(),
  lastEditedBy: z.string().nullable().optional(),
});
export type InternalSecret = z.infer<typeof internalSecretSchema>;
