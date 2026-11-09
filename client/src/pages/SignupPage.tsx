import { zodResolver } from '@hookform/resolvers/zod';
import { signupInputSchema, type SignupInput } from '@raaz/shared-schemas';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import logo from '../assets/short-logo.svg';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isApiError } from '../lib/errorHandling';

export function SignupPage() {
    useDocumentTitle('Sign up');
    const { signup } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<SignupInput>({
        resolver: zodResolver(signupInputSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (data: SignupInput) => {
        setFormError(null);
        try {
            await signup(data);
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 409) {
                    setError('email', {
                        type: 'manual',
                        message: 'An account with this email already exists.',
                    });
                } else if (err.status === 422) {
                    setError('email', {
                        type: 'manual',
                        message: err.message || 'Invalid email or domain not allowed.',
                    });
                } else {
                    setFormError(err.message || 'Network error — try again');
                }
            } else {
                setFormError('Network error — try again');
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
                        Create an account
                    </h1>
                </div>

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

                    <FormField
                        label="Password"
                        hint="8–72 characters"
                        error={errors.password?.message}
                        required
                    >
                        {({ id, ...props }) => (
                            <div className="relative">
                                <input
                                    id={id}
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
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
                            'Create Account'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="text-center mt-5 border-t border-base-content/20 pt-4 text-sm text-base-content/70">
                    Already have an account?{' '}
                    <Link to="/login" className="link link-primary font-medium hover:underline">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;
