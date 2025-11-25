import { browser } from 'wxt/browser';

// Favicon缓存接口
interface FaviconCache {
    [url: string]: {
        dataUrl: string;
        timestamp: number;
        expires: number;
    };
}

// 缓存配置
const CACHE_KEY = 'faviconCache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天
const REQUEST_TIMEOUT = 5000; // 5秒超时

/**
 * 从URL提取域名
 */
function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return '';
    }
}

/**
 * 获取网站根目录favicon URL
 */
function getRootFaviconUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
    } catch {
        return '';
    }
}

/**
 * 获取Google favicon服务URL
 */
function getGoogleFaviconUrl(url: string): string {
    const domain = extractDomain(url);
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/**
 * 获取DuckDuckGo favicon服务URL
 */
function getDuckDuckGoFaviconUrl(url: string): string {
    const domain = extractDomain(url);
    if (!domain) return '';
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

/**
 * 获取Favicon Grabber API URL
 */
function getFaviconGrabberUrl(url: string): string {
    const domain = extractDomain(url);
    if (!domain) return '';
    return `https://api.favicongrabber.com/api/grab/${domain}`;
}

/**
 * 获取Chrome内置Favicon API URL（最快，无延迟）
 * 使用Chrome官方提供的favicon API直接访问浏览器内部缓存
 *
 * @param url 书签URL
 * @param size favicon大小（默认32px）
 * @returns Chrome Favicon API URL
 *
 * @example
 * getChromeBuiltInFaviconUrl('https://www.google.com', 32)
 * // 返回: chrome-extension://xxxxx/_favicon/?pageUrl=https%3A%2F%2Fwww.google.com&size=32
 */
function getChromeBuiltInFaviconUrl(url: string, size: number = 32): string {
    try {
        const faviconUrl = new URL(browser.runtime.getURL('/_favicon/' as any));
        faviconUrl.searchParams.set('pageUrl', url);
        faviconUrl.searchParams.set('size', size.toString());
        return faviconUrl.toString();
    } catch (error) {
        console.error('Failed to get Chrome favicon URL:', error);
        return '';
    }
}

/**
 * 使用fetch获取图片并转换为Data URL（解决CORS问题）
 */
async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
    try {
        const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                try {
                    canvas.width = 32;
                    canvas.height = 32;
                    ctx?.drawImage(img, 0, 0, 32, 32);
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve(dataUrl);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to process image'));
            };

            img.src = URL.createObjectURL(blob);
        });
    } catch (error) {
        throw new Error(`Failed to fetch image: ${error}`);
    }
}

/**
 * 将图片转换为Data URL（备用方法）
 */
async function imageToDataUrl(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 设置超时
        const timeout = setTimeout(() => {
            reject(new Error('Favicon load timeout'));
        }, REQUEST_TIMEOUT);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                canvas.width = 32;
                canvas.height = 32;
                ctx?.drawImage(img, 0, 0, 32, 32);
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Failed to load favicon'));
        };

        // 设置跨域属性
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
    });
}

/**
 * 从HTML中解析favicon链接
 */
async function parseFaviconFromHtml(url: string): Promise<string[]> {
    try {
        const urlObj = new URL(url);
        const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const faviconUrls: string[] = [];

        // 匹配各种favicon相关的link标签
        const linkRegex = /<link[^>]*(?:rel=["'](?:icon|shortcut icon|apple-touch-icon)[^"']*["'])[^>]*href=["']([^"']+)["'][^>]*>/gi;
        let match;

        while ((match = linkRegex.exec(html)) !== null) {
            let faviconUrl = match[1];

            // 处理相对路径
            if (faviconUrl.startsWith('//')) {
                faviconUrl = urlObj.protocol + faviconUrl;
            } else if (faviconUrl.startsWith('/')) {
                faviconUrl = baseUrl + faviconUrl;
            } else if (!faviconUrl.startsWith('http')) {
                faviconUrl = baseUrl + '/' + faviconUrl;
            }

            faviconUrls.push(faviconUrl);
        }

        return faviconUrls;
    } catch (error) {
        console.warn('Failed to parse favicon from HTML:', error);
        return [];
    }
}

/**
 * 从Favicon Grabber API获取favicon
 */
async function fetchFromFaviconGrabber(url: string): Promise<string[]> {
    try {
        const apiUrl = getFaviconGrabberUrl(url);
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.icons && Array.isArray(data.icons)) {
            return data.icons
                .filter((icon: any) => icon.src)
                .map((icon: any) => icon.src);
        }

        return [];
    } catch (error) {
        console.warn('Failed to fetch from Favicon Grabber:', error);
        return [];
    }
}

/**
 * 从缓存中获取favicon
 */
async function getFaviconFromCache(url: string): Promise<string | null> {
    try {
        const result = await browser.storage.local.get(CACHE_KEY);
        const cache: FaviconCache = result[CACHE_KEY] || {};
        const domain = extractDomain(url);

        if (!domain || !cache[domain]) {
            return null;
        }

        const cachedItem = cache[domain];
        const now = Date.now();

        // 检查是否过期
        if (now > cachedItem.expires) {
            // 删除过期项
            delete cache[domain];
            await browser.storage.local.set({ [CACHE_KEY]: cache });
            return null;
        }

        return cachedItem.dataUrl;
    } catch (error) {
        console.error('Error getting favicon from cache:', error);
        return null;
    }
}

/**
 * 将favicon保存到缓存
 */
async function saveFaviconToCache(url: string, dataUrl: string): Promise<void> {
    try {
        const domain = extractDomain(url);
        if (!domain) return;

        const result = await browser.storage.local.get(CACHE_KEY);
        const cache: FaviconCache = result[CACHE_KEY] || {};
        const now = Date.now();

        cache[domain] = {
            dataUrl,
            timestamp: now,
            expires: now + CACHE_DURATION
        };

        await browser.storage.local.set({ [CACHE_KEY]: cache });
    } catch (error) {
        console.error('Error saving favicon to cache:', error);
    }
}

/**
 * 尝试从单个URL获取favicon
 */
async function tryFetchFavicon(faviconUrl: string, originalUrl: string, useDirectMethod: boolean = false): Promise<string | null> {
    try {
        let dataUrl: string;

        if (useDirectMethod) {
            // 对于API服务，使用直接方法
            dataUrl = await imageToDataUrl(faviconUrl);
        } else {
            // 对于网站favicon，使用fetch方法避免CORS
            dataUrl = await fetchImageAsDataUrl(faviconUrl);
        }

        await saveFaviconToCache(originalUrl, dataUrl);
        return dataUrl;
    } catch (error) {
        console.warn(`Failed to load favicon from ${faviconUrl}:`, error);
        return null;
    }
}

/**
 * 从网络获取favicon（优化策略：优先使用API服务）
 */
async function fetchFaviconFromNetwork(url: string): Promise<string | null> {
    const domain = extractDomain(url);
    const isDebug = process.env.NODE_ENV === 'development';

    if (isDebug) console.log(`开始获取 ${domain} 的 favicon`);

    // 方法1: Google Favicon API（最稳定，优先使用）
    if (isDebug) console.log('尝试方法1: Google Favicon API');
    const googleFaviconUrl = getGoogleFaviconUrl(url);
    if (googleFaviconUrl) {
        const result = await tryFetchFavicon(googleFaviconUrl, url, true);
        if (result) {
            if (isDebug) console.log('方法1成功获取favicon');
            return result;
        }
    }

    // 方法2: DuckDuckGo Favicon API（备用API）
    if (isDebug) console.log('尝试方法2: DuckDuckGo Favicon API');
    const duckduckgoFaviconUrl = getDuckDuckGoFaviconUrl(url);
    if (duckduckgoFaviconUrl) {
        const result = await tryFetchFavicon(duckduckgoFaviconUrl, url, true);
        if (result) {
            if (isDebug) console.log('方法2成功获取favicon');
            return result;
        }
    }

    // 方法3: 直接拼接域名方式 - /favicon.ico
    if (isDebug) console.log('尝试方法3: 根目录favicon.ico');
    const rootFaviconUrl = getRootFaviconUrl(url);
    if (rootFaviconUrl) {
        const result = await tryFetchFavicon(rootFaviconUrl, url);
        if (result) {
            if (isDebug) console.log('方法3成功获取favicon');
            return result;
        }
    }

    // 方法4: 解析HTML源码中的favicon链接
    if (isDebug) console.log('尝试方法4: 解析HTML中的favicon链接');
    try {
        const htmlFaviconUrls = await parseFaviconFromHtml(url);
        for (const faviconUrl of htmlFaviconUrls) {
            const result = await tryFetchFavicon(faviconUrl, url);
            if (result) {
                if (isDebug) console.log('方法4成功获取favicon:', faviconUrl);
                return result;
            }
        }
    } catch (error) {
        if (isDebug) console.warn('方法4失败:', error);
    }

    // 方法5: Favicon Grabber API
    if (isDebug) console.log('尝试方法5: Favicon Grabber API');
    try {
        const grabberFaviconUrls = await fetchFromFaviconGrabber(url);
        for (const faviconUrl of grabberFaviconUrls) {
            const result = await tryFetchFavicon(faviconUrl, url);
            if (result) {
                if (isDebug) console.log('方法5成功获取favicon:', faviconUrl);
                return result;
            }
        }
    } catch (error) {
        if (isDebug) console.warn('方法5失败:', error);
    }

    if (isDebug) console.log(`所有方法都失败，无法获取 ${domain} 的 favicon`);
    return null;
}

/**
 * 获取favicon（主要接口）
 * 优先级：
 * 1. Chrome Favicon API（最快，无延迟）⭐
 * 2. 缓存（备用）
 * 3. 网络获取（备用）
 *
 * @param url 书签URL
 * @returns favicon URL（Chrome Favicon API URL 或 Data URL），获取失败返回null
 */
export async function getFavicon(url: string): Promise<string | null> {
    if (!url) return null;

    try {
        // 方法1：使用Chrome Favicon API（最快，无延迟）⭐
        // 直接返回Chrome内部缓存的favicon URL，无需网络请求
        const chromeUrl = getChromeBuiltInFaviconUrl(url, 32);
        if (chromeUrl) {
            return chromeUrl;
        }

        // 方法2：从缓存获取（备用）
        const cachedFavicon = await getFaviconFromCache(url);
        if (cachedFavicon) {
            return cachedFavicon;
        }

        // 方法3：从网络获取（备用）
        return await fetchFaviconFromNetwork(url);
    } catch (error) {
        console.error('Error getting favicon:', error);
        return null;
    }
}

/**
 * 预加载favicon（批量处理）
 * @param urls 书签URL数组
 */
export async function preloadFavicons(urls: string[]): Promise<void> {
    const promises = urls.map(async (url) => {
        try {
            await getFavicon(url);
        } catch (error) {
            console.warn('Failed to preload favicon for:', url, error);
        }
    });

    // 并发处理，但不等待全部完成
    Promise.allSettled(promises);
}

/**
 * 清理过期的favicon缓存
 */
export async function cleanupFaviconCache(): Promise<void> {
    try {
        const result = await browser.storage.local.get(CACHE_KEY);
        const cache: FaviconCache = result[CACHE_KEY] || {};
        const now = Date.now();
        let hasChanges = false;

        for (const domain in cache) {
            if (now > cache[domain].expires) {
                delete cache[domain];
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await browser.storage.local.set({ [CACHE_KEY]: cache });
        }
    } catch (error) {
        console.error('Error cleaning up favicon cache:', error);
    }
}

/**
 * 获取缓存统计信息
 */
export async function getFaviconCacheStats(): Promise<{
    totalItems: number;
    totalSize: number;
    oldestItem: number;
    newestItem: number;
}> {
    try {
        const result = await browser.storage.local.get(CACHE_KEY);
        const cache: FaviconCache = result[CACHE_KEY] || {};

        const items = Object.values(cache);
        const totalItems = items.length;
        const totalSize = JSON.stringify(cache).length;
        const timestamps = items.map(item => item.timestamp);

        return {
            totalItems,
            totalSize,
            oldestItem: timestamps.length > 0 ? Math.min(...timestamps) : 0,
            newestItem: timestamps.length > 0 ? Math.max(...timestamps) : 0
        };
    } catch (error) {
        console.error('Error getting favicon cache stats:', error);
        return {
            totalItems: 0,
            totalSize: 0,
            oldestItem: 0,
            newestItem: 0
        };
    }
}
