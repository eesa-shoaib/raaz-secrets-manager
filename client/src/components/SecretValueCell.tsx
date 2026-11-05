import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRevealSecret } from '../hooks/useSecrets';
import { isApiError } from '../lib/errorHandling';
import type { Environment } from '../lib/permissions';
import { RevealConfirmDialog } from './RevealConfirmDialog';
import { useToast } from './Toaster';

export interface SecretValueCellProps {
    secretId: string;
    secretKey: string;
    projectId: string;
    environment: Environment;
    canReveal: boolean;
}

type RevealState = 'idle' | 'confirming' | 'pending' | 'revealed';

export function SecretValueCell({
    secretId,
    secretKey,
    projectId,
    environment,
    canReveal,
}: SecretValueCellProps) {
    const [state, setState] = useState<RevealState>('idle');
    const [revealedValue, setRevealedValue] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();

    const revealMutation = useRevealSecret(projectId, environment);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const handleHide = useCallback(() => {
        clearTimer();
        setRevealedValue(null);
        setIsCopied(false);
        setState('idle');
        revealMutation.reset();
    }, [clearTimer, revealMutation]);

    const handleHideRef = useRef(handleHide);
    handleHideRef.current = handleHide;

    // Cleanup on unmount and pagehide per FRONTEND.md §3.5a
    useEffect(() => {
        const onPageHide = () => {
            handleHideRef.current();
        };

        window.addEventListener('pagehide', onPageHide);
        return () => {
            clearTimer();
            setRevealedValue(null);
            window.removeEventListener('pagehide', onPageHide);
        };
    }, [clearTimer]);

    const executeReveal = async (confirm = false) => {
        setState('pending');
        try {
            const result = await revealMutation.mutateAsync({
                secretId,
                confirm,
            });

            setRevealedValue(result.value);
            setState('revealed');

            // 30 seconds auto-hide per FRONTEND.md §3.5a
            clearTimer();
            timerRef.current = setTimeout(() => {
                handleHideRef.current();
            }, 30000);
        } catch (err: unknown) {
            setState('idle');
            if (isApiError(err)) {
                if (err.status === 429) {
                    toast.error('Too many reveals, try again in 15 minutes');
                } else if (err.status === 404) {
                    toast.error('Secret no longer exists');
                } else if (err.status === 500) {
                    toast.error('Something went wrong — the action was not applied');
                } else {
                    toast.error(err.message || 'Failed to reveal secret');
                }
            } else {
                toast.error('Failed to reveal secret');
            }
        }
    };

    const handleRevealClick = () => {
        if (environment === 'production') {
            // Production gate: enters confirming with no request in flight
            setState('confirming');
        } else {
            executeReveal(false);
        }
    };

    const handleConfirmProductionReveal = () => {
        executeReveal(true);
    };

    const handleCancelConfirmation = () => {
        setState('idle');
    };

    const handleCopy = async () => {
        if (!revealedValue) return;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(revealedValue);
            } else {
                // Fallback for older browsers or non-secure contexts
                const textarea = document.createElement('textarea');
                textarea.value = revealedValue;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch {
            toast.error('Could not copy to clipboard. Please copy manually.');
        }
    };

    return (
        <div className="flex items-center gap-2 font-mono text-sm">
            {state === 'revealed' && revealedValue !== null ? (
                <>
                    <div aria-live="polite" className="sr-only">
                        Value revealed. It will hide in 30 seconds.
                    </div>
                    <code className="bg-base-300 px-2 py-1 rounded text-primary font-mono text-xs max-w-xs truncate border border-base-300 select-all">
                        {revealedValue}
                    </code>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="btn btn-ghost btn-xs text-xs font-ui text-base-content/70 hover:text-base-content px-2"
                        title="Copy secret value"
                        aria-label="Copy secret value"
                    >
                        {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                        type="button"
                        onClick={handleHide}
                        className="btn btn-ghost btn-xs text-xs font-ui text-base-content/70 hover:text-base-content px-2"
                        title="Hide secret value"
                        aria-label="Hide secret value"
                    >
                        Hide
                    </button>
                </>
            ) : (
                <>
                    <span className="text-base-content/40 tracking-widest select-none font-mono text-sm">
                        ••••••••
                    </span>
                    {canReveal && (
                        <button
                            type="button"
                            disabled={state === 'pending'}
                            onClick={handleRevealClick}
                            className="btn btn-ghost btn-xs text-xs font-ui text-primary hover:bg-primary/10 px-2.5 font-medium rounded-lg"
                            aria-label={`Reveal secret ${secretKey}`}
                        >
                            {state === 'pending' ? (
                                <span className="loading loading-spinner loading-xs text-primary"></span>
                            ) : (
                                'Reveal'
                            )}
                        </button>
                    )}
                </>
            )}

            {/* Production Confirmation Dialog */}
            <RevealConfirmDialog
                isOpen={state === 'confirming'}
                onClose={handleCancelConfirmation}
                onConfirm={handleConfirmProductionReveal}
                secretKey={secretKey}
                isLoading={state === 'pending'}
            />
        </div>
    );
}

export default SecretValueCell;
