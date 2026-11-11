import type { ChangePasswordInput, ProfileUpdateInput, PublicUser } from '@raaz/shared-schemas';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { deleteAvatar, updateProfile, uploadAvatarFile } from '../api/account';
import { changePassword } from '../api/auth';
import { queryKeys } from '../lib/queryClient';

function syncUpdatedUser(qc: QueryClient, updated: PublicUser) {
    qc.setQueryData(queryKeys.me, updated);
    qc.invalidateQueries({ queryKey: queryKeys.adminUsersPrefix });
}

export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: ProfileUpdateInput) => updateProfile(data),
        onSuccess: (updated) => syncUpdatedUser(qc, updated),
    });
}

export function useUploadAvatar() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (file: Blob | File) => uploadAvatarFile(file),
        onSuccess: (updated) => syncUpdatedUser(qc, updated),
    });
}

export function useDeleteAvatar() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => deleteAvatar(),
        onSuccess: (updated) => syncUpdatedUser(qc, updated),
    });
}

export function useChangePassword() {
    const qc = useQueryClient();
    const navigate = useNavigate();

    return useMutation({
        mutationFn: (data: ChangePasswordInput) => changePassword(data),
        onSuccess: () => {
            qc.clear();
            qc.setQueryData(queryKeys.me, null);
            navigate('/login', {
                state: { reason: 'password-changed' },
                replace: true,
            });
        },
    });
}
