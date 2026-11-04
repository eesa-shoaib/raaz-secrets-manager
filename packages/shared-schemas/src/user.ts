import { z } from 'zod';

export const projectRoleEnum = z.enum(['projectAdmin', 'developer', 'auditor']);
export type ProjectRole = z.infer<typeof projectRoleEnum>;

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .max(255)
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters'),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  isPlatformAdmin: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()).optional(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  isPlatformAdmin: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
