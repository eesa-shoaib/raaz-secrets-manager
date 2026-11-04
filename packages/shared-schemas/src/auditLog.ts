import { z } from 'zod';
import { projectEnvironmentEnum } from './project.js';
import { projectRoleEnum } from './user.js';

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
  'project_environments_changed',
  'project_archived',
  'project_restored',
  'user_activated',
  'user_deactivated',
  'platform_admin_granted',
  'platform_admin_revoked',
  'bootstrap_admin',
]);
export type AuditAction = z.infer<typeof auditActionEnum>;

export const auditResultEnum = z.enum(['allowed', 'denied']);
export type AuditResult = z.infer<typeof auditResultEnum>;

export const auditLogQuerySchema = z.object({
  action: auditActionEnum.optional(),
  result: auditResultEnum.optional(),
  environment: projectEnvironmentEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100).optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const auditLogActorSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
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
