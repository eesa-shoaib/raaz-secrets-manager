import axios, { AxiosError } from 'axios';
import { normalizeError } from '../lib/errorHandling';

export const apiClient = axios.create({
    baseURL: '/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

type UnauthenticatedCallback = () => void;
const unauthenticatedListeners = new Set<UnauthenticatedCallback>();

let isNotifying = false;

export function subscribeToUnauthenticated(cb: UnauthenticatedCallback): () => void {
    unauthenticatedListeners.add(cb);
    return () => {
        unauthenticatedListeners.delete(cb);
    };
}

export function notifyUnauthenticated(): void {
    if (isNotifying) return;
    isNotifying = true;

    unauthenticatedListeners.forEach((callback) => {
        try {
            callback();
        } catch {
            // Ignore callback errors during unauthenticated notification
        }
    });

    setTimeout(() => {
        isNotifying = false;
    }, 500);
}

apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const apiError = normalizeError(error);
        const url = error.config?.url || '';

        // Ignore 401 for login, initial /auth/me, and password verification on /auth/change-password
        const isLogin = url.includes('/auth/login');
        const isMe = url.includes('/auth/me');
        const isChangePassword = url.includes('/auth/change-password');

        if (apiError.status === 401 && !isLogin && !isMe && !isChangePassword) {
            notifyUnauthenticated();
        }

        return Promise.reject(apiError);
    },
);

export default apiClient;
