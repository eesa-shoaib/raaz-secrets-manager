import {
    oauthProvidersResponseSchema,
    oauthStartResponseSchema,
    type OAuthProvider,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export async function getOAuthProviders() {
    const response = await apiClient.get('/auth/oauth/providers');
    return oauthProvidersResponseSchema.parse(response.data).providers;
}
export async function startOAuth(provider: OAuthProvider, deactivate = false) {
    const response = await apiClient.post(
        `/auth/oauth/${provider}/${deactivate ? 'deactivate/start' : 'start'}`,
        {},
    );
    return oauthStartResponseSchema.parse(response.data).authorizationUrl;
}
