import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from '@/components/theme-provider.tsx';
import { browser } from 'wxt/browser';
import initTranslations from '@/components/i18n.ts';
import { applyDocumentLocale, loadInitialLocale } from '@/lib/i18nLocale';
import { Toaster } from '@/components/ui/toaster.tsx';

async function initApp() {
  const locale = await loadInitialLocale();
  applyDocumentLocale(locale, '');
  const { i18n } = await initTranslations(locale, ['common', 'popup', 'newtab']);

  // 在设置页切换语言后，已打开的侧边栏同步更新
  browser.storage.onChanged.addListener((changes, area) => {
    const next = changes.i18n?.newValue;
    if (area === 'local' && typeof next === 'string') {
      void i18n.changeLanguage(next);
      document.documentElement.lang = next.replace('_', '-');
    }
  });

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
        <Toaster />
      </ThemeProvider>
    </React.StrictMode>,
  );
}

initApp().catch(console.error);
