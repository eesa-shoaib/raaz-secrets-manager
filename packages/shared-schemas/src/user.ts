import { z } from 'zod';

export const projectRoleEnum = z.enum(['projectAdmin', 'developer', 'auditor']);
export type ProjectRole = z.infer<typeof projectRoleEnum>;
export const emailSchema = z.string().trim().email().max(255).toLowerCase();
export const passwordSchema = z.string().min(8).max(72);

export const usernameRegex = /^[a-z0-9_-]{3,30}$/;
export const usernameSchema = z
    .string()
    .trim()
    .toLowerCase()
    .regex(
        usernameRegex,
        'Username must be 3–30 characters of lowercase letters, numbers, underscores, or hyphens',
    );
export type Username = z.infer<typeof usernameSchema>;

export const signupSchema = z.object({ email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export const signupInputSchema = signupSchema;
export const loginInputSchema = loginSchema;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordInputSchema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required').max(72),
        newPassword: passwordSchema,
    })
    .strict()
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: 'New password must be different from current password',
        path: ['newPassword'],
    });
export const changePasswordSchema = changePasswordInputSchema;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const profileUpdateInputSchema = z
    .object({
        username: z
            .union([usernameSchema, z.literal(''), z.null()])
            .transform((val) => (val === '' || val === null ? null : val)),
    })
    .strict();
export const updateProfileSchema = profileUpdateInputSchema;
export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;

export const avatarContentTypeEnum = z.enum(['image/png', 'image/jpeg', 'image/webp']);
export type AvatarContentType = z.infer<typeof avatarContentTypeEnum>;

export const avatarUploadInputSchema = z
    .object({
        contentType: avatarContentTypeEnum,
        data: z
            .string()
            .min(1, 'Image data is required')
            .max(2_800_000, 'Image payload exceeds maximum size'),
    })
    .strict();
export type AvatarUploadInput = z.infer<typeof avatarUploadInputSchema>;

export const publicUserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    username: usernameSchema.nullable().optional().default(null),
    hasAvatar: z.boolean().optional().default(false),
    avatarUpdatedAt: z.string().or(z.date()).nullable().optional().default(null),
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

export const adminUsersQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).optional(),
        cursor: z.string().trim().min(1).max(512).optional(),
        mode: z.enum(['page', 'cursor']).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .refine((data) => !(data.page !== undefined && data.cursor !== undefined), {
        message: 'Cannot specify both page and cursor',
        path: ['cursor'],
    })
    .transform((data) => {
        const isCursorMode = data.mode === 'cursor' || data.cursor !== undefined;
        return {
            ...data,
            page: isCursorMode ? undefined : (data.page ?? 1),
            limit: data.limit ?? (isCursorMode ? 25 : 20),
            mode: isCursorMode ? ('cursor' as const) : ('page' as const),
        };
    });
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
