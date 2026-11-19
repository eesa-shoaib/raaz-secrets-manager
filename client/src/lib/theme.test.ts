import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    applyTheme,
    DEFAULT_THEME,
    getStoredTheme,
    isThemeId,
    THEMES,
    THEME_LOGO_COLORS,
    THEME_STORAGE_KEY,
    VALID_THEME_IDS,
} from './theme';

describe('theme library', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    afterEach(() => {
        window.localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    it('defines 4 distinct palettes with required swatch colors and descriptions', () => {
        expect(THEMES).toHaveLength(4);
        expect(VALID_THEME_IDS).toEqual(['default', 'midnight', 'emerald', 'amethyst']);
        const ids = THEMES.map((t) => t.id);
        expect(ids).toEqual(['default', 'midnight', 'emerald', 'amethyst']);

        THEMES.forEach((theme) => {
            expect(theme.name).toBeTruthy();
            expect(theme.description).toBeTruthy();
            expect(theme.swatch.base).toBeTruthy();
            expect(theme.swatch.surface).toBeTruthy();
            expect(theme.swatch.primary).toBeTruthy();
            expect(theme.swatch.accent).toBeTruthy();
            expect(theme.swatch.text).toBeTruthy();
        });
    });

    it('identifies valid theme ids with isThemeId', () => {
        expect(isThemeId('default')).toBe(true);
        expect(isThemeId('midnight')).toBe(true);
        expect(isThemeId('emerald')).toBe(true);
        expect(isThemeId('amethyst')).toBe(true);
        expect(isThemeId('invalid-theme')).toBe(false);
        expect(isThemeId('')).toBe(false);
        expect(isThemeId(null)).toBe(false);
        expect(isThemeId(undefined)).toBe(false);
    });

    it('returns DEFAULT_THEME when storage is empty or invalid', () => {
        expect(getStoredTheme()).toBe(DEFAULT_THEME);

        window.localStorage.setItem(THEME_STORAGE_KEY, 'corrupted_theme');
        expect(getStoredTheme()).toBe(DEFAULT_THEME);
    });

    it('maps legacy coffee token to default theme for backwards compatibility', () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, 'coffee');
        expect(getStoredTheme()).toBe('default');
    });

    it('reads valid stored theme from localStorage', () => {
        window.localStorage.setItem(THEME_STORAGE_KEY, 'midnight');
        expect(getStoredTheme()).toBe('midnight');

        window.localStorage.setItem(THEME_STORAGE_KEY, 'emerald');
        expect(getStoredTheme()).toBe('emerald');

        window.localStorage.setItem(THEME_STORAGE_KEY, 'amethyst');
        expect(getStoredTheme()).toBe('amethyst');
    });

    it('defines logo colors for all theme ids in THEME_LOGO_COLORS', () => {
        VALID_THEME_IDS.forEach((id) => {
            const colors = THEME_LOGO_COLORS[id];
            expect(colors).toBeDefined();
            expect(colors.highlight).toBeTruthy();
            expect(colors.mid).toBeTruthy();
            expect(colors.dark).toBeTruthy();
        });
    });

    it('applies theme to documentElement attribute and persists to localStorage', () => {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = '/favicon.svg';
        document.head.appendChild(link);

        applyTheme('midnight');
        expect(document.documentElement.getAttribute('data-theme')).toBe('midnight');
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('midnight');
        expect(link.href).toContain('data:image/svg+xml');

        applyTheme('emerald');
        expect(document.documentElement.getAttribute('data-theme')).toBe('emerald');
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('emerald');
        expect(link.href).toContain('data:image/svg+xml');

        link.remove();
    });
});
