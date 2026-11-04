import { z } from 'zod';
import { projectRoleEnum } from './user.js';

export const projectRoleSchema = projectRoleEnum;
export const projectEnvironmentEnum = z.enum(['development', 'staging', 'production']);
export type ProjectEnvironment = z.infer<typeof projectEnvironmentEnum>;
export const CANONICAL_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export const projectStatusEnum = z.enum(['active', 'archived']);
export type ProjectStatus = z.infer<typeof projectStatusEnum>;
export const createProjectSchema = z.object({ name: z.string().trim().min(1).max(100) });
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ProjectCreateInput = CreateProjectInput;
export const projectResponseSchema = z.object({
  id: z.string(), name: z.string(), environments: z.array(projectEnvironmentEnum),
  status: projectStatusEnum, createdBy: z.string(), role: projectRoleEnum.optional(),
  createdAt: z.string().or(z.date()), updatedAt: z.string().or(z.date()),
});
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type Project = ProjectResponse;
export const addMemberSchema = z.object({ email: z.string().trim().email().toLowerCase(), role: projectRoleEnum });
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export const updateMemberRoleSchema = z.object({ role: projectRoleEnum });
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export const memberResponseSchema = z.object({
  userId: z.string(), email: z.string().email(), role: projectRoleEnum,
  createdAt: z.string().or(z.date()),
});
export type MemberResponse = z.infer<typeof memberResponseSchema>;
