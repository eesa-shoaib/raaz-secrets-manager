import { z } from 'zod';

export const internalSecretSchema = z.object({
  projectId: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  key: z.string(),
  ciphertext: z.any(),
  iv: z.any(),
  authTag: z.any(),
  encryptionKeyVersion: z.number(),
  createdBy: z.string(),
  lastEditedBy: z.string().nullable(),
  lastAccessedAt: z.date().nullable(),
  lastAccessedBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type InternalSecret = z.infer<typeof internalSecretSchema>;