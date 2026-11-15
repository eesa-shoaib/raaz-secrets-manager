import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as secretsApi from '../api/secrets';
import { useExportSecrets } from './useSecrets';

vi.mock('../api/secrets', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../api/secrets')>();
    return {
        ...actual,
        exportSecrets: vi.fn(),
    };
});

describe('useExportSecrets cache hygiene', () => {
    const createObjectUrlMock = vi.fn(() => 'blob:raaz-export-url');
    const revokeObjectUrlMock = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    beforeEach(() => {
        vi.clearAllMocks();
        URL.createObjectURL = createObjectUrlMock;
        URL.revokeObjectURL = revokeObjectUrlMock;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('downloads via Blob, immediately revokes URL, and never retains plaintext in TanStack caches', async () => {
        const SECRET_PLAINTEXT = 'ULTRA_SENSITIVE_PROD_TOKEN_987654';
        vi.mocked(secretsApi.exportSecrets).mockResolvedValueOnce({
            filename: '.env.production',
            content: `# Vault (production)\nAPI_TOKEN=${SECRET_PLAINTEXT}\n`,
            count: 1,
        });

        const client = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        });
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );

        const { result, unmount } = renderHook(() => useExportSecrets('proj-1', 'production'), {
            wrapper,
        });

        await act(async () => {
            await result.current.mutateAsync({ confirm: true });
            result.current.reset();
        });

        expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:raaz-export-url');

        const queryDump = JSON.stringify(
            client
                .getQueryCache()
                .getAll()
                .map((q) => q.state.data),
        );
        const mutationDump = JSON.stringify(
            client
                .getMutationCache()
                .getAll()
                .map((m) => m.state.data),
        );

        expect(queryDump).not.toContain(SECRET_PLAINTEXT);
        expect(mutationDump).not.toContain(SECRET_PLAINTEXT);
        expect(result.current.data).toBeUndefined();

        unmount();
    });
});
