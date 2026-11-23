import { zodResolver } from '@hookform/resolvers/zod';
import {
    deactivateAccountInputSchema,
    passwordSchema,
    profileUpdateInputSchema,
    type DeactivateAccountInput,
    type ProfileUpdateInput,
} from '@raaz/shared-schemas';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toaster';
import { UserAvatar } from '../components/UserAvatar';
import {
    useChangePassword,
    useDeactivateAccount,
    useDeleteAvatar,
    useUpdateProfile,
    useUploadAvatar,
} from '../hooks/useAccount';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useOAuth } from '../hooks/useOAuth';
import { useTheme } from '../hooks/useTheme';
import { isApiError } from '../lib/errorHandling';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const passwordModalFormSchema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required').max(72),
        newPassword: passwordSchema,
        confirmNewPassword: z.string().min(1, 'Please confirm your new password').max(72),
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: 'New password must be different from current password',
        path: ['newPassword'],
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
        message: 'New passwords do not match',
        path: ['confirmNewPassword'],
    });

type PasswordModalFormValues = z.infer<typeof passwordModalFormSchema>;

export function SettingsPage() {
    const oauth = useOAuth(false);
    useDocumentTitle('Account Settings');
    const { user } = useAuth();
    const { toast } = useToast();
    const { theme, setTheme, themes } = useTheme();

    const updateProfileMutation = useUpdateProfile();
    const uploadAvatarMutation = useUploadAvatar();
    const deleteAvatarMutation = useDeleteAvatar();
    const changePasswordMutation = useChangePassword();
    const deactivateAccountMutation = useDeactivateAccount();

    const [section, setSection] = useState<'profile' | 'appearance' | 'account'>('profile');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
    const [deactivateError, setDeactivateError] = useState<string | null>(null);

    const {
        register: registerProfile,
        handleSubmit: handleSubmitProfile,
        reset: resetProfile,
        setError: setProfileFieldError,
        formState: { errors: profileErrors, isSubmitting: isSavingProfile },
    } = useForm<ProfileUpdateInput>({
        resolver: zodResolver(profileUpdateInputSchema),
        defaultValues: {
            username: user?.username ?? '',
        },
    });

    useEffect(() => {
        resetProfile({ username: user?.username ?? '' });
    }, [user?.username, resetProfile]);

    const {
        register: registerPassword,
        handleSubmit: handleSubmitPassword,
        reset: resetPassword,
        formState: { errors: passwordErrors, isSubmitting: isChangingPassword },
    } = useForm<PasswordModalFormValues>({
        resolver: zodResolver(passwordModalFormSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: '',
        },
    });

    const {
        register: registerDeactivate,
        handleSubmit: handleSubmitDeactivate,
        reset: resetDeactivate,
        formState: { errors: deactivateErrors, isSubmitting: isDeactivating },
    } = useForm<DeactivateAccountInput>({
        resolver: zodResolver(deactivateAccountInputSchema),
        defaultValues: {
            currentPassword: '',
        },
    });

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        setAvatarError(null);
        const file = event.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            setAvatarError('Unsupported image format. Choose a PNG, JPEG, or WebP file.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            setAvatarError('Image file exceeds the 2 MiB upload limit.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        try {
            await uploadAvatarMutation.mutateAsync(file);
            toast.success('Profile picture updated');
        } catch (err: unknown) {
            if (isApiError(err)) {
                setAvatarError(err.message || 'Failed to upload profile picture');
            } else {
                setAvatarError('Failed to upload profile picture');
            }
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveAvatar = async () => {
        setAvatarError(null);
        try {
            await deleteAvatarMutation.mutateAsync();
            toast.success('Profile picture removed');
        } catch (err: unknown) {
            if (isApiError(err)) {
                setAvatarError(err.message || 'Failed to remove profile picture');
            } else {
                setAvatarError('Failed to remove profile picture');
            }
        }
    };

    const onProfileSubmit = async (data: ProfileUpdateInput) => {
        setProfileError(null);
        try {
            await updateProfileMutation.mutateAsync(data);
            toast.success('Profile updated');
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 409) {
                    setProfileFieldError('username', {
                        type: 'server',
                        message: err.message || 'That username is already taken.',
                    });
                } else {
                    setProfileError(err.message || 'Failed to update profile');
                }
            } else {
                setProfileError('Something went wrong — profile was not updated.');
            }
        }
    };

    const handleOpenPasswordModal = () => {
        setPasswordError(null);
        resetPassword({
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: '',
        });
        setIsPasswordModalOpen(true);
    };

    const handleClosePasswordModal = () => {
        if (changePasswordMutation.isPending || isChangingPassword) return;
        setIsPasswordModalOpen(false);
        setPasswordError(null);
        resetPassword({
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: '',
        });
    };

    const onPasswordSubmit = async (data: PasswordModalFormValues) => {
        setPasswordError(null);
        try {
            await changePasswordMutation.mutateAsync({
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            });
            setIsPasswordModalOpen(false);
            resetPassword({
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: '',
            });
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 401) {
                    setPasswordError('Current password is incorrect.');
                } else if (err.status === 429) {
                    setPasswordError('Too many attempts, try again in 15 minutes.');
                } else {
                    setPasswordError(err.message || 'Failed to update password');
                }
            } else {
                setPasswordError('Something went wrong — password was not changed.');
            }
        }
    };

    const handleOpenDeactivate = () => {
        setDeactivateError(null);
        resetDeactivate({ currentPassword: '' });
        setIsDeactivateOpen(true);
    };

    const handleCloseDeactivate = () => {
        if (deactivateAccountMutation.isPending || isDeactivating) return;
        setIsDeactivateOpen(false);
        setDeactivateError(null);
        resetDeactivate({ currentPassword: '' });
    };

    const onDeactivateSubmit = async (data: DeactivateAccountInput) => {
        setDeactivateError(null);
        try {
            await deactivateAccountMutation.mutateAsync(data);
            setIsDeactivateOpen(false);
            resetDeactivate({ currentPassword: '' });
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 401) {
                    setDeactivateError('Current password is incorrect.');
                } else if (err.status === 409) {
                    setDeactivateError(
                        err.message || 'Cannot deactivate the last active Platform Admin.',
                    );
                } else {
                    setDeactivateError(err.message || 'Failed to deactivate account.');
                }
            } else {
                setDeactivateError('Something went wrong — your account was not deactivated.');
            }
        }
    };

    if (!user) return null;

    const isAvatarBusy = uploadAvatarMutation.isPending || deleteAvatarMutation.isPending;

    return (
        <div className="mx-auto max-w-6xl">
            <h1 className="mb-6 font-heading text-2xl font-bold text-base-content">
                Account settings
            </h1>

            <div className="grid items-start gap-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8">
                <nav
                    aria-label="Settings sections"
                    className="flex flex-wrap gap-2 rounded-3xl border border-base-300 bg-base-200 p-4 shadow-sm sm:p-6 md:flex-col md:flex-nowrap"
                >
                    {(
                        [
                            {
                                id: 'profile',
                                label: 'Profile',
                                path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
                            },
                            {
                                id: 'appearance',
                                label: 'Appearance',
                                path: 'm15 4 5 5M4 20l4-1 13-13a2.1 2.1 0 0 0-3-3L5 16l-1 4Z',
                            },
                            {
                                id: 'account',
                                label: 'Account',
                                path: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
                            },
                        ] as const
                    ).map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSection(item.id)}
                            aria-current={section === item.id ? 'page' : undefined}
                            aria-controls="settings-content"
                            className={`flex items-center justify-center gap-1.5 rounded-lg border border-transparent px-2 py-2 text-xs font-ui transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:gap-2 sm:px-3 sm:text-sm md:justify-start ${section === item.id ? 'button-textured bg-base-300 font-semibold text-base-content' : 'text-base-content/80 hover:bg-base-300/60 hover:text-base-content'}`}
                        >
                            <svg
                                aria-hidden="true"
                                className="hidden h-4 w-4 shrink-0 sm:block"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d={item.path} />
                            </svg>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <section
                    id="settings-content"
                    aria-labelledby="settings-section-heading"
                    className="min-w-0"
                >
                    <h2
                        id="settings-section-heading"
                        className="mb-5 border-b border-base-300 pb-3 font-heading text-xl font-semibold text-base-content"
                    >
                        {section === 'profile'
                            ? 'Profile'
                            : section === 'appearance'
                              ? 'Appearance'
                              : 'Account'}
                    </h2>

                    {section === 'profile' && (
                        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_10rem]">
                            <form
                                onSubmit={handleSubmitProfile(onProfileSubmit)}
                                className="max-w-md space-y-4"
                            >
                                <div>
                                    <label
                                        htmlFor="settings-username"
                                        className="mb-1.5 block text-sm font-medium text-base-content"
                                    >
                                        Username
                                    </label>
                                    <input
                                        id="settings-username"
                                        type="text"
                                        autoComplete="username"
                                        {...registerProfile('username')}
                                        className="input input-bordered h-9 min-h-9 w-full rounded-lg border-base-content/15 bg-base-300 px-3 text-sm focus:border-primary"
                                    />
                                    {profileErrors.username && (
                                        <p className="mt-1 text-xs text-error" role="alert">
                                            {profileErrors.username.message}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label
                                        htmlFor="settings-email"
                                        className="mb-1.5 block text-sm font-medium text-base-content"
                                    >
                                        Email
                                    </label>
                                    <input
                                        id="settings-email"
                                        type="email"
                                        value={user.email}
                                        readOnly
                                        className="input input-bordered h-9 min-h-9 w-full rounded-lg border-base-content/15 bg-base-300 px-3 text-sm text-base-content/80"
                                    />
                                </div>
                                {profileError && (
                                    <p role="alert" className="text-sm text-error">
                                        {profileError}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSavingProfile}
                                    className="btn btn-primary btn-sm h-8 min-h-8 rounded-lg !bg-none px-4 text-primary-content"
                                >
                                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                                </button>
                            </form>

                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-base-content">
                                    Profile picture
                                </h3>
                                <UserAvatar
                                    userId={user.id}
                                    email={user.email}
                                    username={user.username}
                                    hasAvatar={user.hasAvatar}
                                    avatarUpdatedAt={user.avatarUpdatedAt}
                                    size="lg"
                                    className="!h-24 !w-24 !text-3xl"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <label
                                        className={`btn btn-sm h-8 min-h-8 rounded-lg border-base-300 bg-base-200 px-3 font-medium text-base-content hover:bg-base-300 ${isAvatarBusy ? 'btn-disabled' : ''}`}
                                    >
                                        {uploadAvatarMutation.isPending
                                            ? 'Uploading...'
                                            : 'Change photo'}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            onChange={handleAvatarChange}
                                            disabled={isAvatarBusy}
                                            aria-label="Upload profile photo"
                                            className="sr-only"
                                        />
                                    </label>
                                    {user.hasAvatar && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveAvatar}
                                            disabled={isAvatarBusy}
                                            className="btn btn-ghost btn-sm h-8 min-h-8 rounded-lg px-2 text-base-content/60"
                                        >
                                            {deleteAvatarMutation.isPending
                                                ? 'Removing...'
                                                : 'Remove Photo'}
                                        </button>
                                    )}
                                </div>
                                <p
                                    id="settings-avatar-limits"
                                    className="text-xs text-base-content/70"
                                >
                                    PNG, JPG or WebP · 2 MiB max
                                </p>
                                {avatarError && (
                                    <p role="alert" className="text-xs text-error">
                                        {avatarError}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {section === 'appearance' && (
                        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                            {themes.map((item) => {
                                const isSelected = theme === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setTheme(item.id);
                                            toast.success(`Theme changed to ${item.name}`);
                                        }}
                                        aria-pressed={isSelected}
                                        aria-label={`Select ${item.name} theme`}
                                        className={`flex flex-col justify-between gap-3 rounded-xl border bg-base-200 p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${isSelected ? 'border-primary' : 'border-base-300 hover:border-base-content/30'}`}
                                    >
                                        <span className="flex items-center justify-between gap-2 text-sm font-medium text-base-content">
                                            {item.name}
                                            {isSelected && (
                                                <svg
                                                    aria-hidden="true"
                                                    className="h-4 w-4 text-primary"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="m5 12 4 4L19 6" />
                                                </svg>
                                            )}
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className="flex overflow-hidden rounded-md border border-base-300"
                                        >
                                            {[
                                                item.swatch.base,
                                                item.swatch.surface,
                                                item.swatch.primary,
                                                item.swatch.accent,
                                            ].map((color, index) => (
                                                <span
                                                    key={index}
                                                    className="h-5 flex-1"
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {section === 'account' && (
                        <div className="divide-y divide-base-300">
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
                                <div>
                                    <h3 className="text-sm font-medium text-base-content">
                                        Sign-in method
                                    </h3>
                                    <p className="mt-1 text-sm text-base-content/60">
                                        {user.hasPassword === false
                                            ? `Signed in with ${user.oauthProvider === 'google' ? 'Google' : 'GitHub'}`
                                            : 'Email and password'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleOpenPasswordModal}
                                    disabled={user.hasPassword === false}
                                    className="btn btn-sm h-8 min-h-8 rounded-lg border-base-300 bg-base-200 px-3 font-medium text-base-content hover:bg-base-300"
                                >
                                    Password settings
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-4 py-5">
                                <h3 className="text-sm font-medium text-base-content">
                                    Account access
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleOpenDeactivate}
                                    className="btn btn-error btn-outline btn-sm h-8 min-h-8 rounded-lg px-3"
                                >
                                    Deactivate Account
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {isPasswordModalOpen && (
                <Modal
                    isOpen={isPasswordModalOpen}
                    onClose={handleClosePasswordModal}
                    title="Change Password"
                    maxWidth="md"
                >
                    <form
                        onSubmit={handleSubmitPassword(onPasswordSubmit)}
                        className="space-y-4"
                        noValidate
                    >
                        <p className="text-sm font-ui text-base-content/75 leading-relaxed">
                            Changing your password immediately signs out all active sessions and
                            requires signing in with your new password.
                        </p>

                        {passwordError && (
                            <div
                                role="alert"
                                className="alert alert-error text-sm rounded-xl py-2 px-3 text-error-content font-medium"
                            >
                                <span>{passwordError}</span>
                            </div>
                        )}

                        <FormField
                            label="Current password"
                            error={passwordErrors.currentPassword?.message}
                            required
                        >
                            {({ id, ...props }) => (
                                <input
                                    id={id}
                                    type="password"
                                    autoComplete="current-password"
                                    autoFocus
                                    disabled={
                                        changePasswordMutation.isPending || isChangingPassword
                                    }
                                    className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-ui ${
                                        passwordErrors.currentPassword ? 'input-error' : ''
                                    }`}
                                    {...registerPassword('currentPassword')}
                                    {...props}
                                />
                            )}
                        </FormField>

                        <FormField
                            label="New password"
                            hint="Must be 8–72 characters and differ from your current password."
                            error={passwordErrors.newPassword?.message}
                            required
                        >
                            {({ id, ...props }) => (
                                <input
                                    id={id}
                                    type="password"
                                    autoComplete="new-password"
                                    disabled={
                                        changePasswordMutation.isPending || isChangingPassword
                                    }
                                    className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-ui ${
                                        passwordErrors.newPassword ? 'input-error' : ''
                                    }`}
                                    {...registerPassword('newPassword')}
                                    {...props}
                                />
                            )}
                        </FormField>

                        <FormField
                            label="Confirm new password"
                            error={passwordErrors.confirmNewPassword?.message}
                            required
                        >
                            {({ id, ...props }) => (
                                <input
                                    id={id}
                                    type="password"
                                    autoComplete="new-password"
                                    disabled={
                                        changePasswordMutation.isPending || isChangingPassword
                                    }
                                    className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-ui ${
                                        passwordErrors.confirmNewPassword ? 'input-error' : ''
                                    }`}
                                    {...registerPassword('confirmNewPassword')}
                                    {...props}
                                />
                            )}
                        </FormField>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
                            <button
                                type="button"
                                onClick={handleClosePasswordModal}
                                disabled={changePasswordMutation.isPending || isChangingPassword}
                                className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={changePasswordMutation.isPending || isChangingPassword}
                                className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl text-sm"
                            >
                                {changePasswordMutation.isPending || isChangingPassword ? (
                                    <span className="flex items-center gap-2">
                                        <span className="loading loading-spinner loading-xs" />
                                        Updating...
                                    </span>
                                ) : (
                                    'Update Password'
                                )}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {isDeactivateOpen && (
                <Modal
                    isOpen={isDeactivateOpen}
                    onClose={handleCloseDeactivate}
                    title="Deactivate Account"
                    maxWidth="md"
                >
                    <form
                        onSubmit={(event) => {
                            if (user?.hasPassword === false && user.oauthProvider) {
                                event.preventDefault();
                                oauth.continueWith(user.oauthProvider, true);
                            } else {
                                void handleSubmitDeactivate(onDeactivateSubmit)(event);
                            }
                        }}
                        className="space-y-4"
                        noValidate
                    >
                        <p className="text-sm font-ui text-base-content/80 leading-relaxed">
                            You will be signed out immediately and will not be able to sign back in
                            unless a Platform Admin reactivates your account.{' '}
                            {user?.hasPassword === false
                                ? 'Continue to your sign-in provider to confirm deactivation.'
                                : 'Enter your current password to confirm.'}
                        </p>

                        {deactivateError && (
                            <div
                                role="alert"
                                className="alert alert-error text-sm rounded-xl py-2 px-3 text-error-content font-medium"
                            >
                                <span>{deactivateError}</span>
                            </div>
                        )}

                        {user?.hasPassword !== false && (
                            <div className="form-control">
                                <label htmlFor="deactivate-current-password" className="label">
                                    <span className="label-text font-medium">
                                        Confirm Current Password
                                    </span>
                                </label>
                                <input
                                    id="deactivate-current-password"
                                    type="password"
                                    autoComplete="current-password"
                                    {...registerDeactivate('currentPassword')}
                                    className="input input-bordered w-full rounded-xl bg-base-100"
                                />
                                {deactivateErrors.currentPassword && (
                                    <span className="mt-1 text-xs text-error" role="alert">
                                        {deactivateErrors.currentPassword.message}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
                            <button
                                type="button"
                                onClick={handleCloseDeactivate}
                                disabled={
                                    deactivateAccountMutation.isPending ||
                                    isDeactivating ||
                                    oauth.pending
                                }
                                className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={
                                    deactivateAccountMutation.isPending ||
                                    isDeactivating ||
                                    oauth.pending
                                }
                                className="btn btn-error btn-sm h-9 px-4 text-error-content font-semibold rounded-xl text-sm"
                            >
                                {deactivateAccountMutation.isPending || isDeactivating
                                    ? 'Deactivating...'
                                    : 'Confirm Deactivation'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

export default SettingsPage;
