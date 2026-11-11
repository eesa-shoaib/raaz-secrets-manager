import { zodResolver } from '@hookform/resolvers/zod';
import {
    changePasswordInputSchema,
    profileUpdateInputSchema,
    type ChangePasswordInput,
    type ProfileUpdateInput,
} from '@raaz/shared-schemas';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toaster';
import { UserAvatar } from '../components/UserAvatar';
import {
    useChangePassword,
    useDeleteAvatar,
    useUpdateProfile,
    useUploadAvatar,
} from '../hooks/useAccount';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isApiError } from '../lib/errorHandling';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function SettingsPage() {
    useDocumentTitle('Account Settings');
    const { user } = useAuth();
    const { toast } = useToast();

    const updateProfileMutation = useUpdateProfile();
    const uploadAvatarMutation = useUploadAvatar();
    const deleteAvatarMutation = useDeleteAvatar();
    const changePasswordMutation = useChangePassword();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);

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
    } = useForm<ChangePasswordInput>({
        resolver: zodResolver(changePasswordInputSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
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

    const onPasswordSubmit = async (data: ChangePasswordInput) => {
        setPasswordError(null);
        try {
            await changePasswordMutation.mutateAsync(data);
            resetPassword();
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 401) {
                    setPasswordError('Current password is incorrect.');
                } else {
                    setPasswordError(err.message || 'Failed to update password');
                }
            } else {
                setPasswordError('Something went wrong — password was not changed.');
            }
        }
    };

    if (!user) return null;

    const isAvatarBusy = uploadAvatarMutation.isPending || deleteAvatarMutation.isPending;

    return (
        <div className="space-y-6 max-w-3xl">
            <PageHeader
                title="Account Settings"
                description="Manage your public username, profile photo, and account password"
            />

            {/* Profile & Avatar */}
            <section className="card bg-base-200 border border-base-300 rounded-2xl p-6 shadow-sm space-y-6">
                <h2 className="font-heading text-lg font-bold text-base-content">Profile</h2>

                <div className="flex flex-wrap items-center gap-5">
                    <UserAvatar
                        userId={user.id}
                        email={user.email}
                        username={user.username}
                        hasAvatar={user.hasAvatar}
                        avatarUpdatedAt={user.avatarUpdatedAt}
                        size="lg"
                    />
                    <div className="space-y-2">
                        <div className="text-sm font-ui">
                            <p className="font-semibold text-base-content">
                                {user.username ? `@${user.username}` : user.email}
                            </p>
                            <p className="text-xs text-base-content/60">{user.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="btn btn-sm btn-primary text-base-300 font-semibold rounded-xl cursor-pointer">
                                {uploadAvatarMutation.isPending ? 'Uploading...' : 'Upload Photo'}
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
                                    className="btn btn-sm btn-ghost border border-base-300 rounded-xl"
                                >
                                    {deleteAvatarMutation.isPending
                                        ? 'Removing...'
                                        : 'Remove Photo'}
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-base-content/60">
                            PNG, JPEG, or WebP up to 2 MiB. Automatically normalized and stripped of
                            metadata.
                        </p>
                    </div>
                </div>

                {avatarError && (
                    <div
                        role="alert"
                        className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100"
                    >
                        <span>{avatarError}</span>
                    </div>
                )}

                <form
                    onSubmit={handleSubmitProfile(onProfileSubmit)}
                    className="space-y-4 pt-4 border-t border-base-300"
                >
                    {profileError && (
                        <div
                            role="alert"
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100"
                        >
                            <span>{profileError}</span>
                        </div>
                    )}

                    <div className="form-control max-w-sm">
                        <label htmlFor="settings-username" className="label">
                            <span className="label-text font-medium">Username</span>
                        </label>
                        <input
                            id="settings-username"
                            type="text"
                            placeholder="e.g. alice_dev"
                            autoComplete="username"
                            {...registerProfile('username')}
                            className="input input-bordered w-full rounded-xl bg-base-100"
                        />
                        {profileErrors.username ? (
                            <span className="mt-1 text-xs text-error" role="alert">
                                {profileErrors.username.message}
                            </span>
                        ) : (
                            <span className="mt-1 text-xs text-base-content/60">
                                3–30 lowercase letters, digits, or underscores. Leave blank to
                                clear.
                            </span>
                        )}
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isSavingProfile}
                            className="btn btn-primary btn-sm text-base-300 font-semibold rounded-xl px-5"
                        >
                            {isSavingProfile ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </form>
            </section>

            {/* Change Password */}
            <section className="card bg-base-200 border border-base-300 rounded-2xl p-6 shadow-sm space-y-5">
                <div>
                    <h2 className="font-heading text-lg font-bold text-base-content">
                        Change Password
                    </h2>
                    <p className="text-xs font-ui text-base-content/60 mt-1">
                        Changing your password invalidates all existing sessions and requires
                        signing in again.
                    </p>
                </div>

                {passwordError && (
                    <div
                        role="alert"
                        className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100"
                    >
                        <span>{passwordError}</span>
                    </div>
                )}

                <form
                    onSubmit={handleSubmitPassword(onPasswordSubmit)}
                    className="space-y-4 max-w-sm"
                >
                    <div className="form-control">
                        <label htmlFor="settings-current-password" className="label">
                            <span className="label-text font-medium">Current Password</span>
                        </label>
                        <input
                            id="settings-current-password"
                            type="password"
                            autoComplete="current-password"
                            {...registerPassword('currentPassword')}
                            className="input input-bordered w-full rounded-xl bg-base-100"
                        />
                        {passwordErrors.currentPassword && (
                            <span className="mt-1 text-xs text-error" role="alert">
                                {passwordErrors.currentPassword.message}
                            </span>
                        )}
                    </div>

                    <div className="form-control">
                        <label htmlFor="settings-new-password" className="label">
                            <span className="label-text font-medium">New Password</span>
                        </label>
                        <input
                            id="settings-new-password"
                            type="password"
                            autoComplete="new-password"
                            {...registerPassword('newPassword')}
                            className="input input-bordered w-full rounded-xl bg-base-100"
                        />
                        {passwordErrors.newPassword ? (
                            <span className="mt-1 text-xs text-error" role="alert">
                                {passwordErrors.newPassword.message}
                            </span>
                        ) : (
                            <span className="mt-1 text-xs text-base-content/60">
                                Must be 8–72 characters and differ from your current password.
                            </span>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="btn btn-primary btn-sm text-base-300 font-semibold rounded-xl px-5"
                    >
                        {isChangingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </section>
        </div>
    );
}

export default SettingsPage;
