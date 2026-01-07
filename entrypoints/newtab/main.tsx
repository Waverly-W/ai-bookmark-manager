import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { BackgroundProvider } from "@/components/background-provider.tsx";
import { i18nConfig } from "@/components/i18nConfig.ts";
import initTranslations from "@/components/i18n.ts";
async function initApp() {
    // 初始化国际化
    await initTranslations(i18nConfig.defaultLocale, ["common", "newtab"]);

    // 渲染应用
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <ThemeProvider>
                <BackgroundProvider>
                    <App />
                </BackgroundProvider>
            </ThemeProvider>
        </React.StrictMode>,
    );
}

initApp().catch(console.error);
