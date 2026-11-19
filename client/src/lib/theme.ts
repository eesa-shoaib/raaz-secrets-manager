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

export const THEME_LOGO_COLORS: Record<ThemeId, { highlight: string; mid: string; dark: string }> =
    {
        default: {
            highlight: 'rgb(180, 210, 0)',
            mid: '#637300',
            dark: '#2e3600',
        },
        midnight: {
            highlight: '#06b6d4',
            mid: '#0284c7',
            dark: '#0c4a6e',
        },
        emerald: {
            highlight: '#10b981',
            mid: '#059669',
            dark: '#064e3b',
        },
        amethyst: {
            highlight: '#f43f5e',
            mid: '#c084fc',
            dark: '#4c0519',
        },
    };

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

        // Update favicon dynamically to reflect active palette
        const faviconLink = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (faviconLink) {
            const highlight = THEME_LOGO_COLORS[theme]?.highlight || 'rgb(180, 210, 0)';
            const rPath =
                'M43.669 727.629Q28.602 741.58 21.51 732.28Q14.418 722.979 13.597 698.952Q12.775 674.925 17.999 646.248Q23.223 617.57 33.198 591.993Q43.173 566.416 57.217 552.465L323.312 301.345L296.34 436.206L130.693 185.085Q122.23 171.134 122.485 145.557Q122.741 119.98 129.143 90.527Q135.545 61.075 145.978 37.048Q156.41 13.021 167.222 3.72Q178.034 -5.58 187.521 8.371L331.326 233.139Q355.601 270.342 336.38 366.45Q326.459 416.054 312.12 449.382Q297.781 482.709 277.382 502.861Z';
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#1f2334" stroke="${highlight}" stroke-opacity=".5" stroke-width="2"/><svg x="22" y="11" width="20" height="42" viewBox="-14 -14 405.3 809.9"><path d="${rPath}" fill="${highlight}"/></svg></svg>`;
            faviconLink.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        }
    } catch {
        // localStorage may throw in restricted sandboxes
    }
}
