import { z } from 'zod';
import { projectRoleEnum, usernameSchema } from './user.js';

export const projectRoleSchema = projectRoleEnum;
export const projectEnvironmentEnum = z.enum(['development', 'staging', 'production']);
export type ProjectEnvironment = z.infer<typeof projectEnvironmentEnum>;
export const CANONICAL_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export const projectStatusEnum = z.enum(['active', 'archived']);
export type ProjectStatus = z.infer<typeof projectStatusEnum>;

export const projectDescriptionSchema = z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or fewer');

export const createProjectSchema = z
    .object({
        name: z.string().trim().min(1).max(100),
        description: projectDescriptionSchema.optional().default(''),
    })
    .strict();
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ProjectCreateInput = CreateProjectInput;

export const updateProjectSchema = z
    .object({
        name: z.string().trim().min(1).max(100).optional(),
        description: projectDescriptionSchema.optional(),
    })
    .strict()
    .refine((data) => data.name !== undefined || data.description !== undefined, {
        message: 'At least one of name or description must be provided',
    });
export const projectUpdateInputSchema = updateProjectSchema;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().max(500).optional().default(''),
    environments: z.array(projectEnvironmentEnum),
    status: projectStatusEnum,
    createdBy: z.string(),
    role: projectRoleEnum.optional(),
    memberCount: z.number().int().min(0).optional(),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
});
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type Project = ProjectResponse;

export const projectsListQuerySchema = z.object({
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(100).optional(),
    mode: z.enum(['cursor']).optional(),
    page: z.never({ message: 'Offset page parameter is not supported' }).optional(),
});
export type ProjectsListQuery = z.infer<typeof projectsListQuerySchema>;

export const addMemberSchema = z.object({
    email: z.string().trim().email().toLowerCase(),
    role: projectRoleEnum,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export const updateMemberRoleSchema = z.object({ role: projectRoleEnum });
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const memberResponseSchema = z.object({
    userId: z.string(),
    email: z.string().email(),
    username: usernameSchema.nullable().optional().default(null),
    hasAvatar: z.boolean().optional().default(false),
    avatarUpdatedAt: z.string().or(z.date()).nullable().optional().default(null),
    role: projectRoleEnum,
    createdAt: z.string().or(z.date()),
});
export type MemberResponse = z.infer<typeof memberResponseSchema>;

export const projectMembersQuerySchema = z.object({
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    mode: z.enum(['cursor']).optional(),
    page: z.never({ message: 'Offset page parameter is not supported' }).optional(),
});
export type ProjectMembersQuery = z.infer<typeof projectMembersQuerySchema>;
