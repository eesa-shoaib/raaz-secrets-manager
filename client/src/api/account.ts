import type {
    AvatarUploadInput,
    DeactivateAccountInput,
    ProfileUpdateInput,
    PublicUser,
} from '@raaz/shared-schemas';
import apiClient from './axios';

export async function updateProfile(data: ProfileUpdateInput): Promise<PublicUser> {
    const res = await apiClient.patch<PublicUser | { user: PublicUser }>('/account/profile', data);
    const body = res.data as { user?: PublicUser } & PublicUser;
    return body.user ?? body;
}

export async function uploadAvatarFile(file: Blob | File): Promise<PublicUser> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || 'image/png';
    const res = await apiClient.put<PublicUser | { user: PublicUser }>('/account/avatar', bytes, {
        headers: {
            'Content-Type': contentType,
        },
    });
    const body = res.data as { user?: PublicUser } & PublicUser;
    return body.user ?? body;
}

export async function uploadAvatarBase64(data: AvatarUploadInput): Promise<PublicUser> {
    const res = await apiClient.put<PublicUser | { user: PublicUser }>('/account/avatar', data);
    const body = res.data as { user?: PublicUser } & PublicUser;
    return body.user ?? body;
}

export async function deleteAvatar(): Promise<PublicUser> {
    const res = await apiClient.delete<PublicUser | { user: PublicUser }>('/account/avatar');
    const body = res.data as { user?: PublicUser } & PublicUser;
    return body.user ?? body;
}

export async function deactivateAccount(data: DeactivateAccountInput): Promise<void> {
    await apiClient.post('/account/deactivate', data);
}

export function getUserAvatarUrl(userId: string, avatarUpdatedAt?: string | Date | null): string {
    const base = `/api/users/${encodeURIComponent(userId)}/avatar`;
    if (!avatarUpdatedAt) return base;
    const stamp =
        avatarUpdatedAt instanceof Date
            ? avatarUpdatedAt.toISOString()
            : new Date(avatarUpdatedAt).toISOString();
    return `${base}?v=${encodeURIComponent(stamp)}`;
}
