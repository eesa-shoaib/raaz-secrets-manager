import { zodResolver } from '@hookform/resolvers/zod';
import { loginInputSchema, type LoginInput } from '@raaz/shared-schemas';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/short-logo.svg';
import { FormField } from '../components/FormField';
import { useToast } from '../components/Toaster';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isApiError } from '../lib/errorHandling';

export function LoginPage() {
    useDocumentTitle('Sign in');
    const { login } = useAuth();
    const { toast } = useToast();
    const location = useLocation();
    const [showPassword, setShowPassword] = useState(false);
    const signedOutToastShown = useRef(false);

    const reason = (location.state as { reason?: string } | null)?.reason;

    useEffect(() => {
        if (reason === 'logged-out' && !signedOutToastShown.current) {
            signedOutToastShown.current = true;
            toast.info("You've been signed out.");
        }
    }, [reason, toast]);

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
        try {
            await login(data);
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 401) {
                    toast.error('Invalid email or password.', 4000);
                } else if (err.status === 429) {
                    toast.error('Too many attempts, try again in 15 minutes.', 4000);
                } else {
                    toast.error(err.message || 'Network error — try again', 4000);
                }
            } else {
                toast.error('Network error — try again', 4000);
            }
        }
    };

    return (
        <div className="min-h-screen flex items-start justify-center bg-base-100 px-5 py-6 sm:py-8 font-ui">
            <div className="w-full max-w-xs">
                {/* Header */}
                <div className="text-center mb-5">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-base-300">
                        <img
                            src={logo}
                            alt="Raaz"
                            width={405}
                            height={810}
                            className="h-9 w-auto object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-heading font-bold text-base-content tracking-tight">
                        Sign in to Raaz
                    </h1>
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
                {reason === 'signed-up' && (
                    <div
                        role="status"
                        className="alert alert-success text-sm rounded-xl py-2.5 px-4 mb-4 text-base-300"
                    >
                        <span>Account created. Sign in to continue.</span>
                    </div>
                )}
                {reason === 'password-changed' && (
                    <div
                        role="status"
                        className="alert alert-info text-sm rounded-xl py-2.5 px-4 mb-4"
                    >
                        <span>Password updated. Sign in with your new password.</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
                    <FormField label="Email address" error={errors.email?.message} required>
                        {({ id, ...props }) => (
                            <input
                                id={id}
                                type="email"
                                autoComplete="username"
                                placeholder="developer@example.com"
                                className={`input input-sm h-10 input-bordered w-full bg-base-300 rounded-md focus:border-primary focus:outline-primary text-sm font-ui ${
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
                                    className={`input input-sm h-10 input-bordered w-full bg-base-300 rounded-md focus:border-primary focus:outline-primary text-sm pr-10 font-ui ${
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
                        className="btn btn-sm h-10 btn-primary w-full text-base-300 font-medium rounded-md mt-2 hover:opacity-90 transition-opacity"
                    >
                        {isSubmitting ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="text-center mt-5 border-t border-base-content/20 pt-4 text-sm text-base-content/70">
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
