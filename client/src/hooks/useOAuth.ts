import type { OAuthProvider } from '@raaz/shared-schemas';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOAuthProviders, startOAuth } from '../api/oauth';
import { useToast } from '../components/Toaster';
import { isApiError } from '../lib/errorHandling';

export function useOAuth(showProviders = true) {
    const { toast } = useToast();
    const [params, setParams] = useSearchParams();
    const noticeShown = useRef(false);
    useEffect(() => {
        const outcome = params.get('oauth');
        if (!outcome || noticeShown.current) return;
        noticeShown.current = true;
        if (outcome === 'failed')
            toast.error(
                'Unable to continue with that provider. Try again or use your original sign-in method.',
                4000,
            );
        if (outcome === 'last-admin')
            toast.error('Cannot deactivate the last active Platform Admin.', 4000);
        if (outcome === 'deactivated') toast.info('Your account has been deactivated.');
        const clean = new URLSearchParams(params);
        clean.delete('oauth');
        setParams(clean, { replace: true });
    }, [params, setParams, toast]);
    const providers = useQuery({
        queryKey: ['auth', 'oauthProviders'],
        queryFn: getOAuthProviders,
        enabled: showProviders,
    });
    const mutation = useMutation({
        retry: 0,
        mutationFn: ({ provider, deactivate }: { provider: OAuthProvider; deactivate?: boolean }) =>
            startOAuth(provider, deactivate),
        onSuccess: (url) => {
            window.location.assign(url);
        },
        onError: (error) => {
            toast.error(
                isApiError(error)
                    ? error.message
                    : 'Unable to contact the sign-in provider. Try again.',
                4000,
            );
        },
    });
    return {
        providers: providers.data ?? [],
        continueWith: (provider: OAuthProvider, deactivate = false) =>
            mutation.mutate({ provider, deactivate }),
        pending: mutation.isPending,
        pendingProvider: mutation.variables?.provider,
    };
}
