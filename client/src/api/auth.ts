import type { LoginInput, PublicUser, SignupInput } from '@raaz/shared-schemas';
import { isApiError } from '../lib/errorHandling';
import apiClient from './axios';

export async function getMe(): Promise<PublicUser | null> {
    try {
        const res = await apiClient.get<{ user: PublicUser }>('/auth/me');
        return res.data.user;
    } catch (err) {
        if (isApiError(err) && err.status === 401) {
            return null;
        }
        throw err;
    }
}

export async function login(data: LoginInput): Promise<PublicUser> {
    const res = await apiClient.post<{ user: PublicUser }>('/auth/login', data);
    return res.data.user;
}

export async function signup(data: SignupInput): Promise<PublicUser> {
    const res = await apiClient.post<{ user: PublicUser }>('/auth/signup', data);
    return res.data.user;
}

export async function logout(): Promise<void> {
    await apiClient.post('/auth/logout');
}
