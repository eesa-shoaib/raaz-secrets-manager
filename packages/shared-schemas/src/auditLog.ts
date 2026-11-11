import { z } from 'zod';
import { projectEnvironmentEnum } from './project.js';
import { projectRoleEnum, usernameSchema } from './user.js';

export const projectScopedAuditActionEnum = z.enum([
    'reveal',
    'create',
    'edit',
    'delete',
    'member_added',
    'member_role_changed',
    'member_removed',
    'project_created',
    'project_renamed',
    'project_updated',
    'project_environments_changed',
    'project_archived',
    'project_restored',
]);
export type ProjectScopedAuditAction = z.infer<typeof projectScopedAuditActionEnum>;

export const platformAuditActionEnum = z.enum([
    'user_activated',
    'user_deactivated',
    'platform_admin_granted',
    'platform_admin_revoked',
    'bootstrap_admin',
    'password_changed',
    'profile_updated',
    'avatar_updated',
    'avatar_removed',
]);
export type PlatformAuditAction = z.infer<typeof platformAuditActionEnum>;

export const auditActionEnum = z.enum([
    'reveal',
    'create',
    'edit',
    'delete',
    'member_added',
    'member_role_changed',
    'member_removed',
    'project_created',
    'project_renamed',
    'project_updated',
    'project_environments_changed',
    'project_archived',
    'project_restored',
    'user_activated',
    'user_deactivated',
    'platform_admin_granted',
    'platform_admin_revoked',
    'bootstrap_admin',
    'password_changed',
    'profile_updated',
    'avatar_updated',
    'avatar_removed',
]);
export type AuditAction = z.infer<typeof auditActionEnum>;

export const auditResultEnum = z.enum(['allowed', 'denied']);
export type AuditResult = z.infer<typeof auditResultEnum>;

export const auditLogQuerySchema = z.object({
    action: auditActionEnum.optional(),
    result: auditResultEnum.optional(),
    environment: projectEnvironmentEnum.optional(),
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
    mode: z.enum(['cursor']).optional(),
    page: z.never({ message: 'Audit log does not support page pagination' }).optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const adminAuditLogQuerySchema = z.object({
    action: platformAuditActionEnum.optional(),
    result: auditResultEnum.optional(),
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
    mode: z.enum(['cursor']).optional(),
    page: z.never({ message: 'Audit log does not support page pagination' }).optional(),
});
export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;

export const auditLogActorSchema = z
    .object({
        id: z.string(),
        email: z.string().email(),
        username: usernameSchema.nullable().optional().default(null),
        hasAvatar: z.boolean().optional().default(false),
        avatarUpdatedAt: z.string().or(z.date()).nullable().optional().default(null),
    })
    .nullable();
export type AuditLogActor = z.infer<typeof auditLogActorSchema>;

export const auditLogEntrySchema = z.object({
    id: z.string(),
    action: auditActionEnum,
    result: auditResultEnum,
    createdAt: z.string().or(z.date()),
    user: auditLogActorSchema,
    targetUser: auditLogActorSchema.optional(),
    secretKey: z.string().optional(),
    environment: z.string().optional(),
    previousRole: projectRoleEnum.optional(),
    newRole: projectRoleEnum.optional(),
});
export type AuditLogEntryResponse = z.infer<typeof auditLogEntrySchema>;
