export type ThemeId = 'default' | 'midnight' | 'emerald' | 'amethyst';

export interface ThemeMeta {
    id: ThemeId;
    name: string;
    description: string;
    swatch: {
        base: string; // base-100 preview hex/rgb
        surface: string; // base-200 preview hex/rgb
        primary: string; // primary preview hex/rgb
        accent: string; // accent / secondary preview hex/rgb
        text: string; // base-content preview hex/rgb
    };
}

export const THEME_STORAGE_KEY = 'raaz_theme';
export const DEFAULT_THEME: ThemeId = 'default';

export const THEMES: readonly ThemeMeta[] = [
    {
        id: 'default',
        name: 'Default',
        description: 'Original dark indigo with vibrant electric lime',
        swatch: {
            base: 'rgb(48, 54, 78)',
            surface: 'rgb(39, 44, 65)',
            primary: 'rgb(180, 210, 0)',
            accent: '#38bdf8',
            text: 'rgb(245, 243, 187)',
        },
    },
    {
        id: 'midnight',
        name: 'Midnight',
        description: 'Deep obsidian space with electric cyan and slate',
        swatch: {
            base: '#161922',
            surface: '#1e2230',
            primary: '#06b6d4',
            accent: '#818cf8',
            text: '#f1f5f9',
        },
    },
    {
        id: 'emerald',
        name: 'Nordic Forest',
        description: 'Deep evergreen pine with radiant jade emerald',
        swatch: {
            base: '#15221e',
            surface: '#1c2d27',
            primary: '#10b981',
            accent: '#2dd4bf',
            text: '#e6f4ea',
        },
    },
    {
        id: 'amethyst',
        name: 'Velvet Sunset',
        description: 'Rich velvet plum with radiant coral rose',
        swatch: {
            base: '#221727',
            surface: '#2d1f34',
            primary: '#f43f5e',
            accent: '#c084fc',
            text: '#fce7f3',
        },
    },
];

export const VALID_THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id);

export function isThemeId(value: unknown): value is ThemeId {
    return typeof value === 'string' && (VALID_THEME_IDS as readonly string[]).includes(value);
}

export function getStoredTheme(): ThemeId {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        // Also map legacy 'coffee' token to 'default'
        if (stored === 'coffee') return 'default';
        if (isThemeId(stored)) return stored;
    } catch {
        // localStorage may throw in restricted sandboxes
    }
    return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId): void {
    if (typeof document === 'undefined') return;
    try {
        document.documentElement.setAttribute('data-theme', theme);
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // localStorage may throw in restricted sandboxes
    }
}
