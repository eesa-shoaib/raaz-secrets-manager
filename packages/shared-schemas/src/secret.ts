import { z } from 'zod';
import { projectEnvironmentEnum } from './project.js';

export const secretKeyRegex = /^[A-Z0-9_]{1,100}$/;

export const MASKED_SECRET_VALUE = '••••••••';

export const createSecretSchema = z.object({
  environment: projectEnvironmentEnum,
  key: z
    .string()
    .regex(
      secretKeyRegex,
      'Key must be 1 to 100 characters containing only uppercase letters, numbers, and underscores',
    ),
  value: z
    .string()
    .max(4096, 'Value exceeds maximum permitted size of 4KB'),
});
export type CreateSecretInput = z.infer<typeof createSecretSchema>;

export const editSecretSchema = z.object({
  value: z
    .string()
    .max(4096, 'Value exceeds maximum permitted size of 4KB'),
});
export type EditSecretInput = z.infer<typeof editSecretSchema>;

export const revealSecretSchema = z.object({
  confirm: z.boolean().optional(),
});
export type RevealSecretInput = z.infer<typeof revealSecretSchema>;

export const secretResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  environment: projectEnvironmentEnum,
  key: z.string(),
  value: z.string().default(MASKED_SECRET_VALUE),
  lastAccessedAt: z.string().or(z.date()).nullable().optional(),
  lastAccessedBy: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).optional(),
});
export type SecretResponse = z.infer<typeof secretResponseSchema>;

export const revealSecretResponseSchema = z.object({
  value: z.string(),
});
export type RevealSecretResponse = z.infer<typeof revealSecretResponseSchema>;
