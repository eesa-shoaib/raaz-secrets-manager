import type { ChangePasswordInput, ProfileUpdateInput, PublicUser } from '@raaz/shared-schemas';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { deleteAvatar, updateProfile, uploadAvatarFile } from '../api/account';
import { changePassword } from '../api/auth';
import { queryClient, queryKeys } from '../lib/queryClient';

function syncUpdatedUser(updated: PublicUser) {
    queryClient.setQueryData(queryKeys.me, updated);
    queryClient.invalidateQueries({ queryKey: queryKeys.adminUsersPrefix });
}

export function useUpdateProfile() {
    return useMutation({
        mutationFn: (data: ProfileUpdateInput) => updateProfile(data),
        onSuccess: syncUpdatedUser,
    });
}

export function useUploadAvatar() {
    return useMutation({
        mutationFn: (file: Blob | File) => uploadAvatarFile(file),
        onSuccess: syncUpdatedUser,
    });
}

export function useDeleteAvatar() {
    return useMutation({
        mutationFn: () => deleteAvatar(),
        onSuccess: syncUpdatedUser,
    });
}

export function useChangePassword() {
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (data: ChangePasswordInput) => changePassword(data),
        onSuccess: () => {
            queryClient.clear();
            queryClient.setQueryData(queryKeys.me, null);
            navigate('/login', {
                state: { reason: 'password-changed' },
                replace: true,
            });
        },
    });
}
