import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME_STATE, resolveThemeState } from '@/lib/theme';

describe('resolveThemeState', () => {
    it('returns defaults when storage is empty', () => {
        expect(resolveThemeState({})).toEqual(DEFAULT_THEME_STATE);
    });

    it('uses legacy theme value as themeMode', () => {
        expect(resolveThemeState({ theme: 'dark' })).toEqual({
            themeMode: 'dark',
            themeId: 'default'
        });
    });

    it('prefers explicit themeMode and themeId over legacy values', () => {
        expect(resolveThemeState({
            theme: 'light',
            themeMode: 'auto',
            themeId: 'blueprint'
        })).toEqual({
            themeMode: 'auto',
            themeId: 'blueprint'
        });
    });
});
