import { runInNewContext } from 'node:vm';
import { renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import html from '../../index.html?raw';
import { useDocumentTitle } from './useDocumentTitle';

const originalState = window.history.state;
afterEach(() => {
    window.history.replaceState(originalState, '');
    document.title = 'Raaz';
});

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

it('saves the title without overwriting router history state', () => {
    window.history.replaceState({ idx: 2, key: 'route-key', usr: { from: '/projects' } }, '');
    const { unmount } = renderHook(() => useDocumentTitle('Selected project'));
    expect(window.history.state).toEqual({
        idx: 2,
        key: 'route-key',
        usr: { from: '/projects' },
        raazTitle: { pathname: window.location.pathname, title: 'Selected project' },
    });
    unmount();
});

it('preserves the restored title while project data is loading', () => {
    document.title = 'Selected project';
    const { rerender, unmount } = renderHook(
        ({ title }: { title: string | undefined }) => useDocumentTitle(title),
        { initialProps: { title: undefined as string | undefined } },
    );
    expect(document.title).toBe('Selected project');
    rerender({ title: 'Renamed project' });
    expect(document.title).toBe('Renamed project');
    unmount();
});

const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)![1];

it('restores the project title from the matching history entry before React loads', () => {
    const pathname = '/projects/aaaaaaaaaaaaaaaaaaaaaaaa/secrets';
    const doc = { title: 'Raaz' };
    runInNewContext(bootstrap, {
        window: {
            location: { pathname },
            history: { state: { raazTitle: { pathname, title: 'Selected project' } } },
        },
        document: doc,
    });
    expect(doc.title).toBe('Selected project');
});

it.each([
    ['/projects', 'Raaz'],
    ['/login', 'sign in'],
    ['/signup', 'sign up'],
])('ignores a title from a different route on %s', (pathname, expected) => {
    const doc = { title: 'Raaz' };
    runInNewContext(bootstrap, {
        window: {
            location: { pathname },
            history: { state: { raazTitle: { pathname: '/other', title: 'Other project' } } },
        },
        document: doc,
    });
    expect(doc.title).toBe(expected);
});
