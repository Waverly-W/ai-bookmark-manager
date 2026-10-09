import { browser } from 'wxt/browser';

/** 可选主机权限里声明的全部站点（失效链接检测这类需要访问任意网站的功能使用） */
export const ALL_SITES_PATTERNS = ['https://*/*', 'http://*/*'] as const;

/**
 * 把网址转成权限请求用的匹配模式（`https://host/*`）。
 * 端口不参与匹配，因此不写入模式；非 http(s) 或无法解析的网址返回 undefined。
 */
export const hostPatternFor = (url: string): string | undefined => {
    try {
        const parsed = new URL(url);
        if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
            return undefined;
        }
        return `${parsed.protocol}//${parsed.hostname}/*`;
    } catch {
        return undefined;
    }
};

/**
 * 向用户申请访问指定站点的权限。
 *
 * 浏览器要求这个调用来自用户手势：必须直接写在点击处理函数里，并且在它之前不能有 await，
 * 否则会因手势失效而被拒绝。已授权的站点会直接返回 true，不会再次弹窗，所以不需要先检查。
 * 传入的值为空（例如网址格式不对）时视为无需申请，由后续的表单校验报错。
 */
export const requestHostAccess = async (patterns: ReadonlyArray<string | undefined>): Promise<boolean> => {
    const origins = [...new Set(patterns.filter((pattern): pattern is string => Boolean(pattern)))];
    if (origins.length === 0) return true;

    const permissions = browser.permissions;
    if (!permissions?.request) return true;

    try {
        return await permissions.request({ origins });
    } catch (error) {
        console.warn('Host permission request failed:', error);
        return false;
    }
};

/** 用于提示文案：只展示主机名，网址解析失败时原样返回 */
export const hostLabel = (url: string): string => {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
};
