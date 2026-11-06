import React from 'react';

interface FullPageStateProps {
    variant: 'loading' | 'error';
    message?: string;
    onRetry?: () => void;
}

export function FullPageState({ variant, message, onRetry }: FullPageStateProps) {
    if (variant === 'loading') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-base-100 text-base-content p-4">
                <div className="flex flex-col items-center gap-4">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="text-sm font-ui text-base-content/70 animate-pulse">
                        Loading session...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-base-100 text-base-content p-6">
            <div className="card bg-base-200 border border-base-300 p-8 rounded-2xl max-w-md w-full text-center shadow-xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-error/20 text-error flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>
                <h2 className="text-xl font-heading font-bold">Failed to load</h2>
                <p className="text-sm font-ui text-base-content/70">
                    {message ||
                        'Unable to connect to the server. Please check your connection and try again.'}
                </p>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="btn btn-primary text-base-300 font-semibold w-full mt-2"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}

export function ErrorState({
    message = 'Failed to load data',
    onRetry,
}: {
    message?: string;
    onRetry?: () => void;
}) {
    return (
        <div className="card bg-base-200/80 border border-error/30 p-8 rounded-2xl text-center max-w-lg mx-auto my-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-error/20 text-error flex items-center justify-center mx-auto">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 1118 0z"
                    />
                </svg>
            </div>
            <div>
                <h3 className="font-heading font-bold text-lg text-error">An error occurred</h3>
                <p className="text-sm font-ui text-base-content/80 mt-1">{message}</p>
            </div>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="btn btn-sm btn-outline btn-error font-medium mx-auto"
                >
                    Try Again
                </button>
            )}
        </div>
    );
}

export function EmptyState({
    title,
    description,
    action,
}: {
    title: string;
    description: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="card bg-base-200 border border-base-300 p-10 rounded-2xl text-center max-w-lg mx-auto my-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-base-300 text-base-content/60 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                </svg>
            </div>
            <div className="space-y-1">
                <h3 className="font-heading font-bold text-lg text-base-content">{title}</h3>
                <div className="text-sm font-ui text-base-content/70">{description}</div>
            </div>
            {action && <div className="pt-2">{action}</div>}
        </div>
    );
}

export function InlineAlert({
    variant = 'info',
    children,
}: {
    variant?: 'info' | 'warning' | 'error';
    children: React.ReactNode;
}) {
    const alertClass =
        variant === 'error'
            ? 'alert-error text-base-100 font-medium'
            : variant === 'warning'
              ? 'alert-warning text-base-300'
              : 'alert-info text-base-300';

    return (
        <div role="alert" className={`alert ${alertClass} rounded-xl text-sm py-2 px-4 shadow-sm`}>
            <span>{children}</span>
        </div>
    );
}

export default FullPageState;
