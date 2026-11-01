import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FullPageState } from './FullPageState';

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { user, isLoading, isError, refetchUser } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageState variant="loading" />;
  }

  if (isError && !user) {
    return <FullPageState variant="error" onRetry={() => refetchUser()} />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

export function PublicOnly({ children }: { children?: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullPageState variant="loading" />;
  }

  if (user) {
    const from = (location.state as { from?: string } | null)?.from || '/projects';
    return <Navigate to={from} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
