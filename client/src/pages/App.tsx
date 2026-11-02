import React from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../components/Toaster';
import { AppShell } from '../components/AppShell';
import { RequireAuth, PublicOnly } from '../components/Guards';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';
import ProjectsPage from './ProjectsPage';
import ProjectLayout from './ProjectLayout';
import SecretsPage from './SecretsPage';
import MembersPage from './MembersPage';
import ProjectAuditLogPage from './ProjectAuditLogPage';
import StatusPage from './StatusPage';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Route 1: redirect / -> /projects */}
              <Route path="/" element={<Navigate to="/projects" replace />} />

              {/* Public only routes */}
              <Route element={<PublicOnly />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
              </Route>

              {/* Protected routes */}
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:projectId" element={<ProjectLayout />}>
                    <Route index element={<Navigate to="secrets" replace />} />
                    <Route path="secrets" element={<SecretsPage />} />
                    <Route path="members" element={<MembersPage />} />
                    <Route path="audit-log" element={<ProjectAuditLogPage />} />
                  </Route>
                </Route>
              </Route>

              {/* Status routes */}
              <Route path="/unauthorized" element={<StatusPage variant="unauthorized" />} />
              <Route path="*" element={<StatusPage variant="not-found" />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
