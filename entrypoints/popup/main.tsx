import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import { Toaster } from "@/components/ui/toaster";
import { applyDocumentLocale, loadInitialLocale } from "@/lib/i18nLocale";
import { i18nConfig } from "@/components/i18nConfig.ts";
import initTranslations from "@/components/i18n.ts";
import { ThemeProvider } from "@/components/theme-provider.tsx";

async function initApp() {
  // 已保存的语言设置优先，否则使用浏览器语言
  const locale = await loadInitialLocale();
  applyDocumentLocale(locale);

  try {
    // 初始化国际化
    await initTranslations(locale, ["common", "popup"]);
  } catch (error) {
    console.error('Failed to initialize translations:', error);
    // Fallback? Try initializing with default locale if standard locale failed
    try {
      await initTranslations(i18nConfig.defaultLocale, ["common", "popup"]);
    } catch (e) {
      console.error('Critical: Failed to initialize fallback translations', e);
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <React.Suspense fallback={<div className="flex items-center justify-center min-h-[140px] text-muted-foreground text-sm">Loading...</div>}>
        <ThemeProvider>
          <App />
          <Toaster />
        </ThemeProvider>
      </React.Suspense>
    </React.StrictMode>,
  );
}

initApp().catch(e => {
  console.error('Critical failure in initApp:', e);
  // Ensure we render SOMETHING even if everything blew up
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div style={{ padding: 20 }}>
      <h1>Fatal Error</h1>
      <p>Failed to initialize popup.</p>
    </div>
  );
});
