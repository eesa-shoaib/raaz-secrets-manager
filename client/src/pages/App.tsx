import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { RequireAuth, PublicOnly, RequirePlatformAdmin } from '../components/Guards';
import { ToastProvider } from '../components/Toaster';
import { AuthProvider } from '../context/AuthContext';
import { queryClient } from '../lib/queryClient';
import AdminUsersPage from './AdminUsersPage';
import LoginPage from './LoginPage';
import MembersPage from './MembersPage';
import ProjectAuditLogPage from './ProjectAuditLogPage';
import ProjectLayout from './ProjectLayout';
import ProjectsPage from './ProjectsPage';
import SecretsPage from './SecretsPage';
import SettingsPage from './SettingsPage';
import SignupPage from './SignupPage';
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
                                    <Route path="/settings" element={<SettingsPage />} />
                                    <Route element={<RequirePlatformAdmin />}>
                                        <Route path="/admin/users" element={<AdminUsersPage />} />
                                    </Route>
                                    <Route path="/projects/:projectId" element={<ProjectLayout />}>
                                        <Route index element={<Navigate to="secrets" replace />} />
                                        <Route path="secrets" element={<SecretsPage />} />
                                        <Route path="members" element={<MembersPage />} />
                                        <Route path="audit-log" element={<ProjectAuditLogPage />} />
                                    </Route>
                                </Route>
                            </Route>

                            {/* Status routes */}
                            <Route
                                path="/unauthorized"
                                element={<StatusPage variant="unauthorized" />}
                            />
                            <Route path="*" element={<StatusPage variant="not-found" />} />
                        </Routes>
                    </ToastProvider>
                </AuthProvider>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
