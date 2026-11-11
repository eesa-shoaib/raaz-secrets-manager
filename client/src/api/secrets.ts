import type {
    CreateSecretInput,
    CursorPaginatedResponse,
    EditSecretInput,
    RevealSecretResponse,
    SecretResponse,
} from '@raaz/shared-schemas';
import type { Environment } from '../lib/permissions';
import apiClient from './axios';

export interface SecretsPageParams {
    cursor?: string | null;
    limit?: number;
    search?: string;
}

export async function getSecrets(
    projectId: string,
    environment: Environment,
): Promise<SecretResponse[]> {
    const res = await apiClient.get<SecretResponse[] | { secrets: SecretResponse[] }>(
        `/projects/${projectId}/secrets`,
        {
            params: { environment },
        },
    );
    const data = res.data;
    if (Array.isArray(data)) return data;
    return (data as { secrets?: SecretResponse[] }).secrets ?? [];
}

export async function getSecretsPage(
    projectId: string,
    environment: Environment,
    params: SecretsPageParams = {},
): Promise<CursorPaginatedResponse<SecretResponse>> {
    const query: Record<string, unknown> = {
        environment,
        mode: 'cursor',
        limit: params.limit ?? 25,
    };
    if (params.cursor) query.cursor = params.cursor;
    if (params.search && params.search.trim()) query.search = params.search.trim();

    const res = await apiClient.get<CursorPaginatedResponse<SecretResponse>>(
        `/projects/${projectId}/secrets`,
        { params: query },
    );
    return res.data;
}

export async function createSecret(
    projectId: string,
    data: CreateSecretInput,
): Promise<SecretResponse> {
    const res = await apiClient.post<SecretResponse | { secret: SecretResponse }>(
        `/projects/${projectId}/secrets`,
        data,
    );
    const body = res.data as { secret?: SecretResponse } & SecretResponse;
    return body.secret ?? body;
}

export async function editSecret(
    projectId: string,
    secretId: string,
    data: EditSecretInput,
): Promise<SecretResponse> {
    const res = await apiClient.patch<SecretResponse | { secret: SecretResponse }>(
        `/projects/${projectId}/secrets/${secretId}`,
        data,
    );
    const body = res.data as { secret?: SecretResponse } & SecretResponse;
    return body.secret ?? body;
}

export async function deleteSecret(projectId: string, secretId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/secrets/${secretId}`);
}

export async function revealSecret(
    projectId: string,
    secretId: string,
    confirm = false,
): Promise<RevealSecretResponse> {
    const res = await apiClient.post<RevealSecretResponse>(
        `/projects/${projectId}/secrets/${secretId}/reveal`,
        { confirm },
    );
    return res.data;
}
