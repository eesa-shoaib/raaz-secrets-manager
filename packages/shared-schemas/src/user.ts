import { z } from 'zod';

export const projectRoleEnum = z.enum(['projectAdmin', 'developer', 'auditor']);
export type ProjectRole = z.infer<typeof projectRoleEnum>;
export const emailSchema = z.string().trim().email().max(255).toLowerCase();
export const passwordSchema = z.string().min(8).max(72);
export const signupSchema = z.object({ email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const signupInputSchema = signupSchema;
export const loginInputSchema = loginSchema;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export const publicUserSchema = z.object({
  id: z.string(), email: z.string().email(), isPlatformAdmin: z.boolean(),
  isActive: z.boolean(), createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).optional(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;
export const updateUserSchema = z.object({ isActive: z.boolean().optional(), isPlatformAdmin: z.boolean().optional() });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
