import { z } from 'zod';
import { createProjectSchema, projectResponseSchema } from './project.js';

export const githubIdSchema = z.coerce.number().int().positive().safe();
export const githubPageQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const githubRepositoriesQuerySchema = githubPageQuerySchema.extend({
    installationId: githubIdSchema,
    search: z.string().trim().max(100).default(''),
});
export const githubStartInputSchema = z
    .object({ returnTo: z.enum(['projects', 'settings']) })
    .strict();
export const githubStatusSchema = z.object({
    enabled: z.boolean(),
    connected: z.boolean(),
    login: z.string().nullable(),
    manageUrl: z.string().url().nullable(),
});
export const githubInstallationSchema = z.object({
    id: githubIdSchema,
    account: z.string(),
    selection: z.enum(['all', 'selected']),
});
export const githubRepositorySchema = z.object({
    id: githubIdSchema,
    owner: z.string(),
    name: z.string(),
    description: z.string(),
    url: z.string().url(),
    private: z.boolean(),
});
export const githubInstallationsResponseSchema = z.object({
    data: z.array(githubInstallationSchema),
    page: z.number(),
    limit: z.number(),
    total: z.number().int().min(0),
});
export const githubRepositoriesResponseSchema = z.object({
    data: z.array(githubRepositorySchema),
    page: z.number(),
    limit: z.number(),
    total: z.number().int().min(0),
});
export const githubImportInputSchema = createProjectSchema
    .extend({
        installationId: githubIdSchema,
        repositoryId: githubIdSchema,
        seedExampleSecrets: z.boolean().default(true),
    })
    .strict();
export const githubImportResponseSchema = z.object({
    project: projectResponseSchema,
    created: z.boolean(),
    mockSecretsCreated: z.number().int().min(0).max(100).default(0),
});
export type GitHubRepository = z.infer<typeof githubRepositorySchema>;
export type GitHubImportInput = z.infer<typeof githubImportInputSchema>;
export type GitHubRepositoriesQuery = z.infer<typeof githubRepositoriesQuerySchema>;
