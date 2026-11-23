import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import * as github from '../api/github';
import { useToast } from '../components/Toaster';
import { isApiError } from '../lib/errorHandling';
import { useAuth } from './useAuth';

export function useGitHubConnection(returnTo: 'projects' | 'settings') {
    const { user } = useAuth();
    const { toast } = useToast();
    const client = useQueryClient();
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const shown = useRef(false);
    const status = useQuery({
        queryKey: ['github', 'connection'],
        queryFn: github.getGitHubConnection,
        enabled: Boolean(user),
    });
    useEffect(() => {
        const notice = params.get('github');
        if (!notice || shown.current) return;
        shown.current = true;
        if (notice === 'connected') toast.success('GitHub connected');
        else toast.error('Unable to connect GitHub. Try again.');
        const next = new URLSearchParams(params);
        next.delete('github');
        setParams(next, { replace: true, state: location.state });
    }, [params, setParams, location.state, toast]);
    const connect = useMutation({
        mutationFn: () => github.startGitHubConnection(returnTo),
        retry: 0,
        onSuccess: (url) => window.location.assign(url),
        onError: (error) =>
            toast.error(isApiError(error) ? error.message : 'Unable to connect GitHub'),
    });
    const disconnect = useMutation({
        mutationFn: github.disconnectGitHub,
        retry: 0,
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ['github'] });
            toast.success('GitHub disconnected');
        },
        onError: (error) =>
            toast.error(isApiError(error) ? error.message : 'Unable to disconnect GitHub'),
    });
    return { status, connect, disconnect };
}
