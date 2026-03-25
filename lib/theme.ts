export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedThemeMode = 'light' | 'dark';
export type ThemeId = 'default' | 'blueprint';

export interface ThemeState {
    themeMode: ThemeMode;
    themeId: ThemeId;
}

export interface ThemeChangePayload extends ThemeState {}

export interface ThemeDefinition {
    id: ThemeId;
    labelKey: string;
    descriptionKey: string;
    previewClassName: string;
}

export const THEME_MODE_STORAGE_KEY = 'themeMode';
export const THEME_ID_STORAGE_KEY = 'themeId';
export const LEGACY_THEME_STORAGE_KEY = 'theme';

export const DEFAULT_THEME_STATE: ThemeState = {
    themeMode: 'light',
    themeId: 'default'
};

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'auto'];

export const THEME_DEFINITIONS: ThemeDefinition[] = [
    {
        id: 'default',
        labelKey: 'themeDefault',
        descriptionKey: 'themeDefaultDescription',
        previewClassName: 'bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--surface-2))_100%)]'
    },
    {
        id: 'blueprint',
        labelKey: 'themeBlueprint',
        descriptionKey: 'themeBlueprintDescription',
        previewClassName:
            'bg-[#1e3a5f] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:18px_18px] bg-[#1e3a5f]'
    }
];

export function isThemeMode(value: unknown): value is ThemeMode {
    return value === 'light' || value === 'dark' || value === 'auto';
}

export function isThemeId(value: unknown): value is ThemeId {
    return value === 'default' || value === 'blueprint';
}

export function resolveThemeState(storage: Record<string, unknown>): ThemeState {
    const themeMode = isThemeMode(storage[THEME_MODE_STORAGE_KEY])
        ? storage[THEME_MODE_STORAGE_KEY]
        : isThemeMode(storage[LEGACY_THEME_STORAGE_KEY])
            ? storage[LEGACY_THEME_STORAGE_KEY]
            : DEFAULT_THEME_STATE.themeMode;

    const themeId = isThemeId(storage[THEME_ID_STORAGE_KEY])
        ? storage[THEME_ID_STORAGE_KEY]
        : DEFAULT_THEME_STATE.themeId;

    return {
        themeMode,
        themeId
    };
}
