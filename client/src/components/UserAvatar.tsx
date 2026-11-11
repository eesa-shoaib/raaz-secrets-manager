import React, { useEffect, useState } from 'react';
import { getUserAvatarUrl } from '../api/account';

export interface UserAvatarProps {
    userId?: string | null;
    email?: string | null;
    username?: string | null;
    hasAvatar?: boolean;
    avatarUpdatedAt?: string | Date | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-14 h-14 text-lg',
};

export function UserAvatar({
    userId,
    email,
    username,
    hasAvatar = false,
    avatarUpdatedAt = null,
    size = 'sm',
    className = '',
}: UserAvatarProps) {
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
    }, [userId, hasAvatar, avatarUpdatedAt]);

    const displayLabel = username || email || 'User';
    const initial = displayLabel.charAt(0).toUpperCase();
    const sizeClass = SIZE_CLASSES[size];

    if (hasAvatar && userId && !imgFailed) {
        return (
            <img
                src={getUserAvatarUrl(userId, avatarUpdatedAt)}
                alt={`${displayLabel} avatar`}
                onError={() => setImgFailed(true)}
                className={`${sizeClass} shrink-0 rounded-full object-cover border border-base-300 bg-base-300 ${className}`}
            />
        );
    }

    return (
        <div
            aria-hidden="true"
            className={`${sizeClass} shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold uppercase border border-primary/20 ${className}`}
        >
            {initial}
        </div>
    );
}

export default UserAvatar;
