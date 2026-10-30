import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import type { PublicUser, LoginInput, SignupInput } from '@raaz/shared-schemas';
import { getMe, login as loginApi, logout as logoutApi, signup as signupApi } from '../api/auth';
import { subscribeToUnauthenticated } from '../api/axios';
import { queryClient, queryKeys } from '../lib/queryClient';

export interface AuthContextType {
  user: PublicUser | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  login: (data: LoginInput) => Promise<PublicUser>;
  signup: (data: SignupInput) => Promise<PublicUser>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: user = null,
    isLoading,
    isError,
    error,
    refetch: refetchUser,
  } = useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  // Handle 401 unauthenticated events across the app
  useEffect(() => {
    const unsubscribe = subscribeToUnauthenticated(() => {
      queryClient.clear();
      navigate('/login', {
        state: {
          reason: 'expired',
          from: location.pathname + location.search,
        },
      });
    });

    return unsubscribe;
  }, [navigate, location]);

  const loginMutation = useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data);
      const from = (location.state as { from?: string } | null)?.from || '/projects';
      navigate(from, { replace: true });
    },
  });

  const signupMutation = useMutation({
    mutationFn: signupApi,
    onSuccess: () => {
      navigate('/login', {
        state: { reason: 'signed-up' },
        replace: true,
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutApi,
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, null);
      navigate('/login', {
        state: { reason: 'logged-out' },
        replace: true,
      });
    },
  });

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isError,
      error,
      login: (data: LoginInput) => loginMutation.mutateAsync(data),
      signup: (data: SignupInput) => signupMutation.mutateAsync(data),
      logout: () => logoutMutation.mutateAsync(),
      refetchUser,
    }),
    [user, isLoading, isError, error, loginMutation, signupMutation, logoutMutation, refetchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
