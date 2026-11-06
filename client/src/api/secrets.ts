import type {
    CreateSecretInput,
    EditSecretInput,
    RevealSecretResponse,
    SecretResponse,
} from '@raaz/shared-schemas';
import type { Environment } from '../lib/permissions';
import apiClient from './axios';

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
