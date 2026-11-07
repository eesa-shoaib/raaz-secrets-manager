import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeMemberRole, removeMember } from '../api/members';
import { queryClient, queryKeys } from '../lib/queryClient';
import { useChangeMemberRole, useRemoveMember } from './useMembers';

vi.mock('../api/members', () => ({
    getMembers: vi.fn(),
    addMember: vi.fn(),
    changeMemberRole: vi.fn(),
    removeMember: vi.fn(),
}));
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('membership mutation invalidation', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        queryClient.clear();
    });
    it('refreshes access and membership data after a role change', async () => {
        vi.mocked(changeMemberRole).mockResolvedValue();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useChangeMemberRole('project-id'), { wrapper });
        await act(async () => {
            await result.current.mutateAsync({ userId: 'member-id', role: 'developer' });
        });
        await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(4));
        for (const queryKey of [
            queryKeys.members('project-id'),
            queryKeys.project('project-id'),
            queryKeys.projects,
            queryKeys.auditPrefix('project-id'),
        ]) {
            expect(invalidate).toHaveBeenCalledWith({ queryKey });
        }
    });
    it('refreshes access and membership data after a removal conflict', async () => {
        vi.mocked(removeMember).mockRejectedValue({
            status: 409,
            code: 'CONFLICT',
            message: 'Conflict',
        });
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useRemoveMember('project-id'), { wrapper });
        await act(async () => {
            await expect(result.current.mutateAsync('member-id')).rejects.toMatchObject({
                status: 409,
            });
        });
        await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(4));
    });
});
