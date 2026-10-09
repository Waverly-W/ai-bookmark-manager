import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { BackgroundProvider } from "@/components/background-provider.tsx";
import initTranslations from "@/components/i18n.ts";
import { applyDocumentLocale, loadInitialLocale } from "@/lib/i18nLocale";
async function initApp() {
    // 初始化国际化
    // 已保存的语言设置优先，否则使用浏览器语言
    const locale = await loadInitialLocale();
    await initTranslations(locale, ["common", "newtab"]);
    applyDocumentLocale(locale);

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
