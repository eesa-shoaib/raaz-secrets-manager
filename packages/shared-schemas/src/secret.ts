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

export const secretsListQuerySchema = z.object({
    environment: projectEnvironmentEnum,
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(100).optional(),
    mode: z.enum(['cursor']).optional(),
    page: z.never({ message: 'Offset page parameter is not supported' }).optional(),
});
export type SecretsListQuery = z.infer<typeof secretsListQuerySchema>;

export const envExampleQuerySchema = z
    .object({
        environment: projectEnvironmentEnum,
    })
    .strict();
export type EnvExampleQuery = z.infer<typeof envExampleQuerySchema>;

export const envExampleResponseSchema = z.object({
    filename: z.string().min(1),
    content: z.string(),
});
export type EnvExampleResponse = z.infer<typeof envExampleResponseSchema>;

export const importSecretsModeEnum = z.enum(['skip_existing', 'overwrite']);
export type ImportSecretsMode = z.infer<typeof importSecretsModeEnum>;

export const importSecretEntrySchema = z
    .object({
        key: z.string().regex(secretKeyRegex),
        value: z.string().max(4096),
    })
    .strict();
export type ImportSecretEntry = z.infer<typeof importSecretEntrySchema>;

export const importSecretsSchema = z
    .object({
        environment: projectEnvironmentEnum,
        mode: importSecretsModeEnum,
        entries: z.array(importSecretEntrySchema).min(1).max(100),
    })
    .strict()
    .refine(
        (data) => new Set(data.entries.map((entry) => entry.key)).size === data.entries.length,
        {
            message: 'Duplicate secret keys are not allowed in the same import batch',
            path: ['entries'],
        },
    );
export type ImportSecretsInput = z.infer<typeof importSecretsSchema>;

export const importSecretsResponseSchema = z.object({
    created: z.number().int().min(0),
    updated: z.number().int().min(0),
    skipped: z.number().int().min(0),
    total: z.number().int().min(0),
});
export type ImportSecretsResponse = z.infer<typeof importSecretsResponseSchema>;

export const exportSecretsSchema = z
    .object({
        environment: projectEnvironmentEnum,
        confirm: z.boolean().optional().default(false),
    })
    .strict();
export type ExportSecretsInput = z.infer<typeof exportSecretsSchema>;

export const exportSecretsResponseSchema = z.object({
    filename: z.string().min(1),
    content: z.string(),
    count: z.number().int().min(0),
});
export type ExportSecretsResponse = z.infer<typeof exportSecretsResponseSchema>;
