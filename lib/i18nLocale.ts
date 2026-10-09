import { browser } from 'wxt/browser';
import { i18nConfig } from '@/components/i18nConfig';

/**
 * 决定界面语言：已保存的设置优先，其次是浏览器语言（zh-* 归为 zh_CN），最后是默认语言。
 */
export const resolveLocale = (saved: unknown, browserLanguage?: string): string => {
    const supported = (value: string) => i18nConfig.locales.includes(value);

    if (typeof saved === 'string' && supported(saved)) {
        return saved;
    }

    const language = (browserLanguage ?? '').replace('-', '_');
    if (supported(language)) return language;
    if (language.toLowerCase().startsWith('zh') && supported('zh_CN')) return 'zh_CN';
    const base = language.split('_')[0];
    if (supported(base)) return base;

    return i18nConfig.defaultLocale;
};

export const loadInitialLocale = async (): Promise<string> => {
    let saved: unknown;
    try {
        saved = (await browser.storage.local.get('i18n')).i18n;
    } catch (error) {
        console.warn('Failed to get language preference:', error);
    }
    return resolveLocale(saved, globalThis.navigator?.language || globalThis.navigator?.languages?.[0]);
};

/** 让页面标题与 lang 属性跟随界面语言；标题使用扩展名（取自 _locales，随浏览器语言） */
export const applyDocumentLocale = (locale: string, title?: string): void => {
    document.documentElement.lang = locale.replace('_', '-');
    const extensionName = title ?? browser.i18n?.getMessage?.('extName');
    if (extensionName) document.title = extensionName;
};
