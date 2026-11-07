import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    canManage: true,
    change: vi.fn(),
    remove: vi.fn(),
    toast: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ projectId: 'project-id' }) }));
vi.mock('../hooks/usePermissions', () => ({
    usePermissions: () => ({ can: () => (state.canManage ? 'enabled' : 'hidden') }),
}));
vi.mock('../hooks/useMembers', () => ({
    useMembers: () => ({
        data: [
            {
                userId: 'member-id',
                email: 'member@example.com',
                role: 'projectAdmin',
                createdAt: '2026-01-01',
            },
        ],
        isLoading: false,
        isError: false,
    }),
    useAddMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useChangeMemberRole: () => ({ mutateAsync: state.change, isPending: false }),
    useRemoveMember: () => ({ mutateAsync: state.remove, isPending: false }),
}));
vi.mock('../components/Toaster', () => ({ useToast: () => ({ toast: { success: state.toast } }) }));
vi.mock('../components/Modal', () => ({
    Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div>{children}</div> : null,
}));
vi.mock('../components/ConfirmDialog', () => ({
    ConfirmDialog: ({
        isOpen,
        title,
        body,
        onConfirm,
        onClose,
        error,
    }: {
        isOpen: boolean;
        title: string;
        body: React.ReactNode;
        onConfirm: () => void;
        onClose: () => void;
        error: string | null;
    }) =>
        isOpen ? (
            <div role="dialog" aria-label={title}>
                {body}
                {error && <p role="alert">{error}</p>}
                <button onClick={onClose}>Cancel</button>
                <button onClick={onConfirm}>Confirm</button>
            </div>
        ) : null,
}));
import { MembersPage } from './MembersPage';

describe('member management', () => {
    beforeEach(() => {
        state.canManage = true;
        state.change.mockReset();
        state.remove.mockReset();
        state.toast.mockReset();
    });
    afterEach(cleanup);
    it('confirms a role change with the chosen role', async () => {
        state.change.mockResolvedValue(undefined);
        render(<MembersPage />);
        fireEvent.click(screen.getByRole('button', { name: 'Change role for member@example.com' }));
        fireEvent.change(screen.getByLabelText('New role'), { target: { value: 'developer' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() =>
            expect(state.change).toHaveBeenCalledWith({ userId: 'member-id', role: 'developer' }),
        );
    });
    it('does not remove on cancel and explains last-admin conflicts', async () => {
        state.remove.mockRejectedValue({ status: 409, code: 'CONFLICT', message: 'Conflict' });
        render(<MembersPage />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove member@example.com' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(state.remove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Remove member@example.com' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        expect((await screen.findByRole('alert')).textContent).toContain('last Project Admin');
    });
    it('removes the selected member after confirmation', async () => {
        state.remove.mockResolvedValue(undefined);
        render(<MembersPage />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove member@example.com' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() => expect(state.remove).toHaveBeenCalledWith('member-id'));
    });
    it('hides management controls from unauthorized members', () => {
        state.canManage = false;
        render(<MembersPage />);
        expect(screen.queryByRole('button', { name: /Change role for/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Remove member@/ })).toBeNull();
    });
});
