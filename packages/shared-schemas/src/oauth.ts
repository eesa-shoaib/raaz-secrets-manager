import { z } from 'zod';

export const oauthProviderSchema = z.enum(['google', 'github']);
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
export const oauthProvidersResponseSchema = z.object({ providers: z.array(oauthProviderSchema) });
export const oauthStartResponseSchema = z.object({ authorizationUrl: z.string().url() });
export const oauthStartRequestSchema = z.object({
    params: z.object({ provider: oauthProviderSchema }),
    body: z.object({}).strict(),
});
export const oauthCallbackRequestSchema = z.object({
    params: z.object({ provider: oauthProviderSchema }),
    query: z.object({
        state: z.string().min(1).max(256),
        code: z.string().min(1).max(4096).optional(),
        error: z.string().max(256).optional(),
        // Providers may append fields; only these three are consumed.
    }),
});
