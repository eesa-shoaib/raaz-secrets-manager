import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle';

it('updates the tab title and restores Raaz when leaving the page', () => {
    const { rerender, unmount } = renderHook(({ title }) => useDocumentTitle(title), {
        initialProps: { title: 'sign in' },
    });
    expect(document.title).toBe('sign in');
    rerender({ title: 'sign up' });
    expect(document.title).toBe('sign up');
    rerender({ title: 'Selected project' });
    expect(document.title).toBe('Selected project');
    unmount();
    expect(document.title).toBe('Raaz');
});
