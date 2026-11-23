import type { CustomFetch } from 'openid-client';
export const githubOAuthFetch: CustomFetch = async (url, options) => {
    const response = await fetch(url, options as RequestInit);
    if (String(url) === 'https://github.com/login/oauth/access_token' && response.status === 200) {
        const body: unknown = await response
            .clone()
            .json()
            .catch(() => null);
        if (
            body &&
            typeof body === 'object' &&
            'error' in body &&
            typeof body.error === 'string' &&
            body.error
        )
            return Response.json(body, { status: 400 });
    }
    return response;
};
