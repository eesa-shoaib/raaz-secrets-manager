import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from './Logo';
import { ShortLogo } from './ShortLogo';

describe('Logo and ShortLogo SVG components', () => {
    afterEach(cleanup);

    it('renders ShortLogo SVG with role and aria-label', () => {
        const { container } = render(<ShortLogo className="h-14 w-auto" />);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute('viewBox')).toBe('-14.0 -14.0 405.3 809.9');
        expect(svg?.getAttribute('aria-label')).toBe('Raaz');
        expect(svg?.getAttribute('role')).toBe('img');
        expect(svg?.classList.contains('h-14')).toBe(true);
        expect(svg?.classList.contains('w-auto')).toBe(true);
    });

    it('renders full Logo SVG with role, aria-label and wordmark', () => {
        const { container } = render(<Logo className="h-10 w-auto" />);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute('viewBox')).toBe('517.9 -72.0 1589.1 809.9');
        expect(svg?.getAttribute('aria-label')).toBe('Raaz');
        expect(svg?.getAttribute('role')).toBe('img');
        expect(svg?.classList.contains('h-10')).toBe(true);
        expect(svg?.classList.contains('w-auto')).toBe(true);
    });
});
