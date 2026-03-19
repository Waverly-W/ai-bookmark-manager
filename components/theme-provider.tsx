import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { browser } from "wxt/browser";

type ThemeMode = 'light' | 'dark' | 'auto';

const ThemeContext = createContext<{ theme: ThemeMode, resolvedTheme: 'light' | 'dark', toggleTheme: (theme: ThemeMode) => void }>({
    theme: 'light',
    resolvedTheme: 'light',
    toggleTheme: () => {
    }
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: any }) => {
    const [theme, setTheme] = useState<ThemeMode>('light');
    const [systemPrefersDark, setSystemPrefersDark] = useState(false);

    const toggleTheme = (theme: ThemeMode) => {
        setTheme(theme);
    };

    async function initTheme() {
        const result = await browser.storage.local.get('theme');
        const theme = result['theme'] as ThemeMode | undefined;
        if (theme) {
            setTheme(theme)
        }
    }

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
        initTheme();
    }, []);

    const resolvedTheme = useMemo<'light' | 'dark'>(() => {
        if (theme === 'auto') {
            return systemPrefersDark ? 'dark' : 'light';
        }
        return theme;
    }, [systemPrefersDark, theme]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
        document.documentElement.dataset.theme = theme;
    }, [resolvedTheme, theme]);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
