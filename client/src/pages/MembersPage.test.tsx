import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    canManage: true,
    change: vi.fn(),
    remove: vi.fn(),
    toast: vi.fn(),
    add: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ projectId: 'project-id' }) }));
vi.mock('../hooks/usePermissions', () => ({
    usePermissions: () => ({ can: () => (state.canManage ? 'enabled' : 'hidden') }),
}));
vi.mock('../hooks/useMembers', () => ({
    useMemberCandidates: () => ({
        data: {
            data: [{ id: 'candidate', email: 'alice@example.test', username: 'alice' }],
            nextCursor: null,
        },
        isFetching: false,
    }),
    useMembersPage: () => ({
        data: {
            data: [
                {
                    userId: 'member-id',
                    email: 'member@example.com',
                    username: null,
                    hasAvatar: false,
                    avatarUpdatedAt: null,
                    role: 'projectAdmin',
                    createdAt: '2026-01-01',
                },
            ],
            nextCursor: null,
            hasMore: false,
            limit: 25,
        },
        isLoading: false,
        isFetching: false,
        isError: false,
    }),
    useAddMember: () => ({ mutateAsync: state.add, isPending: false }),
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

it('selects a username suggestion and adds the matching email with an explicit role', async () => {
    state.canManage = true;
    state.add.mockResolvedValue(undefined);
    const { default: MembersPage } = await import('./MembersPage');
    render(<MembersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Member' }));
    fireEvent.change(screen.getByLabelText(/Email or username/), { target: { value: 'ali' } });
    fireEvent.click(await screen.findByRole('button', { name: /@alice alice@example.test/ }));
    expect((screen.getByLabelText(/Email or username/) as HTMLInputElement).value).toBe(
        'alice@example.test',
    );
    fireEvent.change(screen.getByLabelText(/Project Role/), { target: { value: 'developer' } });
    const buttons = screen.getAllByRole('button', { name: 'Add Member' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
        expect(state.add).toHaveBeenCalledWith({ email: 'alice@example.test', role: 'developer' }),
    );
});
