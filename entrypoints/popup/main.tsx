import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import { initializeAccentColor } from "@/lib/accentColorUtils";
import { Toaster } from "@/components/ui/toaster";
import { browser } from "wxt/browser";

// 初始化强调色
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
    console.error('Failed to get language preference:', error);
  }

  // 初始化国际化
  await initTranslations(locale, ["common", "popup"]);

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
