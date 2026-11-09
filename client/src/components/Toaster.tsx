import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
    toast: {
        success: (message: string, duration?: number) => void;
        error: (message: string, duration?: number) => void;
        info: (message: string, duration?: number) => void;
        warning: (message: string, duration?: number) => void;
    };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback(
        (message: string, type: ToastType = 'info', duration?: number) => {
            const id = Math.random().toString(36).substring(2, 9);
            setToasts((prev) => [...prev, { id, type, message }]);

            // Success auto-dismisses after 4s; error persists per FRONTEND.md §2.2
            if (duration !== undefined || type === 'success' || type === 'info') {
                setTimeout(() => {
                    removeToast(id);
                }, duration ?? 4000);
            }
        },
        [removeToast],
    );

    const toastMethods = {
        success: (msg: string) => addToast(msg, 'success'),
        error: (msg: string, duration?: number) => addToast(msg, 'error', duration),
        info: (msg: string) => addToast(msg, 'info'),
        warning: (msg: string) => addToast(msg, 'warning'),
    };

    return (
        <ToastContext.Provider
            value={{
                toasts,
                addToast,
                removeToast,
                toast: toastMethods,
            }}
        >
            {children}
            <Toaster />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function Toaster() {
    const context = useContext(ToastContext);
    if (!context || context.toasts.length === 0) return null;

    return (
        <div className="toast toast-end toast-top z-50 p-4 space-y-2">
            {context.toasts.map((t) => {
                const alertClass =
                    t.type === 'success'
                        ? 'alert-success text-base-300'
                        : t.type === 'error'
                          ? 'alert-error text-base-100 font-medium'
                          : t.type === 'warning'
                            ? 'alert-warning'
                            : 'alert-info';

                return (
                    <div
                        key={t.id}
                        role="alert"
                        className={`alert ${alertClass} shadow-lg flex items-center justify-between rounded-xl px-4 py-3 min-w-[280px] max-w-md animate-fade-in`}
                    >
                        <div className="flex items-center gap-2">
                            {t.type === 'success' && (
                                <svg
                                    className="w-5 h-5 flex-shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            )}
                            {t.type === 'error' && (
                                <svg
                                    className="w-5 h-5 flex-shrink-0"
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
                            )}
                            <span className="text-sm font-ui">{t.message}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => context.removeToast(t.id)}
                            className="btn btn-ghost btn-xs btn-circle ml-2"
                            aria-label="Close notification"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
