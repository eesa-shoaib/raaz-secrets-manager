import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentTabs } from './EnvironmentTabs';

describe('environment selector', () => {
    afterEach(cleanup);
    it('indicates the current environment and selects another', () => {
        const onSelect = vi.fn();
        render(<EnvironmentTabs currentEnvironment="development" onSelect={onSelect} />);
        expect(
            screen.getByRole('button', { name: 'Development' }).getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
            screen.getByRole('button', { name: 'Production' }).getAttribute('aria-pressed'),
        ).toBe('false');
        fireEvent.click(screen.getByRole('button', { name: 'Production' }));
        expect(onSelect).toHaveBeenCalledWith('production');
    });
});
