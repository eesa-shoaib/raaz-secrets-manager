import React, { useRef, useEffect } from 'react';
import { Modal } from './Modal';

export interface RevealConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  secretKey: string;
  isLoading?: boolean;
}

export function RevealConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  secretKey,
  isLoading = false,
}: RevealConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus cancel button by default per FRONTEND.md §2.3 & §3.5a
      setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reveal Production Secret"
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-warning/10 border border-warning/30 p-4 text-warning flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-xs font-ui text-base-content/90 leading-relaxed">
            Production secrets are protected by an access gate. Decrypting this
            value creates an immediate, permanent audit log entry.
          </div>
        </div>

        <p className="text-sm font-ui text-base-content/80 leading-relaxed">
          Are you sure you want to reveal the production secret{' '}
          <strong className="text-base-content font-mono font-bold bg-base-300 px-1.5 py-0.5 rounded">
            {secretKey}
          </strong>
          ?
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-ghost rounded-xl text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="btn btn-error text-base-100 font-semibold rounded-xl text-sm"
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              'Confirm Reveal'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default RevealConfirmDialog;
