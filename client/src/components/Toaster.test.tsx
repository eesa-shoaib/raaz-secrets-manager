import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toaster';

function Trigger() {
    const { toast } = useToast();
    return (
        <>
            <button onClick={() => toast.error('Login failed', 4000)}>Login error</button>
            <button onClick={() => toast.error('Save failed')}>Other error</button>
        </>
    );
}

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('error notifications', () => {
    it('dismisses timed login errors after four seconds', () => {
        vi.useFakeTimers();
        render(
            <ToastProvider>
                <Trigger />
            </ToastProvider>,
        );
        fireEvent.click(screen.getByText('Login error'));
        expect(screen.getByRole('alert').textContent).toContain('Login failed');
        act(() => vi.advanceTimersByTime(3999));
        expect(screen.queryByRole('alert')).not.toBeNull();
        act(() => vi.advanceTimersByTime(1));
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('preserves persistent errors when no duration is provided', () => {
        vi.useFakeTimers();
        render(
            <ToastProvider>
                <Trigger />
            </ToastProvider>,
        );
        fireEvent.click(screen.getByText('Other error'));
        act(() => vi.advanceTimersByTime(10000));
        expect(screen.getByRole('alert').textContent).toContain('Save failed');
        fireEvent.click(screen.getByLabelText('Close notification'));
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
