import { zodResolver } from '@hookform/resolvers/zod';
import { loginInputSchema, type LoginInput } from '@raaz/shared-schemas';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { isApiError } from '../lib/errorHandling';

export function LoginPage() {
    const { login } = useAuth();
    const location = useLocation();
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const reason = (location.state as { reason?: string } | null)?.reason;

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginInputSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (data: LoginInput) => {
        setFormError(null);
        try {
            await login(data);
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 401) {
                    setFormError('Invalid email or password.');
                } else if (err.status === 429) {
                    setFormError('Too many attempts, try again in 15 minutes.');
                } else {
                    setFormError(err.message || 'Network error — try again');
                }
            } else {
                setFormError('Network error — try again');
            }
        }
    };

    return (
        <div className="page-gutter min-h-screen flex items-center justify-center bg-base-100 py-8 font-ui">
            <div className="card w-full max-w-md bg-base-200 border border-base-300 shadow-2xl p-8 rounded-3xl">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/20 text-primary font-mono font-black text-2xl border border-primary/30 mb-3">
                        R
                    </div>
                    <h1 className="text-2xl font-heading font-bold text-base-content tracking-tight">
                        Sign in to Raaz
                    </h1>
                    <p className="text-sm text-base-content/70 mt-1">
                        Zero-knowledge secrets manager for teams
                    </p>
                </div>

                {/* Notices */}
                {reason === 'expired' && (
                    <div
                        role="status"
                        className="alert alert-warning text-sm rounded-xl py-2.5 px-4 mb-4"
                    >
                        <span>Your session has ended. Please sign in again.</span>
                    </div>
                )}
                {reason === 'logged-out' && (
                    <div
                        role="status"
                        className="alert alert-info text-sm rounded-xl py-2.5 px-4 mb-4"
                    >
                        <span>You&apos;ve been signed out.</span>
                    </div>
                )}
                {reason === 'signed-up' && (
                    <div
                        role="status"
                        className="alert alert-success text-sm rounded-xl py-2.5 px-4 mb-4 text-base-300"
                    >
                        <span>Account created. Sign in to continue.</span>
                    </div>
                )}

                {/* Error banner */}
                {formError && (
                    <div
                        role="alert"
                        className="alert alert-error text-sm rounded-xl py-2.5 px-4 mb-4 text-base-100 font-medium"
                    >
                        <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 1118 0z"
                            />
                        </svg>
                        <span>{formError}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <FormField label="Email address" error={errors.email?.message} required>
                        {({ id, ...props }) => (
                            <input
                                id={id}
                                type="email"
                                autoComplete="username"
                                placeholder="developer@example.com"
                                className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-ui ${
                                    errors.email ? 'input-error' : ''
                                }`}
                                {...register('email')}
                                {...props}
                            />
                        )}
                    </FormField>

                    <FormField label="Password" error={errors.password?.message} required>
                        {({ id, ...props }) => (
                            <div className="relative">
                                <input
                                    id={id}
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    placeholder="••••••••••••"
                                    className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm pr-10 font-ui ${
                                        errors.password ? 'input-error' : ''
                                    }`}
                                    {...register('password')}
                                    {...props}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/60 hover:text-base-content text-xs font-medium"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        )}
                    </FormField>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary w-full text-base-300 font-semibold rounded-xl mt-2 hover:opacity-90 transition-opacity"
                    >
                        {isSubmitting ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="text-center mt-6 text-sm text-base-content/70">
                    Don&apos;t have an account?{' '}
                    <Link to="/signup" className="link link-primary font-medium hover:underline">
                        Create account
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
