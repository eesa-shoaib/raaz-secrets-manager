import {
    githubImportResponseSchema,
    githubInstallationsResponseSchema,
    githubRepositoriesResponseSchema,
    githubStatusSchema,
    oauthStartResponseSchema,
    type GitHubImportInput,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export async function getGitHubConnection() {
    return githubStatusSchema.parse((await apiClient.get('/integrations/github')).data);
}
export async function startGitHubConnection(returnTo: 'projects' | 'settings') {
    return oauthStartResponseSchema.parse(
        (await apiClient.post('/integrations/github/start', { returnTo })).data,
    ).authorizationUrl;
}
export async function disconnectGitHub() {
    await apiClient.delete('/integrations/github');
}
export async function getGitHubInstallations(page: number) {
    return githubInstallationsResponseSchema.parse(
        (await apiClient.get('/integrations/github/installations', { params: { page, limit: 25 } }))
            .data,
    );
}
export async function getGitHubRepositories(installationId: number, page: number, search: string) {
    return githubRepositoriesResponseSchema.parse(
        (
            await apiClient.get('/integrations/github/repositories', {
                params: { installationId, page, search, limit: 10 },
            })
        ).data,
    );
}
export async function importGitHubRepository(input: GitHubImportInput) {
    return githubImportResponseSchema.parse(
        (await apiClient.post('/integrations/github/import', input)).data,
    );
}
