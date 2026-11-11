import type {
    ChangePasswordInput,
    LoginInput,
    PublicUser,
    SignupInput,
} from '@raaz/shared-schemas';
import { isApiError } from '../lib/errorHandling';
import apiClient from './axios';

export async function getMe(): Promise<PublicUser | null> {
    try {
        const res = await apiClient.get<PublicUser | { user: PublicUser }>('/auth/me');
        const data = res.data as { user?: PublicUser } & PublicUser;
        return data.user ?? data;
    } catch (err) {
        if (isApiError(err) && err.status === 401) {
            return null;
        }
        throw err;
    }
}

export async function login(data: LoginInput): Promise<PublicUser> {
    const res = await apiClient.post<PublicUser | { user: PublicUser }>('/auth/login', data);
    const body = res.data as { user?: PublicUser } & PublicUser;
    return body.user ?? body;
}

export async function signup(data: SignupInput): Promise<PublicUser> {
    const res = await apiClient.post<PublicUser | { user: PublicUser }>('/auth/signup', data);
    const body = res.data as { user?: PublicUser } & PublicUser;
    return body.user ?? body;
}

export async function logout(): Promise<void> {
    await apiClient.post('/auth/logout');
}

export async function changePassword(data: ChangePasswordInput): Promise<void> {
    await apiClient.post('/auth/change-password', data);
}
