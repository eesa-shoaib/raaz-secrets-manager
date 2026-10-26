import { z } from 'zod';

export const secretResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  maskedValue: z.string().length(8),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export const secretCreateSchema = z.object({
  body: z.object({
    key: z.string().regex(/^[A-Z0-9_]{1,100}$/),
    environment: z.enum(['development', 'staging', 'production']),
    value: z.string(),
    confirm: z.boolean().default(false),
  }),
});
export type Secret = z.infer<typeof secretResponseSchema>;
export type SecretCreateInput = z.infer<typeof secretCreateSchema>;