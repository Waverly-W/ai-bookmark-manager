import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import { Toaster } from "@/components/ui/toaster";
import { browser } from "wxt/browser";
import { i18nConfig } from "@/components/i18nConfig.ts";
import initTranslations from "@/components/i18n.ts";

async function initApp() {
  // 获取保存的语言设置，如果没有则使用浏览器语言
  let locale = i18nConfig.defaultLocale;

  try {
    const data = await browser.storage.local.get('i18n');
    if (data.i18n) {
      locale = data.i18n;
    } else {
      // 如果没有保存的设置，使用浏览器语言
      const browserLang = navigator.language || navigator.languages?.[0] || 'en';
      // 将 zh-CN, zh-TW 等转换为 zh_CN 格式
      locale = browserLang.replace('-', '_');
      // 检查是否支持该语言
      if (!i18nConfig.locales.includes(locale)) {
        locale = i18nConfig.defaultLocale;
      }
    }
  } catch (error) {
    console.warn('Failed to get language preference:', error);
  }

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
      <React.Suspense fallback={<div className="flex items-center justify-center min-h-[600px] text-muted-foreground">Loading...</div>}>
        <App />
        <Toaster />
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
