import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import { initializeAccentColor } from "@/lib/accentColorUtils";
import { Toaster } from "@/components/ui/toaster";

// 初始化强调色
import { i18nConfig } from "@/components/i18nConfig.ts";
import initTranslations from "@/components/i18n.ts";

async function initApp() {
  // 初始化国际化
  await initTranslations(i18nConfig.defaultLocale, ["common", "popup"]);

  // 初始化强调色
  await initializeAccentColor();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
      <Toaster />
    </React.StrictMode>,
  );
}

initApp().catch(console.error);
