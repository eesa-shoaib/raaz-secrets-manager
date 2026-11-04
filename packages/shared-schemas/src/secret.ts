import { z } from 'zod';
import { projectEnvironmentEnum } from './project.js';

export const secretKeyRegex = /^[A-Z0-9_]{1,100}$/;
export const MASKED_SECRET_VALUE = '••••••••';
export const createSecretSchema = z.object({
  environment: projectEnvironmentEnum,
  key: z.string().regex(secretKeyRegex),
  value: z.string().max(4096),
});
export type CreateSecretInput = z.infer<typeof createSecretSchema>;
export const editSecretSchema = z.object({ value: z.string().max(4096) });
export type EditSecretInput = z.infer<typeof editSecretSchema>;
export const revealSecretSchema = z.object({ confirm: z.boolean().optional() });
export type RevealSecretInput = z.infer<typeof revealSecretSchema>;
export const secretResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  environment: projectEnvironmentEnum,
  maskedValue: z.string().length(8),
  lastAccessedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Secret = z.infer<typeof secretResponseSchema>;
export type SecretResponse = Secret;
export const secretCreateSchema = z.object({ body: createSecretSchema });
export type SecretCreateInput = z.infer<typeof secretCreateSchema>;
export const revealSecretResponseSchema = z.object({ value: z.string() });
export type RevealSecretResponse = z.infer<typeof revealSecretResponseSchema>;
