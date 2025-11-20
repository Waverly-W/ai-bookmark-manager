// ThemeContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { browser } from "wxt/browser";
import { configSyncManager } from "@/lib/configSyncManager";

const ThemeContext = createContext<{ theme: string, toggleTheme: Function }>({
    theme: 'light', toggleTheme: (theme: string) => {
    }
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: any }) => {
    const [theme, setTheme] = useState('light');

    const toggleTheme = (theme: string) => {
        setTheme(theme);
    };

    async function initTheme() {
        const theme = await configSyncManager.get('theme');
        if (theme) {
            setTheme(theme)
        }
    }

    useEffect(() => {
        initTheme();
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};