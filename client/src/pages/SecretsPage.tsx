import { zodResolver } from '@hookform/resolvers/zod';
import {
    createSecretSchema,
    editSecretSchema,
    type CreateSecretInput,
    type EditSecretInput,
    type SecretResponse,
} from '@raaz/shared-schemas';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EnvironmentTabs } from '../components/EnvironmentTabs';
import { FormField } from '../components/FormField';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { Modal } from '../components/Modal';
import { SecretValueCell } from '../components/SecretValueCell';
import { useToast } from '../components/Toaster';
import { usePermissions } from '../hooks/usePermissions';
import { useSecrets, useCreateSecret, useEditSecret, useDeleteSecret } from '../hooks/useSecrets';
import { isApiError } from '../lib/errorHandling';
import type { Environment } from '../lib/permissions';

const VALID_ENVIRONMENTS: Environment[] = ['development', 'staging', 'production'];

function isValidEnvironment(env: string | null): env is Environment {
    return VALID_ENVIRONMENTS.includes(env as Environment);
}

function formatDate(date: string | Date | null | undefined): string {
    if (!date) return 'Never';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function SecretsPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();

    const envParam = searchParams.get('environment');
    const currentEnv: Environment = isValidEnvironment(envParam) ? envParam : 'development';

    // Ensure ?environment= is always in sync with URL
    useEffect(() => {
        if (!isValidEnvironment(envParam)) {
            setSearchParams({ environment: 'development' }, { replace: true });
        }
    }, [envParam, setSearchParams]);

    const {
        data: secrets,
        isLoading,
        isError,
        error,
        refetch,
    } = useSecrets(projectId!, currentEnv);

    const { can, isAdmin, isDeveloper } = usePermissions(projectId);

    const canCreate = can('secrets.create', currentEnv);
    const canEdit = can('secrets.edit', currentEnv);
    const canDelete = can('secrets.delete', currentEnv);
    const canReveal = can('secrets.reveal', currentEnv) === 'enabled';

    // Mutations
    const createMutation = useCreateSecret(projectId!, currentEnv);
    const editMutation = useEditSecret(projectId!, currentEnv);
    const deleteMutation = useDeleteSecret(projectId!, currentEnv);

    // Modals state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [editingSecret, setEditingSecret] = useState<SecretResponse | null>(null);
    const [editError, setEditError] = useState<string | null>(null);

    const [deletingSecret, setDeletingSecret] = useState<SecretResponse | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Create Form
    const {
        register: registerCreate,
        handleSubmit: handleSubmitCreate,
        reset: resetCreate,
        setValue: setCreateValue,
        setError: setCreateFieldError,
        formState: { errors: createErrors },
    } = useForm<CreateSecretInput>({
        resolver: zodResolver(createSecretSchema),
        defaultValues: {
            environment: currentEnv,
            key: '',
            value: '',
        },
    });

    // Edit Form
    const {
        register: registerEdit,
        handleSubmit: handleSubmitEdit,
        reset: resetEdit,
        formState: { errors: editErrors },
    } = useForm<EditSecretInput>({
        resolver: zodResolver(editSecretSchema),
        defaultValues: {
            value: '',
        },
    });

    const handleOpenCreate = () => {
        resetCreate({
            environment: currentEnv,
            key: '',
            value: '',
        });
        setCreateError(null);
        setIsCreateOpen(true);
    };

    const handleCloseCreate = () => {
        setIsCreateOpen(false);
        resetCreate();
        setCreateError(null);
    };

    const onSubmitCreate = async (data: CreateSecretInput) => {
        setCreateError(null);
        try {
            await createMutation.mutateAsync({
                ...data,
                key: data.key.toUpperCase(),
            });
            toast.success(`Secret ${data.key.toUpperCase()} created successfully`);
            handleCloseCreate();
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 409) {
                    setCreateFieldError('key', {
                        type: 'manual',
                        message: 'A secret with this key already exists in this environment.',
                    });
                } else {
                    setCreateError(err.message || 'Failed to create secret');
                }
            } else {
                setCreateError('Something went wrong — the action was not applied');
            }
        }
    };

    const handleOpenEdit = (secret: SecretResponse) => {
        setEditingSecret(secret);
        resetEdit({ value: '' });
        setEditError(null);
    };

    const handleCloseEdit = () => {
        setEditingSecret(null);
        resetEdit({ value: '' });
        setEditError(null);
    };

    const onSubmitEdit = async (data: EditSecretInput) => {
        if (!editingSecret) return;
        setEditError(null);
        try {
            await editMutation.mutateAsync({
                secretId: editingSecret.id,
                data,
            });
            toast.success(`Secret ${editingSecret.key} updated successfully`);
            handleCloseEdit();
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 404) {
                    toast.error('Secret no longer exists');
                    handleCloseEdit();
                } else {
                    setEditError(err.message || 'Failed to update secret');
                }
            } else {
                setEditError('Something went wrong — the action was not applied');
            }
        }
    };

    const handleOpenDelete = (secret: SecretResponse) => {
        setDeletingSecret(secret);
        setDeleteError(null);
    };

    const handleCloseDelete = () => {
        setDeletingSecret(null);
        setDeleteError(null);
    };

    const onConfirmDelete = async () => {
        if (!deletingSecret) return;
        setDeleteError(null);
        try {
            await deleteMutation.mutateAsync(deletingSecret.id);
            toast.success(`Secret ${deletingSecret.key} deleted successfully`);
            handleCloseDelete();
        } catch (err: unknown) {
            if (isApiError(err)) {
                if (err.status === 404) {
                    toast.error('Secret no longer exists');
                    handleCloseDelete();
                } else {
                    setDeleteError(err.message || 'Failed to delete secret');
                }
            } else {
                setDeleteError('Something went wrong — the action was not applied');
            }
        }
    };

    const disabledReason =
        'Developers can create and edit secrets only in the development environment.';

    return (
        <div className="space-y-6">
            {/* Top Bar: Environment Tabs + New Secret Action */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <EnvironmentTabs
                    currentEnvironment={currentEnv}
                    onSelect={(env) => setSearchParams({ environment: env })}
                />

                {canCreate !== 'hidden' && (
                    <div
                        className={canCreate === 'disabled' ? 'tooltip tooltip-left' : ''}
                        data-tip={canCreate === 'disabled' ? disabledReason : undefined}
                    >
                        <button
                            type="button"
                            disabled={canCreate === 'disabled'}
                            onClick={handleOpenCreate}
                            className="btn btn-primary text-base-300 font-semibold rounded-xl flex items-center gap-2 hover:opacity-90 disabled:opacity-40"
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
                            New Secret
                        </button>
                    </div>
                )}
            </div>

            {/* Secrets Table panel keyed by currentEnv to guarantee remount & unmount */}
            <div key={currentEnv}>
                {isLoading ? (
                    <Skeleton shape="table" count={5} />
                ) : isError ? (
                    <ErrorState
                        message={isApiError(error) ? error.message : 'Failed to load secrets'}
                        onRetry={() => refetch()}
                    />
                ) : secrets && secrets.length > 0 ? (
                    <div className="overflow-x-auto rounded-3xl border border-base-300 bg-base-200 shadow-sm">
                        <table className="table w-full text-sm">
                            <thead>
                                <tr className="border-b border-base-300 font-heading text-xs text-base-content/60 uppercase tracking-wider">
                                    <th className="py-4 pl-6">Key</th>
                                    <th className="py-4">Value</th>
                                    <th className="py-4">Last Accessed</th>
                                    <th className="py-4">Created</th>
                                    <th className="py-4 pr-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-300/60 font-ui">
                                {secrets.map((secret) => (
                                    <tr
                                        key={secret.id}
                                        className="hover:bg-base-300/30 transition-colors"
                                    >
                                        {/* Key */}
                                        <td className="py-4 pl-6 font-mono font-bold text-base-content tracking-tight">
                                            {secret.key}
                                        </td>

                                        {/* Value */}
                                        <td className="py-4">
                                            <SecretValueCell
                                                secretId={secret.id}
                                                secretKey={secret.key}
                                                projectId={projectId!}
                                                environment={currentEnv}
                                                canReveal={canReveal}
                                            />
                                        </td>

                                        {/* Last Accessed */}
                                        <td className="py-4 text-xs text-base-content/70">
                                            {formatDate(secret.lastAccessedAt)}
                                        </td>

                                        {/* Created */}
                                        <td className="py-4 text-xs text-base-content/70">
                                            {formatDate(secret.createdAt)}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-4 pr-6 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {canEdit !== 'hidden' && (
                                                    <div
                                                        className={
                                                            canEdit === 'disabled'
                                                                ? 'tooltip tooltip-left'
                                                                : ''
                                                        }
                                                        data-tip={
                                                            canEdit === 'disabled'
                                                                ? disabledReason
                                                                : undefined
                                                        }
                                                    >
                                                        <button
                                                            type="button"
                                                            disabled={canEdit === 'disabled'}
                                                            onClick={() => handleOpenEdit(secret)}
                                                            className="btn btn-ghost btn-xs font-ui text-base-content/80 hover:text-base-content disabled:opacity-40"
                                                            aria-label={`Edit ${secret.key}`}
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                )}

                                                {canDelete === 'enabled' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDelete(secret)}
                                                        className="btn btn-ghost btn-xs font-ui text-error/80 hover:text-error hover:bg-error/10"
                                                        aria-label={`Delete ${secret.key}`}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title={`No secrets in ${currentEnv} yet`}
                        description={
                            canCreate === 'enabled'
                                ? `Store your first encrypted ${currentEnv} secret to get started.`
                                : `No secrets configured for the ${currentEnv} environment.`
                        }
                        action={
                            canCreate === 'enabled' ? (
                                <button
                                    type="button"
                                    onClick={handleOpenCreate}
                                    className="btn btn-primary text-base-300 font-semibold rounded-xl"
                                >
                                    New Secret
                                </button>
                            ) : undefined
                        }
                    />
                )}
            </div>

            {/* Create Secret Modal */}
            <Modal isOpen={isCreateOpen} onClose={handleCloseCreate} title="Create New Secret">
                <form
                    onSubmit={handleSubmitCreate(onSubmitCreate)}
                    className="space-y-4"
                    noValidate
                >
                    {createError && (
                        <div
                            role="alert"
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100 font-medium"
                        >
                            <span>{createError}</span>
                        </div>
                    )}

                    {/* Environment selection */}
                    <FormField label="Environment" required>
                        {({ id, ...props }) => (
                            <select
                                id={id}
                                className="select select-bordered w-full bg-base-300 rounded-xl text-sm font-ui"
                                disabled={isDeveloper}
                                {...registerCreate('environment')}
                                {...props}
                            >
                                {isAdmin ? (
                                    VALID_ENVIRONMENTS.map((env) => (
                                        <option key={env} value={env}>
                                            {env.charAt(0).toUpperCase() + env.slice(1)}
                                        </option>
                                    ))
                                ) : (
                                    <option value="development">Development</option>
                                )}
                            </select>
                        )}
                    </FormField>

                    {/* Key */}
                    <FormField
                        label="Secret Key"
                        hint="Uppercase letters, numbers, and underscores only (e.g. STRIPE_API_KEY)"
                        error={createErrors.key?.message}
                        required
                    >
                        {({ id, ...props }) => (
                            <input
                                id={id}
                                type="text"
                                placeholder="DATABASE_URL"
                                autoFocus
                                className={`input input-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-mono uppercase ${
                                    createErrors.key ? 'input-error' : ''
                                }`}
                                {...registerCreate('key', {
                                    onChange: (e) => {
                                        setCreateValue('key', e.target.value.toUpperCase());
                                    },
                                })}
                                {...props}
                            />
                        )}
                    </FormField>

                    {/* Value */}
                    <FormField
                        label="Secret Value"
                        hint="Encrypted with AES-256-GCM before storage (≤ 4 KB)"
                        error={createErrors.value?.message}
                        required
                    >
                        {({ id, ...props }) => (
                            <textarea
                                id={id}
                                rows={4}
                                placeholder="Enter secret value..."
                                className={`textarea textarea-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-mono ${
                                    createErrors.value ? 'textarea-error' : ''
                                }`}
                                {...registerCreate('value')}
                                {...props}
                            />
                        )}
                    </FormField>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
                        <button
                            type="button"
                            onClick={handleCloseCreate}
                            disabled={createMutation.isPending}
                            className="btn btn-ghost rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="btn btn-primary text-base-300 font-semibold rounded-xl text-sm"
                        >
                            {createMutation.isPending ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                'Save Secret'
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Secret Modal */}
            <Modal
                isOpen={Boolean(editingSecret)}
                onClose={handleCloseEdit}
                title={`Edit Secret: ${editingSecret?.key || ''}`}
            >
                <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-4" noValidate>
                    {editError && (
                        <div
                            role="alert"
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-base-100 font-medium"
                        >
                            <span>{editError}</span>
                        </div>
                    )}

                    <div className="bg-base-300/50 p-3 rounded-2xl border border-base-300 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-base-content/60">Key:</span>
                            <span className="font-mono font-bold text-base-content">
                                {editingSecret?.key}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-base-content/60">Environment:</span>
                            <span className="font-mono uppercase text-base-content">
                                {currentEnv}
                            </span>
                        </div>
                    </div>

                    <FormField
                        label="New Secret Value"
                        hint="For security, the current value is not displayed. Enter a new value to replace it."
                        error={editErrors.value?.message}
                        required
                    >
                        {({ id, ...props }) => (
                            <textarea
                                id={id}
                                rows={4}
                                autoFocus
                                placeholder="Enter new secret value..."
                                className={`textarea textarea-bordered w-full bg-base-300 rounded-xl focus:border-primary text-sm font-mono ${
                                    editErrors.value ? 'textarea-error' : ''
                                }`}
                                {...registerEdit('value')}
                                {...props}
                            />
                        )}
                    </FormField>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
                        <button
                            type="button"
                            onClick={handleCloseEdit}
                            disabled={editMutation.isPending}
                            className="btn btn-ghost rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={editMutation.isPending}
                            className="btn btn-primary text-base-300 font-semibold rounded-xl text-sm"
                        >
                            {editMutation.isPending ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                'Update Value'
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={Boolean(deletingSecret)}
                onClose={handleCloseDelete}
                onConfirm={onConfirmDelete}
                title="Delete Secret"
                body={
                    <span>
                        Are you sure you want to delete{' '}
                        <strong className="text-base-content font-mono font-bold">
                            {deletingSecret?.key}
                        </strong>
                        ? This permanently removes the secret. The audit log keeps its name.
                    </span>
                }
                confirmLabel="Delete Secret"
                tone="danger"
                isLoading={deleteMutation.isPending}
                error={deleteError}
            />
        </div>
    );
}

export default SecretsPage;
