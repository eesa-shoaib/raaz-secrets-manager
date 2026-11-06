import { zodResolver } from '@hookform/resolvers/zod';
import { addMemberSchema, type AddMemberInput, type MemberResponse } from '@raaz/shared-schemas';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormField } from '../components/FormField';
import { ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toaster';
import {
    useMembers,
    useAddMember,
    useChangeMemberRole,
    useRemoveMember,
} from '../hooks/useMembers';
import { usePermissions } from '../hooks/usePermissions';
import { isApiError } from '../lib/errorHandling';

function formatDate(date: string | Date | null | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function MembersPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const { data: members, isLoading, isError, error, refetch } = useMembers(projectId!);
    const { can } = usePermissions(projectId);
    const { mutateAsync: addMemberMutation, isPending: isAdding } = useAddMember(projectId!);
    const changeRole = useChangeMemberRole(projectId!);
    const removeMember = useRemoveMember(projectId!);
    const { toast } = useToast();

    const canAddMember = can('members.add') === 'enabled';
    const canChangeRole = can('members.change-role') === 'enabled';
    const canRemove = can('members.remove') === 'enabled';
    const [action, setAction] = useState<{
        kind: 'role' | 'remove';
        member: MemberResponse;
    } | null>(null);
    const [nextRole, setNextRole] = useState<MemberResponse['role']>('developer');
    const [actionError, setActionError] = useState<string | null>(null);
    const isChanging = changeRole.isPending || removeMember.isPending;

    const openAction = (kind: 'role' | 'remove', member: MemberResponse) => {
        setNextRole(member.role);
        setActionError(null);
        setAction({ kind, member });
    };
    const closeAction = () => {
        if (!isChanging) {
            setAction(null);
            setActionError(null);
        }
    };
    const confirmAction = async () => {
        if (!action || isChanging) return;
        setActionError(null);
        try {
            if (action.kind === 'role')
                await changeRole.mutateAsync({ userId: action.member.userId, role: nextRole });
            else await removeMember.mutateAsync(action.member.userId);
            toast.success(action.kind === 'role' ? 'Member role updated' : 'Member removed');
            setAction(null);
        } catch (err: unknown) {
            if (isApiError(err) && err.status === 409)
                setActionError('The last Project Admin cannot be removed or demoted.');
            else if (isApiError(err) && err.status === 404)
                setActionError('This member or project is no longer available.');
            else if (isApiError(err) && err.status === 403)
                setActionError('You no longer have permission to manage members.');
            else setActionError('Something went wrong — the action was not applied.');
        }
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors },
    } = useForm<AddMemberInput>({
        resolver: zodResolver(addMemberSchema),
        defaultValues: {
            email: '',
            // No default role per FRONTEND.md §3.6 (explicit assignment)
            role: undefined,
        },
    });

    const handleOpenModal = () => {
        reset({ email: '', role: undefined });
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        reset();
        setModalError(null);
    };

    const onSubmit = async (data: AddMemberInput) => {
        setModalError(null);
        try {
            await addMemberMutation({
                email: data.email.toLowerCase().trim(),
                role: data.role,
            });
            toast.success(`Added ${data.email} to project`);
            handleCloseModal();
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 404) {
                    setError('email', {
                        type: 'manual',
                        message: 'No account with that email',
                    });
                } else if (err.status === 409) {
                    setError('email', {
                        type: 'manual',
                        message: 'Already a member',
                    });
                } else {
                    setModalError(err.message || 'Failed to add member');
                }
            } else {
                setModalError('Something went wrong — the action was not applied');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-heading font-bold text-base-content">
                        Team Members
                    </h2>
                    <p className="text-sm font-ui text-base-content/70 mt-0.5">
                        Manage who can view, create, and reveal secrets in this project
                    </p>
                </div>

                {canAddMember && (
                    <button
                        type="button"
                        onClick={handleOpenModal}
                        className="btn btn-primary text-base-300 font-semibold rounded-xl flex items-center gap-2 hover:opacity-90 self-start sm:self-auto"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Add Member
                    </button>
                )}
            </div>

            {isLoading ? (
                <Skeleton shape="table" count={4} />
            ) : isError ? (
                <ErrorState
                    message={isApiError(error) ? error.message : 'Failed to load team members'}
                    onRetry={() => refetch()}
                />
            ) : (
                <div className="overflow-x-auto rounded-3xl border border-base-300 bg-base-200 shadow-sm">
                    <table className="table w-full text-sm">
                        <thead>
                            <tr className="border-b border-base-300 font-heading text-xs text-base-content/60 uppercase tracking-wider">
                                <th className="py-4 pl-6">Member</th>
                                <th className="py-4">Role</th>
                                <th className="py-4 pr-6 text-right">Joined</th>
                                {(canChangeRole || canRemove) && (
                                    <th className="py-4 pr-6 text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-300/60 font-ui">
                            {members?.map((member) => (
                                <tr
                                    key={member.userId}
                                    className="hover:bg-base-300/30 transition-colors"
                                >
                                    <td className="py-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-base-300 text-primary font-bold text-xs flex items-center justify-center uppercase">
                                                {member.email.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-base-content font-ui">
                                                    {member.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <span className="font-semibold text-base-content capitalize">
                                            {member.role === 'projectAdmin' ? 'Project Admin' : member.role}
                                        </span>
                                    </td>
                                    <td className="py-4 pr-6 text-right text-xs text-base-content/70">
                                        {formatDate(member.createdAt)}
                                    </td>
                                    {(canChangeRole || canRemove) && (
                                        <td className="py-4 pr-6 text-right whitespace-nowrap">
                                            {canChangeRole && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    aria-label={`Change role for ${member.email}`}
                                                    onClick={() => openAction('role', member)}
                                                >
                                                    Change role
                                                </button>
                                            )}
                                            {canRemove && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm text-error"
                                                    aria-label={`Remove ${member.email}`}
                                                    onClick={() => openAction('remove', member)}
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Member Modal */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Add Team Member">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    {modalError && (
                        <div
                            role="alert"
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100 font-medium"
                        >
                            <span>{modalError}</span>
                        </div>
                    )}

                    <FormField
                        label="Email Address"
                        hint="User must have an existing Raaz account"
                        error={errors.email?.message}
                        required
                    >
                        {({ id, ...props }) => (
                            <input
                                id={id}
                                type="email"
                                placeholder="colleague@example.com"
                                autoFocus
                                className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-ui ${
                                    errors.email ? 'input-error' : ''
                                }`}
                                {...register('email')}
                                {...props}
                            />
                        )}
                    </FormField>

                    <FormField
                        label="Project Role"
                        hint="Explicit role assignment: Admin (full control), Developer (dev edits + reveal), or Auditor (read-only audit/presence)"
                        error={errors.role?.message}
                        required
                    >
                        {({ id, ...props }) => (
                            <select
                                id={id}
                                defaultValue=""
                                className={`select select-bordered w-full bg-base-300 rounded-xl text-sm font-ui ${
                                    errors.role ? 'select-error' : ''
                                }`}
                                {...register('role')}
                                {...props}
                            >
                                <option value="" disabled>
                                    Select a role...
                                </option>
                                <option value="developer">Developer</option>
                                <option value="projectAdmin">Project Admin</option>
                                <option value="auditor">Auditor</option>
                            </select>
                        )}
                    </FormField>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            disabled={isAdding}
                            className="btn btn-ghost rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isAdding}
                            className="btn btn-primary text-base-300 font-semibold rounded-xl text-sm"
                        >
                            {isAdding ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                'Add Member'
                            )}
                        </button>
                    </div>
                </form>
            </Modal>
            <ConfirmDialog
                isOpen={action !== null}
                onClose={closeAction}
                onConfirm={() => void confirmAction()}
                title={action?.kind === 'role' ? 'Change member role' : 'Remove member'}
                confirmLabel={action?.kind === 'role' ? 'Change role' : 'Remove member'}
                tone={action?.kind === 'remove' ? 'danger' : 'neutral'}
                isLoading={isChanging}
                error={actionError}
                body={
                    action?.kind === 'role' ? (
                        <label className="flex flex-col gap-2">
                            <span>New role for {action.member.email}</span>
                            <select
                                aria-label="New role"
                                className="select select-bordered w-full"
                                value={nextRole}
                                onChange={(event) =>
                                    setNextRole(event.target.value as MemberResponse['role'])
                                }
                                disabled={isChanging}
                            >
                                <option value="projectAdmin">Project Admin</option>
                                <option value="developer">Developer</option>
                                <option value="auditor">Auditor</option>
                            </select>
                        </label>
                    ) : (
                        <p>Remove {action?.member.email} from this project?</p>
                    )
                }
            />
        </div>
    );
}

export default MembersPage;
