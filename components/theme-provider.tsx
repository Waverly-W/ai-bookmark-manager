import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { browser } from "wxt/browser";

import { MessageType } from "@/entrypoints/types.ts";
import {
    DEFAULT_THEME_STATE,
    LEGACY_THEME_STORAGE_KEY,
    ResolvedThemeMode,
    THEME_ID_STORAGE_KEY,
    THEME_MODE_STORAGE_KEY,
    ThemeChangePayload,
    ThemeId,
    ThemeMode,
    ThemeState,
    resolveThemeState
} from "@/lib/theme";

interface ThemeContextValue extends ThemeState {
    resolvedTheme: ResolvedThemeMode;
    setThemeMode: (themeMode: ThemeMode) => Promise<void>;
    setThemeId: (themeId: ThemeId) => Promise<void>;
    applyTheme: (nextTheme: Partial<ThemeState>) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
    ...DEFAULT_THEME_STATE,
    resolvedTheme: 'light',
    setThemeMode: async () => {},
    setThemeId: async () => {},
    applyTheme: async () => {}
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [themeState, setThemeState] = useState<ThemeState>(DEFAULT_THEME_STATE);
    const [systemPrefersDark, setSystemPrefersDark] = useState(false);

    const persistThemeState = async (nextThemeState: ThemeState) => {
        setThemeState(nextThemeState);
        await browser.storage.local.set({
            [THEME_MODE_STORAGE_KEY]: nextThemeState.themeMode,
            [THEME_ID_STORAGE_KEY]: nextThemeState.themeId
        });

        const payload: ThemeChangePayload = {
            themeMode: nextThemeState.themeMode,
            themeId: nextThemeState.themeId
        };

        try {
            await browser.runtime.sendMessage({
                messageType: MessageType.changeTheme,
                content: payload
            });
        } catch (error) {
            console.log("Theme message sending failed:", error);
        }
    };

    const applyTheme = async (nextTheme: Partial<ThemeState>) => {
        const nextThemeState: ThemeState = {
            ...themeState,
            ...nextTheme
        };
        await persistThemeState(nextThemeState);
    };

    const setThemeMode = async (themeMode: ThemeMode) => {
        await applyTheme({ themeMode });
    };

    const setThemeId = async (themeId: ThemeId) => {
        await applyTheme({ themeId });
    };

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (event: MediaQueryListEvent) => {
            setSystemPrefersDark(event.matches);
        };

        setSystemPrefersDark(mediaQuery.matches);
        mediaQuery.addEventListener?.('change', handleChange);

        return () => {
            mediaQuery.removeEventListener?.('change', handleChange);
        };
    }, []);

    useEffect(() => {
        async function initTheme() {
            const result = await browser.storage.local.get([
                THEME_MODE_STORAGE_KEY,
                THEME_ID_STORAGE_KEY,
                LEGACY_THEME_STORAGE_KEY
            ]);
            const resolvedState = resolveThemeState(result);
            setThemeState(resolvedState);

            if (result[THEME_MODE_STORAGE_KEY] === undefined || result[THEME_ID_STORAGE_KEY] === undefined) {
                await browser.storage.local.set({
                    [THEME_MODE_STORAGE_KEY]: resolvedState.themeMode,
                    [THEME_ID_STORAGE_KEY]: resolvedState.themeId
                });
            }
        }

        const handleMessage = (message: { messageType?: MessageType; content?: ThemeChangePayload | string }) => {
            if (message.messageType !== MessageType.changeTheme) {
                return;
            }

            if (typeof message.content === 'string') {
                setThemeState((current) => ({
                    ...current,
                    themeMode: message.content as ThemeMode
                }));
                return;
            }

            if (message.content && typeof message.content === 'object' && !Array.isArray(message.content)) {
                const payload = message.content as Partial<ThemeChangePayload>;
                setThemeState((current) => ({
                    ...current,
                    ...payload
                }));
            }
        };

        initTheme().catch(console.error);
        browser.runtime.onMessage.addListener(handleMessage);

        return () => {
            browser.runtime.onMessage.removeListener(handleMessage);
        };
    }, []);

    const resolvedTheme = useMemo<ResolvedThemeMode>(() => {
        if (themeState.themeMode === 'auto') {
            return systemPrefersDark ? 'dark' : 'light';
        }
        return themeState.themeMode;
    }, [systemPrefersDark, themeState.themeMode]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
        document.documentElement.dataset.theme = themeState.themeMode;
        document.documentElement.dataset.themeId = themeState.themeId;
    }, [resolvedTheme, themeState.themeId, themeState.themeMode]);

    return (
        <ThemeContext.Provider
            value={{
                themeMode: themeState.themeMode,
                themeId: themeState.themeId,
                resolvedTheme,
                setThemeMode,
                setThemeId,
                applyTheme
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};
