import React from 'react';

export type BadgeVariant = 'role' | 'environment' | 'projectStatus' | 'auditResult' | 'userStatus';

interface BadgeProps {
    variant: BadgeVariant;
    value: string | null | undefined;
    className?: string;
}

export function Badge({ variant, value, className = '' }: BadgeProps) {
    if (!value) return null;

    switch (variant) {
        case 'role': {
            if (value === 'projectAdmin') {
                return (
                    <span
                        className={`badge badge-primary min-w-28 justify-center text-base-300 font-semibold text-xs px-2.5 py-1 ${className}`}
                    >
                        Project Admin
                    </span>
                );
            }
            if (value === 'developer') {
                return (
                    <span
                        className={`badge badge-info badge-outline min-w-28 justify-center text-xs px-2.5 py-1 ${className}`}
                    >
                        Developer
                    </span>
                );
            }
            if (value === 'auditor') {
                return (
                    <span
                        className={`badge badge-secondary badge-outline min-w-28 justify-center text-xs px-2.5 py-1 ${className}`}
                    >
                        Auditor
                    </span>
                );
            }
            return (
                <span className={`badge badge-ghost min-w-28 justify-center text-xs ${className}`}>
                    {value}
                </span>
            );
        }

        case 'environment': {
            if (value === 'production') {
                return (
                    <span
                        className={`badge badge-error badge-outline text-xs font-semibold px-2.5 py-1 ${className}`}
                    >
                        Production
                    </span>
                );
            }
            if (value === 'staging') {
                return (
                    <span
                        className={`badge badge-warning badge-outline text-xs px-2.5 py-1 ${className}`}
                    >
                        Staging
                    </span>
                );
            }
            if (value === 'development') {
                return (
                    <span
                        className={`badge badge-info badge-outline text-xs px-2.5 py-1 ${className}`}
                    >
                        Development
                    </span>
                );
            }
            return <span className={`badge badge-ghost text-xs ${className}`}>{value}</span>;
        }

        case 'auditResult': {
            if (value === 'allowed') {
                return (
                    <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium text-success ${className}`}
                    >
                        <span aria-hidden="true">✓</span>
                        Allowed
                    </span>
                );
            }
            if (value === 'denied') {
                return (
                    <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium text-error ${className}`}
                    >
                        <span aria-hidden="true">✕</span>
                        Denied
                    </span>
                );
            }
            return (
                <span className={`badge badge-ghost badge-sm text-xs ${className}`}>{value}</span>
            );
        }

        case 'projectStatus': {
            if (value === 'active') {
                return (
                    <span className={`badge badge-success badge-outline text-xs ${className}`}>
                        Active
                    </span>
                );
            }
            if (value === 'archived') {
                return <span className={`badge badge-neutral text-xs ${className}`}>Archived</span>;
            }
            return <span className={`badge badge-ghost text-xs ${className}`}>{value}</span>;
        }

        case 'userStatus': {
            const isActive = value === 'active' || value === 'true';
            return (
                <span
                    className={`badge ${isActive ? 'badge-success badge-outline' : 'badge-ghost'} text-xs ${className}`}
                >
                    {isActive ? 'Active' : 'Inactive'}
                </span>
            );
        }

        default:
            return <span className={`badge badge-ghost text-xs ${className}`}>{value}</span>;
    }
}

export default Badge;
