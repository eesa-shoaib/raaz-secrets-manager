import React from 'react';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'neutral' | 'danger';
    isLoading?: boolean;
    error?: string | null;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    body,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'neutral',
    isLoading = false,
    error = null,
}: ConfirmDialogProps) {
    const confirmBtnClass =
        tone === 'danger'
            ? 'btn-error text-base-100 font-semibold'
            : 'btn-primary text-base-300 font-semibold';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
            <div className="space-y-4">
                {error && (
                    <div
                        role="alert"
                        className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100 font-medium"
                    >
                        <span>{error}</span>
                    </div>
                )}

                <div className="text-sm font-ui text-base-content/80 leading-relaxed">{body}</div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="btn btn-ghost rounded-xl text-sm"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`btn rounded-xl text-sm ${confirmBtnClass}`}
                    >
                        {isLoading ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            confirmLabel
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default ConfirmDialog;
