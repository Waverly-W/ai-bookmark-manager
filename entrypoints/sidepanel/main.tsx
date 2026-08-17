import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from '@/components/theme-provider.tsx';
import { i18nConfig } from '@/components/i18nConfig.ts';
import initTranslations from '@/components/i18n.ts';
import { Toaster } from '@/components/ui/toaster.tsx';

async function initApp() {
  await initTranslations(i18nConfig.defaultLocale, ['common', 'popup', 'newtab']);

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
