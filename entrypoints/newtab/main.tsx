import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import {ThemeProvider} from "@/components/theme-provider.tsx";
import {i18nConfig} from "@/components/i18nConfig.ts";
import initTranslations from "@/components/i18n.ts";
import { initializeAccentColor } from "@/lib/accentColorUtils";

async function initApp() {
    // 初始化国际化
    await initTranslations(i18nConfig.defaultLocale, ["common", "newtab"]);

    // 初始化强调色
    await initializeAccentColor();

    // 渲染应用
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <ThemeProvider>
                <App/>
            </ThemeProvider>
        </React.StrictMode>,
    );
}

initApp().catch(console.error);
