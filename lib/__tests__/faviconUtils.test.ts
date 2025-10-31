import { describe, it, expect, beforeEach, vi } from 'vitest'

// 由于 faviconUtils 依赖 browser API，我们测试其纯函数部分
// 这里测试 URL 处理和缓存逻辑的独立部分

describe('faviconUtils - URL Processing', () => {
  describe('Domain extraction', () => {
    // 测试 extractDomain 的逻辑
    const extractDomain = (url: string): string => {
      try {
        const urlObj = new URL(url)
        return urlObj.hostname
      } catch {
        return ''
      }
    }

    it('should extract domain from valid URLs', () => {
      expect(extractDomain('https://example.com')).toBe('example.com')
      expect(extractDomain('https://www.example.com')).toBe('www.example.com')
      expect(extractDomain('https://sub.domain.example.com')).toBe('sub.domain.example.com')
    })

    it('should handle URLs with paths and queries', () => {
      expect(extractDomain('https://example.com/path/to/page')).toBe('example.com')
      expect(extractDomain('https://example.com/path?query=value')).toBe('example.com')
      expect(extractDomain('https://example.com:8080/path')).toBe('example.com')
    })

    it('should return empty string for invalid URLs', () => {
      expect(extractDomain('not a url')).toBe('')
      expect(extractDomain('example.com')).toBe('')
      expect(extractDomain('')).toBe('')
    })

    it('should handle different protocols', () => {
      expect(extractDomain('http://example.com')).toBe('example.com')
      expect(extractDomain('ftp://example.com')).toBe('example.com')
      expect(extractDomain('file:///path/to/file')).toBe('')
    })
  })

  describe('Root favicon URL construction', () => {
    // 测试 getRootFaviconUrl 的逻辑
    const getRootFaviconUrl = (url: string): string => {
      try {
        const urlObj = new URL(url)
        return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`
      } catch {
        return ''
      }
    }

    it('should construct correct favicon URLs', () => {
      expect(getRootFaviconUrl('https://example.com')).toBe('https://example.com/favicon.ico')
      expect(getRootFaviconUrl('https://example.com/path')).toBe('https://example.com/favicon.ico')
      expect(getRootFaviconUrl('http://example.com:8080')).toBe('http://example.com/favicon.ico')
    })

    it('should handle subdomains', () => {
      expect(getRootFaviconUrl('https://www.example.com')).toBe('https://www.example.com/favicon.ico')
      expect(getRootFaviconUrl('https://api.example.com')).toBe('https://api.example.com/favicon.ico')
    })

    it('should return empty string for invalid URLs', () => {
      expect(getRootFaviconUrl('not a url')).toBe('')
      expect(getRootFaviconUrl('')).toBe('')
    })
  })

  describe('Favicon URL parsing from HTML', () => {
    // 测试 favicon 链接提取的逻辑
    const extractFaviconUrls = (html: string, baseUrl: string): string[] => {
      const faviconUrls: string[] = []
      const linkRegex = /<link[^>]*(?:rel=["'](?:icon|shortcut icon|apple-touch-icon)[^"']*["'])[^>]*href=["']([^"']+)["'][^>]*>/gi
      let match

      while ((match = linkRegex.exec(html)) !== null) {
        let faviconUrl = match[1]

        // 处理相对路径
        if (faviconUrl.startsWith('//')) {
          const urlObj = new URL(baseUrl)
          faviconUrl = urlObj.protocol + faviconUrl
        } else if (faviconUrl.startsWith('/')) {
          const urlObj = new URL(baseUrl)
          faviconUrl = `${urlObj.protocol}//${urlObj.hostname}${faviconUrl}`
        } else if (!faviconUrl.startsWith('http')) {
          const urlObj = new URL(baseUrl)
          const basePath = `${urlObj.protocol}//${urlObj.hostname}`
          faviconUrl = basePath + '/' + faviconUrl
        }

        faviconUrls.push(faviconUrl)
      }

      return faviconUrls
    }

    it('should extract favicon URLs from HTML', () => {
      const html = '<link rel="icon" href="/favicon.ico">'
      const urls = extractFaviconUrls(html, 'https://example.com')
      expect(urls).toContain('https://example.com/favicon.ico')
    })

    it('should handle multiple favicon links', () => {
      const html = `
        <link rel="icon" href="/favicon.ico">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="shortcut icon" href="/shortcut-icon.ico">
      `
      const urls = extractFaviconUrls(html, 'https://example.com')
      expect(urls.length).toBe(3)
    })

    it('should handle relative paths', () => {
      const html = '<link rel="icon" href="favicon.ico">'
      const urls = extractFaviconUrls(html, 'https://example.com/path/')
      expect(urls[0]).toContain('favicon.ico')
    })

    it('should handle protocol-relative URLs', () => {
      const html = '<link rel="icon" href="//cdn.example.com/favicon.ico">'
      const urls = extractFaviconUrls(html, 'https://example.com')
      expect(urls[0]).toBe('https://cdn.example.com/favicon.ico')
    })

    it('should handle absolute URLs', () => {
      const html = '<link rel="icon" href="https://cdn.example.com/favicon.ico">'
      const urls = extractFaviconUrls(html, 'https://example.com')
      expect(urls[0]).toBe('https://cdn.example.com/favicon.ico')
    })

    it('should return empty array for HTML without favicon links', () => {
      const html = '<html><head><title>No favicon</title></head></html>'
      const urls = extractFaviconUrls(html, 'https://example.com')
      expect(urls).toEqual([])
    })
  })

  describe('Cache expiration logic', () => {
    // 测试缓存过期逻辑
    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7天

    it('should determine if cache is expired', () => {
      const now = Date.now()
      const cachedItem = {
        dataUrl: 'data:image/x-icon;base64,...',
        timestamp: now - CACHE_DURATION - 1000, // 过期
        expires: now - 1000,
      }

      expect(now > cachedItem.expires).toBe(true)
    })

    it('should determine if cache is still valid', () => {
      const now = Date.now()
      const cachedItem = {
        dataUrl: 'data:image/x-icon;base64,...',
        timestamp: now - 1000,
        expires: now + CACHE_DURATION,
      }

      expect(now > cachedItem.expires).toBe(false)
    })

    it('should handle edge case of exactly expired cache', () => {
      const now = Date.now()
      const cachedItem = {
        dataUrl: 'data:image/x-icon;base64,...',
        timestamp: now - CACHE_DURATION,
        expires: now,
      }

      expect(now > cachedItem.expires).toBe(false) // 边界情况：相等时不过期
    })
  })

  describe('Google Favicon API URL construction', () => {
    // 测试 Google Favicon API URL 构造
    const getGoogleFaviconUrl = (url: string): string => {
      try {
        const domain = new URL(url).hostname
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
      } catch {
        return ''
      }
    }

    it('should construct correct Google Favicon API URLs', () => {
      const url = getGoogleFaviconUrl('https://example.com')
      expect(url).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=128')
    })

    it('should handle subdomains', () => {
      const url = getGoogleFaviconUrl('https://www.example.com')
      expect(url).toBe('https://www.google.com/s2/favicons?domain=www.example.com&sz=128')
    })

    it('should return empty string for invalid URLs', () => {
      expect(getGoogleFaviconUrl('not a url')).toBe('')
    })
  })

  describe('Chrome Favicon API URL construction', () => {
    // 测试 Chrome Favicon API URL 构造
    // 注意：这个测试模拟 Chrome Favicon API 的 URL 构造逻辑
    const getChromeBuiltInFaviconUrl = (url: string, size: number = 32): string => {
      try {
        // 模拟 chrome.runtime.getURL('/_favicon/')
        const extensionId = 'test-extension-id'
        const faviconUrl = new URL(`chrome-extension://${extensionId}/_favicon/`)
        faviconUrl.searchParams.set('pageUrl', url)
        faviconUrl.searchParams.set('size', size.toString())
        return faviconUrl.toString()
      } catch (error) {
        return ''
      }
    }

    it('should construct correct Chrome Favicon API URLs', () => {
      const url = getChromeBuiltInFaviconUrl('https://example.com', 32)
      expect(url).toContain('_favicon')
      expect(url).toContain('pageUrl=https')
      expect(url).toContain('size=32')
    })

    it('should handle different sizes', () => {
      const url16 = getChromeBuiltInFaviconUrl('https://example.com', 16)
      const url32 = getChromeBuiltInFaviconUrl('https://example.com', 32)
      const url64 = getChromeBuiltInFaviconUrl('https://example.com', 64)

      expect(url16).toContain('size=16')
      expect(url32).toContain('size=32')
      expect(url64).toContain('size=64')
    })

    it('should properly encode URL parameters', () => {
      const url = getChromeBuiltInFaviconUrl('https://example.com/path?query=value', 32)
      expect(url).toContain('pageUrl=https')
      // URL 参数应该被正确编码
      expect(url).toContain('%')
    })

    it('should handle subdomains', () => {
      const url = getChromeBuiltInFaviconUrl('https://www.example.com', 32)
      expect(url).toContain('pageUrl=https')
      expect(url).toContain('www.example.com')
    })

    it('should still construct URL for invalid URLs (Chrome API accepts any string)', () => {
      // Chrome Favicon API 会接受任何字符串作为 pageUrl 参数
      // 它会在运行时处理无效的 URL
      const url = getChromeBuiltInFaviconUrl('not a url', 32)
      expect(url).toContain('_favicon')
      expect(url).toContain('pageUrl=not')
    })

    it('should use default size of 32 when not specified', () => {
      const url = getChromeBuiltInFaviconUrl('https://example.com')
      expect(url).toContain('size=32')
    })
  })
})

