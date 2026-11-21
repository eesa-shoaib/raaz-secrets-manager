import { zodResolver } from '@hookform/resolvers/zod';
import {
    MASKED_SECRET_VALUE,
    createSecretSchema,
    editSecretSchema,
    type CreateSecretInput,
    type EditSecretInput,
    type EnvExampleResponse,
    type ImportSecretsMode,
    type SecretResponse,
} from '@raaz/shared-schemas';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { useParams, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EnvironmentTabs } from '../components/EnvironmentTabs';
import { FormField } from '../components/FormField';
import { EmptyState, ErrorState } from '../components/FullPageState';
import { Skeleton } from '../components/LoadingSkeleton';
import { Modal } from '../components/Modal';
import { PaginationControls } from '../components/PaginationControls';
import { SearchInput } from '../components/SearchInput';
import { SecretValueCell } from '../components/SecretValueCell';
import { useToast } from '../components/Toaster';
import { usePermissions } from '../hooks/usePermissions';
import {
    useSecretsPage,
    useCreateSecret,
    useEditSecret,
    useDeleteSecret,
    useExportSecrets,
    useGenerateEnvExample,
    useImportSecrets,
} from '../hooks/useSecrets';
import { downloadTextFile } from '../lib/download';
import { parseEnvContent } from '../lib/envParser';
import { isApiError } from '../lib/errorHandling';
import type { Environment } from '../lib/permissions';

const VALID_ENVIRONMENTS: Environment[] = ['development', 'staging', 'production'];

function isValidEnvironment(env: string | null): env is Environment {
    return VALID_ENVIRONMENTS.includes(env as Environment);
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

    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [cursor, setCursor] = useState<string | null>(null);
    const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
    const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

    useEffect(() => {
        setCursor(null);
        setCursorHistory([]);
    }, [currentEnv]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setCursor(null);
            setCursorHistory([]);
        }, 250);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const { data, isLoading, isFetching, isError, error, refetch } = useSecretsPage(
        projectId!,
        currentEnv,
        {
            cursor,
            limit: 25,
            search: debouncedSearch || undefined,
        },
    );
    const secrets = data?.data ?? [];

    const handleNext = () => {
        if (!data?.nextCursor) return;
        setCursorHistory((prev) => [...prev, cursor]);
        setCursor(data.nextCursor);
    };

    const handlePrevious = () => {
        if (cursorHistory.length === 0) return;
        const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
        setCursorHistory((prev) => prev.slice(0, -1));
        setCursor(previousCursor);
    };

    const handleFirstPage = () => {
        if (cursorHistory.length === 0 && cursor === null) return;
        setCursor(null);
        setCursorHistory([]);
    };

    const handleCopyKey = async (secret: SecretResponse) => {
        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Clipboard unavailable');
            }
            await navigator.clipboard.writeText(secret.key);
            setCopiedKeyId(secret.id);
            setTimeout(() => {
                setCopiedKeyId((prev) => (prev === secret.id ? null : prev));
            }, 1500);
        } catch {
            toast.error('Unable to copy key to clipboard');
        }
    };

    const { can, isAdmin, isDeveloper } = usePermissions(projectId);

    const canCreate = can('secrets.create', currentEnv);
    const canEdit = can('secrets.edit', currentEnv);
    const canDelete = can('secrets.delete', currentEnv);
    const canReveal = can('secrets.reveal', currentEnv) === 'enabled';
    const canEnvExample = can('secrets.env-example', currentEnv) === 'enabled';
    const canImport = can('secrets.import', currentEnv);
    const canExport = can('secrets.export', currentEnv) === 'enabled';

    // Mutations
    const createMutation = useCreateSecret(projectId!, currentEnv);
    const editMutation = useEditSecret(projectId!, currentEnv);
    const deleteMutation = useDeleteSecret(projectId!, currentEnv);
    const envExampleMutation = useGenerateEnvExample(projectId!);
    const importMutation = useImportSecrets(projectId!, currentEnv);
    const exportMutation = useExportSecrets(projectId!, currentEnv);

    // Modals state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const [editingSecret, setEditingSecret] = useState<SecretResponse | null>(null);
    const [editError, setEditError] = useState<string | null>(null);

    const [deletingSecret, setDeletingSecret] = useState<SecretResponse | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const [isEnvExampleOpen, setIsEnvExampleOpen] = useState(false);
    const [envExampleData, setEnvExampleData] = useState<EnvExampleResponse | null>(null);
    const [envExampleError, setEnvExampleError] = useState<string | null>(null);
    const [copiedEnvExample, setCopiedEnvExample] = useState(false);

    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importMode, setImportMode] = useState<ImportSecretsMode>('skip_existing');
    const [importError, setImportError] = useState<string | null>(null);
    const importFileRef = useRef<HTMLInputElement>(null);

    const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [sidebarTarget, setSidebarTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setSidebarTarget(document.getElementById('project-sidebar-env-actions'));
    }, []);

    const parsedImport = useMemo(() => parseEnvContent(importText), [importText]);

    const { reset: resetExportMutation } = exportMutation;
    useEffect(() => {
        return () => {
            resetExportMutation();
        };
    }, [currentEnv, resetExportMutation]);

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

    const handleOpenEnvExample = async () => {
        setIsEnvExampleOpen(true);
        setEnvExampleData(null);
        setEnvExampleError(null);
        setCopiedEnvExample(false);
        try {
            const generated = await envExampleMutation.mutateAsync(currentEnv);
            setEnvExampleData(generated);
        } catch (err: unknown) {
            if (isApiError(err)) {
                setEnvExampleError(err.message || 'Failed to generate .env.example');
            } else {
                setEnvExampleError('Something went wrong — could not generate .env.example');
            }
        }
    };

    const handleCloseEnvExample = () => {
        setIsEnvExampleOpen(false);
        setEnvExampleData(null);
        setEnvExampleError(null);
        setCopiedEnvExample(false);
    };

    const handleCopyEnvExample = async () => {
        if (!envExampleData) return;
        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Clipboard unavailable');
            }
            await navigator.clipboard.writeText(envExampleData.content);
            setCopiedEnvExample(true);
            toast.success(`Copied ${envExampleData.filename} to clipboard`);
            setTimeout(() => setCopiedEnvExample(false), 1500);
        } catch {
            toast.error('Unable to copy .env.example to clipboard');
        }
    };

    const handleDownloadEnvExample = () => {
        if (!envExampleData) return;
        downloadTextFile(envExampleData.filename, envExampleData.content);
        toast.success(`Downloaded ${envExampleData.filename}`);
    };

    const handleOpenImport = () => {
        setImportText('');
        setImportMode('skip_existing');
        setImportError(null);
        if (importFileRef.current) importFileRef.current.value = '';
        setIsImportOpen(true);
    };

    const handleCloseImport = () => {
        if (importMutation.isPending) return;
        setIsImportOpen(false);
        setImportText('');
        setImportMode('skip_existing');
        setImportError(null);
        if (importFileRef.current) importFileRef.current.value = '';
    };

    const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        setImportError(null);
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 512 * 1024) {
            setImportError('File is too large. Maximum supported .env file size is 512 KB.');
            if (importFileRef.current) importFileRef.current.value = '';
            return;
        }
        try {
            const text = await file.text();
            setImportText(text);
        } catch {
            setImportError('Unable to read the selected file.');
        } finally {
            if (importFileRef.current) importFileRef.current.value = '';
        }
    };

    const onSubmitImport = async (event: React.FormEvent) => {
        event.preventDefault();
        setImportError(null);
        if (parsedImport.errors.length > 0 || parsedImport.entries.length === 0) return;
        try {
            const summary = await importMutation.mutateAsync({
                environment: currentEnv,
                mode: importMode,
                entries: parsedImport.entries,
            });
            toast.success(
                `Imported into ${currentEnv}: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped`,
            );
            setIsImportOpen(false);
            setImportText('');
            setImportMode('skip_existing');
            setImportError(null);
        } catch (err: unknown) {
            if (isApiError(err)) {
                setImportError(err.message || 'Failed to import secrets');
            } else {
                setImportError('Something went wrong — the import was not applied');
            }
        }
    };

    const runExport = async (confirm: boolean) => {
        setExportError(null);
        try {
            const result = await exportMutation.mutateAsync({ confirm });
            toast.success(
                result.count === 0
                    ? `Downloaded empty ${result.filename}`
                    : `Exported ${result.count} secret${result.count === 1 ? '' : 's'} to ${result.filename}`,
            );
            setIsExportConfirmOpen(false);
        } catch (err: unknown) {
            const message = isApiError(err)
                ? err.status === 429
                    ? 'Too many reveals, try again in 15 minutes'
                    : err.message || 'Failed to export secrets'
                : 'Something went wrong — could not export secrets';
            if (confirm) {
                setExportError(message);
            } else {
                toast.error(message);
            }
        } finally {
            exportMutation.reset();
        }
    };

    const handleClickExport = () => {
        if (exportMutation.isPending) return;
        if (currentEnv === 'production') {
            setExportError(null);
            setIsExportConfirmOpen(true);
            return;
        }
        void runExport(false);
    };

    const handleCloseExportConfirm = () => {
        if (exportMutation.isPending) return;
        setIsExportConfirmOpen(false);
        setExportError(null);
    };

    const disabledReason =
        'Developers can create and edit secrets only in the development environment.';

    const hasEnvActionButtons = canEnvExample || canImport !== 'hidden' || canExport;

    const envActionsPanel = hasEnvActionButtons ? (
        <div
            data-testid="env-actions-sidebar-card"
            className="rounded-3xl border border-base-300 bg-base-200 p-5 shadow-sm space-y-3"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="font-ui text-xs font-semibold uppercase tracking-wider text-base-content/60">
                    .env Actions
                </p>
                <span className="font-mono text-[11px] font-semibold uppercase text-base-content/60">
                    {currentEnv}
                </span>
            </div>
            <div className="flex flex-col gap-2">
                {canEnvExample && (
                    <button
                        type="button"
                        onClick={handleOpenEnvExample}
                        className="btn btn-ghost btn-sm h-9 w-full justify-start px-3 border border-base-300 rounded-xl font-semibold flex items-center gap-2 text-xs"
                    >
                        <svg
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        Generate .env.example
                    </button>
                )}
                {canImport !== 'hidden' && (
                    <div
                        className={
                            canImport === 'disabled' ? 'tooltip tooltip-left w-full' : 'w-full'
                        }
                        data-tip={canImport === 'disabled' ? disabledReason : undefined}
                    >
                        <button
                            type="button"
                            disabled={canImport === 'disabled'}
                            onClick={handleOpenImport}
                            className="btn btn-ghost btn-sm h-9 w-full justify-start px-3 border border-base-300 rounded-xl font-semibold flex items-center gap-2 text-xs disabled:opacity-40"
                        >
                            <svg
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Import .env
                        </button>
                    </div>
                )}
                {canExport && (
                    <button
                        type="button"
                        disabled={exportMutation.isPending}
                        onClick={handleClickExport}
                        className="btn btn-ghost btn-sm h-9 w-full justify-start px-3 border border-base-300 rounded-xl font-semibold flex items-center gap-2 text-xs disabled:opacity-40"
                    >
                        {exportMutation.isPending ? (
                            <span className="loading loading-spinner loading-xs" />
                        ) : (
                            <svg
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        )}
                        Export .env
                    </button>
                )}
            </div>
        </div>
    ) : null;

    return (
        <div className="space-y-6">
            {/* Top Bar: Environment Tabs + Search + New Secret Action */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <EnvironmentTabs
                    currentEnvironment={currentEnv}
                    onSelect={(env) => setSearchParams({ environment: env })}
                />

                <div className="flex flex-wrap items-center gap-2.5">
                    <SearchInput
                        value={searchInput}
                        onChange={setSearchInput}
                        placeholder="Search keys..."
                        ariaLabel="Search secret keys"
                        className="w-full sm:w-52"
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
                                className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl flex items-center gap-2 hover:opacity-90 disabled:opacity-40"
                            >
                                <svg
                                    aria-hidden="true"
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
            </div>

            {sidebarTarget && envActionsPanel
                ? createPortal(envActionsPanel, sidebarTarget)
                : envActionsPanel}

            {/* Secrets Table panel keyed by currentEnv to guarantee remount & unmount */}
            <div key={currentEnv} className="min-h-[32rem]">
                {isLoading ? (
                    <Skeleton shape="table" count={5} />
                ) : isError ? (
                    <ErrorState
                        message={isApiError(error) ? error.message : 'Failed to load secrets'}
                        onRetry={() => refetch()}
                    />
                ) : secrets.length > 0 ? (
                    <div className="space-y-4">
                        <div className="overflow-hidden rounded-3xl border border-base-300 bg-base-200 shadow-sm">
                            <table className="table w-full table-fixed text-sm">
                                <thead>
                                    <tr className="border-b border-base-300 font-heading text-xs text-base-content/60 uppercase tracking-wider">
                                        <th className="w-[42%] py-4 pl-6">Key</th>
                                        <th className="py-4">Value</th>
                                        <th className="w-24 py-4 pr-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base-300/60 font-ui">
                                    {secrets.map((secret) => (
                                        <tr
                                            key={secret.id}
                                            className="hover:bg-base-300/30 transition-colors"
                                        >
                                            {/* Key + Copy key icon */}
                                            <td className="py-4 pl-6 font-mono font-bold text-base-content tracking-tight">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className="truncate" title={secret.key}>
                                                        {secret.key}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyKey(secret)}
                                                        aria-label={`Copy key ${secret.key}`}
                                                        title={
                                                            copiedKeyId === secret.id
                                                                ? 'Copied!'
                                                                : 'Copy secret key'
                                                        }
                                                        className="btn btn-ghost btn-xs btn-square shrink-0 rounded-lg text-base-content/60 hover:text-primary"
                                                    >
                                                        {copiedKeyId === secret.id ? (
                                                            <svg
                                                                aria-hidden="true"
                                                                className="h-3.5 w-3.5 text-success"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2.2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <path d="M20 6 9 17l-5-5" />
                                                            </svg>
                                                        ) : (
                                                            <svg
                                                                aria-hidden="true"
                                                                className="h-3.5 w-3.5"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <rect
                                                                    width="14"
                                                                    height="14"
                                                                    x="8"
                                                                    y="8"
                                                                    rx="2"
                                                                    ry="2"
                                                                />
                                                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                                            </svg>
                                                        )}
                                                        <span className="sr-only">
                                                            {copiedKeyId === secret.id
                                                                ? 'Copied!'
                                                                : 'Copy'}
                                                        </span>
                                                    </button>
                                                </div>
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
                                                                onClick={() =>
                                                                    handleOpenEdit(secret)
                                                                }
                                                                className="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/70 hover:text-primary disabled:opacity-40"
                                                                aria-label={`Edit ${secret.key}`}
                                                                title={`Edit ${secret.key}`}
                                                            >
                                                                <svg
                                                                    aria-hidden="true"
                                                                    className="h-4 w-4"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                >
                                                                    <path d="M12 20h9" />
                                                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                                </svg>
                                                                <span className="sr-only">
                                                                    Edit
                                                                </span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {canDelete === 'enabled' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenDelete(secret)}
                                                            className="btn btn-ghost btn-xs btn-square rounded-lg text-error/80 hover:text-error hover:bg-error/10"
                                                            aria-label={`Delete ${secret.key}`}
                                                            title={`Delete ${secret.key}`}
                                                        >
                                                            <svg
                                                                aria-hidden="true"
                                                                className="h-4 w-4"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <path d="M3 6h18" />
                                                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                            </svg>
                                                            <span className="sr-only">Delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls
                            hasPrevious={cursorHistory.length > 0}
                            hasNext={Boolean(data?.hasMore && data?.nextCursor)}
                            onFirstPage={handleFirstPage}
                            onPrevious={handlePrevious}
                            onNext={handleNext}
                            pageNumber={cursorHistory.length + 1}
                            itemCount={secrets.length}
                            isFetching={isFetching}
                            noun="secrets"
                        />
                    </div>
                ) : debouncedSearch ? (
                    <EmptyState
                        title="No matching secrets"
                        description={`No keys in ${currentEnv} matched "${debouncedSearch}".`}
                        action={
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchInput('');
                                    setDebouncedSearch('');
                                    setCursor(null);
                                    setCursorHistory([]);
                                }}
                                className="btn btn-outline btn-sm rounded-xl"
                            >
                                Clear Search
                            </button>
                        }
                    />
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
                                    className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl"
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
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-error-content font-medium"
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
                            className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl text-sm"
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
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-error-content font-medium"
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
                            className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={editMutation.isPending}
                            className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl text-sm"
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

            {/* Generate .env.example Modal */}
            <Modal
                isOpen={isEnvExampleOpen}
                onClose={handleCloseEnvExample}
                title="Generate .env.example"
                maxWidth="lg"
            >
                <div className="space-y-4">
                    <p className="text-sm font-ui text-base-content/75">
                        Metadata-only template for{' '}
                        <span className="font-mono font-semibold text-base-content">
                            {currentEnv}
                        </span>
                        . Secret values are never included.
                    </p>

                    {envExampleMutation.isPending ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-sm text-base-content/70">
                            <span className="loading loading-spinner loading-sm" />
                            <span>Generating template...</span>
                        </div>
                    ) : envExampleError ? (
                        <div
                            role="alert"
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-error-content font-medium"
                        >
                            <span>{envExampleError}</span>
                        </div>
                    ) : envExampleData ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono text-base-content/70">
                                <span>{envExampleData.filename}</span>
                                <span>Keys only (empty values)</span>
                            </div>
                            <pre
                                data-testid="env-example-preview"
                                className="max-h-72 overflow-y-auto rounded-2xl border border-base-300 bg-base-300/70 p-4 font-mono text-xs text-base-content whitespace-pre-wrap break-all"
                            >
                                {envExampleData.content}
                            </pre>
                        </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-base-300">
                        <button
                            type="button"
                            onClick={handleCloseEnvExample}
                            className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={handleCopyEnvExample}
                            disabled={!envExampleData || envExampleMutation.isPending}
                            className="btn btn-ghost btn-sm h-9 px-3 border border-base-300 rounded-xl font-semibold text-sm disabled:opacity-40"
                        >
                            {copiedEnvExample ? 'Copied!' : 'Copy .env.example'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadEnvExample}
                            disabled={!envExampleData || envExampleMutation.isPending}
                            className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl text-sm disabled:opacity-40"
                        >
                            Download .env.example
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Import .env Modal */}
            <Modal
                isOpen={isImportOpen}
                onClose={handleCloseImport}
                title={`Import .env (${currentEnv})`}
                maxWidth="lg"
            >
                <form onSubmit={onSubmitImport} className="space-y-4" noValidate>
                    <p className="text-sm font-ui text-base-content/75">
                        Upload a <code className="font-mono">.env</code> file or paste{' '}
                        <code className="font-mono">KEY=value</code> lines to encrypt and import
                        into{' '}
                        <span className="font-mono font-semibold text-base-content">
                            {currentEnv}
                        </span>
                        . All entries and audit records commit atomically.
                    </p>

                    {importError && (
                        <div
                            role="alert"
                            className="alert alert-error text-sm rounded-xl py-2 px-3 text-error-content font-medium"
                        >
                            <span>{importError}</span>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="btn btn-ghost btn-sm h-9 px-3 border border-base-300 rounded-xl font-semibold text-xs cursor-pointer">
                            Upload .env file
                            <input
                                ref={importFileRef}
                                type="file"
                                accept=".env,.txt,text/plain"
                                onChange={handleImportFileChange}
                                disabled={importMutation.isPending}
                                aria-label="Upload .env file"
                                className="sr-only"
                            />
                        </label>

                        <div className="flex items-center gap-4 text-xs font-ui">
                            <span className="text-base-content/70 font-medium">Conflict mode:</span>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="radio"
                                    name="importMode"
                                    value="skip_existing"
                                    checked={importMode === 'skip_existing'}
                                    onChange={() => setImportMode('skip_existing')}
                                    disabled={importMutation.isPending}
                                    className="radio radio-primary radio-xs"
                                />
                                <span>Skip existing</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="radio"
                                    name="importMode"
                                    value="overwrite"
                                    checked={importMode === 'overwrite'}
                                    onChange={() => setImportMode('overwrite')}
                                    disabled={importMutation.isPending}
                                    className="radio radio-primary radio-xs"
                                />
                                <span>Overwrite</span>
                            </label>
                        </div>
                    </div>

                    <FormField
                        label="Paste .env content"
                        hint="Up to 100 entries. Comments (#) and blank lines are ignored."
                    >
                        {({ id, ...props }) => (
                            <textarea
                                id={id}
                                rows={5}
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                disabled={importMutation.isPending}
                                placeholder={'DATABASE_URL=postgres://...\nAPI_KEY=your-key'}
                                className="textarea textarea-bordered w-full bg-base-300 rounded-xl focus:border-primary text-xs font-mono"
                                {...props}
                            />
                        )}
                    </FormField>

                    {parsedImport.errors.length > 0 && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-error/40 bg-error/10 p-3 text-xs text-error space-y-1"
                        >
                            <p className="font-semibold">Fix these lines before importing:</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {parsedImport.errors.slice(0, 5).map((errMsg, idx) => (
                                    <li key={idx}>{errMsg}</li>
                                ))}
                                {parsedImport.errors.length > 5 && (
                                    <li>
                                        ...and {parsedImport.errors.length - 5} more validation
                                        issue(s)
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}

                    {parsedImport.duplicateKeys.length > 0 && (
                        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
                            Duplicate keys detected ({parsedImport.duplicateKeys.join(', ')}) — the
                            last occurrence will be used.
                        </div>
                    )}

                    {parsedImport.entries.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-base-content/70">
                                <span className="font-semibold">
                                    Preview ({parsedImport.entries.length}{' '}
                                    {parsedImport.entries.length === 1 ? 'key' : 'keys'})
                                </span>
                                <span>Values masked</span>
                            </div>
                            <div className="max-h-40 overflow-y-auto rounded-2xl border border-base-300 bg-base-300/50">
                                <table
                                    data-testid="import-preview-table"
                                    className="table table-xs w-full font-mono"
                                >
                                    <thead>
                                        <tr className="border-b border-base-300 text-base-content/60">
                                            <th>Key</th>
                                            <th className="text-right">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedImport.entries.map((entry) => (
                                            <tr key={entry.key}>
                                                <td className="font-semibold text-base-content">
                                                    {entry.key}
                                                </td>
                                                <td className="text-right text-base-content/60">
                                                    {MASKED_SECRET_VALUE}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
                        <button
                            type="button"
                            onClick={handleCloseImport}
                            disabled={importMutation.isPending}
                            className="btn btn-ghost btn-sm h-9 rounded-xl text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={
                                importMutation.isPending ||
                                parsedImport.entries.length === 0 ||
                                parsedImport.errors.length > 0
                            }
                            className="btn btn-primary btn-sm h-9 px-4 text-primary-content font-semibold rounded-xl text-sm disabled:opacity-40"
                        >
                            {importMutation.isPending ? (
                                <span className="flex items-center gap-2">
                                    <span className="loading loading-spinner loading-xs" />
                                    Importing...
                                </span>
                            ) : (
                                `Import ${parsedImport.entries.length || ''} ${
                                    parsedImport.entries.length === 1 ? 'Secret' : 'Secrets'
                                }`.trim()
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Production Export Confirmation Dialog */}
            <ConfirmDialog
                isOpen={isExportConfirmOpen}
                onClose={handleCloseExportConfirm}
                onConfirm={() => void runExport(true)}
                title="Export Production Secrets"
                body={
                    <span>
                        You are about to decrypt and download all secrets in{' '}
                        <strong className="font-mono font-bold text-error">production</strong> as{' '}
                        <code className="font-mono">.env.production</code>. Every exported secret
                        will be recorded in the project audit log.
                    </span>
                }
                confirmLabel="Confirm Export"
                tone="danger"
                isLoading={exportMutation.isPending}
                error={exportError}
            />
        </div>
    );
}

export default SecretsPage;
