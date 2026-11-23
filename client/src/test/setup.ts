// Vitest 1 can preserve Node's native storage globals instead of jsdom's.
// Without a storage file, Node 26 exposes localStorage as undefined.
function memoryStorage(): Storage {
    const entries = new Map<string, string>();
    return {
        get length() {
            return entries.size;
        },
        clear: () => entries.clear(),
        getItem: (key) => entries.get(String(key)) ?? null,
        key: (index) => Array.from(entries.keys())[index] ?? null,
        removeItem: (key) => {
            entries.delete(String(key));
        },
        setItem: (key, value) => {
            entries.set(String(key), String(value));
        },
    };
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (typeof window[name] === 'undefined') {
        Object.defineProperty(window, name, { configurable: true, value: memoryStorage() });
    }
}
