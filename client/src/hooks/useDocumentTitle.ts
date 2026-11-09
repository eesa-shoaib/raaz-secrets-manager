import { useLayoutEffect } from 'react';

export function useDocumentTitle(title: string | undefined) {
    useLayoutEffect(() => {
        if (title === undefined) return;

        document.title = title;
        window.history.replaceState(
            {
                ...window.history.state,
                raazTitle: { pathname: window.location.pathname, title },
            },
            '',
        );
        return () => {
            document.title = 'Raaz';
        };
    }, [title]);
}
