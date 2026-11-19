import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    applyTheme,
    getStoredTheme,
    isThemeId,
    THEMES,
    THEME_STORAGE_KEY,
    type ThemeId,
    type ThemeMeta,
} from '../lib/theme';

export interface ThemeContextValue {
    theme: ThemeId;
    setTheme: (theme: ThemeId) => void;
    themes: readonly ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeId>(() => getStoredTheme());

    const setTheme = (newTheme: ThemeId) => {
        setThemeState(newTheme);
        applyTheme(newTheme);
    };

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === THEME_STORAGE_KEY && isThemeId(event.newValue)) {
                setThemeState(event.newValue);
                applyTheme(event.newValue);
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
