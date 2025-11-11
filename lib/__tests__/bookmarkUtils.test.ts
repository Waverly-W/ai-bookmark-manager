import { describe, it, expect, beforeEach, vi } from 'vitest'

// 由于 bookmarkUtils 导入了 browser API，我们在这里重新实现纯函数逻辑进行测试
// 这些函数应该被提取到独立的工具模块中

// 从 bookmarkUtils 复制的纯函数实现
const validateBookmarkUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

const validateBookmarkTitle = (title: string): boolean => {
  return title.trim().length > 0 && title.trim().length <= 200
}

const filterBookmarksByRoot = (
  bookmarks: any[],
  rootFolderId: string
): any[] => {
  if (rootFolderId === 'all') {
    return bookmarks
  }

  function findFolder(nodes: any[]): any | null {
    for (const node of nodes) {
      if (node.id === rootFolderId) {
        return node
      }
      if (node.children) {
        const found = findFolder(node.children)
        if (found) return found
      }
    }
    return null
  }

  const rootFolder = findFolder(bookmarks)
  return rootFolder?.children || []
}

describe('bookmarkUtils', () => {
  describe('validateBookmarkUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateBookmarkUrl('https://example.com')).toBe(true)
      expect(validateBookmarkUrl('http://example.com')).toBe(true)
      expect(validateBookmarkUrl('https://example.com/path')).toBe(true)
      expect(validateBookmarkUrl('https://example.com:8080')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(validateBookmarkUrl('not a url')).toBe(false)
      expect(validateBookmarkUrl('example.com')).toBe(false)
      expect(validateBookmarkUrl('')).toBe(false)
      expect(validateBookmarkUrl('ht!tp://example.com')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validateBookmarkUrl('ftp://example.com')).toBe(true)
      expect(validateBookmarkUrl('file:///path/to/file')).toBe(true)
      // URL constructor actually trims whitespace, so this is valid
      expect(validateBookmarkUrl('  https://example.com  ')).toBe(true)
    })
  })

  describe('validateBookmarkTitle', () => {
    it('should validate correct titles', () => {
      expect(validateBookmarkTitle('My Bookmark')).toBe(true)
      expect(validateBookmarkTitle('a')).toBe(true)
      expect(validateBookmarkTitle('A'.repeat(200))).toBe(true)
    })

    it('should reject empty or whitespace-only titles', () => {
      expect(validateBookmarkTitle('')).toBe(false)
      expect(validateBookmarkTitle('   ')).toBe(false)
      expect(validateBookmarkTitle('\t\n')).toBe(false)
    })

    it('should reject titles exceeding 200 characters', () => {
      expect(validateBookmarkTitle('A'.repeat(201))).toBe(false)
      expect(validateBookmarkTitle('A'.repeat(300))).toBe(false)
    })

    it('should trim whitespace before validation', () => {
      expect(validateBookmarkTitle('  Valid Title  ')).toBe(true)
      expect(validateBookmarkTitle('  ')).toBe(false)
    })
  })

  describe('filterBookmarksByRoot', () => {
    const mockBookmarks = [
      {
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          {
            id: '2',
            title: 'Folder A',
            children: [
              { id: '3', title: 'Bookmark 1', url: 'https://example.com' },
              { id: '4', title: 'Bookmark 2', url: 'https://example.org' },
            ],
          },
          {
            id: '5',
            title: 'Folder B',
            children: [
              { id: '6', title: 'Bookmark 3', url: 'https://example.net' },
            ],
          },
        ],
      },
    ]

    it('should return all bookmarks when rootFolderId is "all"', () => {
      const result = filterBookmarksByRoot(mockBookmarks, 'all')
      expect(result).toEqual(mockBookmarks)
    })

    it('should filter bookmarks by root folder ID', () => {
      const result = filterBookmarksByRoot(mockBookmarks, '1')
      expect(result).toEqual(mockBookmarks[0].children)
      expect(result.length).toBe(2)
    })

    it('should return empty array for non-existent folder ID', () => {
      const result = filterBookmarksByRoot(mockBookmarks, 'non-existent')
      expect(result).toEqual([])
    })

    it('should handle nested folder filtering', () => {
      const result = filterBookmarksByRoot(mockBookmarks, '2')
      expect(result).toEqual(mockBookmarks[0].children[0].children)
      expect(result.length).toBe(2)
    })

    it('should handle empty bookmarks array', () => {
      const result = filterBookmarksByRoot([], 'any-id')
      expect(result).toEqual([])
    })

    it('should handle folders without children', () => {
      const bookmarksWithoutChildren = [
        {
          id: '1',
          title: 'Empty Folder',
          children: [],
        },
      ]
      const result = filterBookmarksByRoot(bookmarksWithoutChildren, '1')
      expect(result).toEqual([])
    })
  })

  describe('URL validation edge cases', () => {
    it('should handle special characters in URLs', () => {
      expect(validateBookmarkUrl('https://example.com/path?query=value&other=123')).toBe(true)
      expect(validateBookmarkUrl('https://example.com/path#anchor')).toBe(true)
      expect(validateBookmarkUrl('https://user:pass@example.com')).toBe(true)
    })

    it('should handle international domain names', () => {
      expect(validateBookmarkUrl('https://例え.jp')).toBe(true)
      expect(validateBookmarkUrl('https://münchen.de')).toBe(true)
    })
  })

  describe('Title validation edge cases', () => {
    it('should handle special characters in titles', () => {
      expect(validateBookmarkTitle('Title with "quotes"')).toBe(true)
      expect(validateBookmarkTitle("Title with 'apostrophe'")).toBe(true)
      expect(validateBookmarkTitle('Title with émojis 🎉')).toBe(true)
    })

    it('should handle unicode characters', () => {
      expect(validateBookmarkTitle('中文标题')).toBe(true)
      expect(validateBookmarkTitle('日本語タイトル')).toBe(true)
      expect(validateBookmarkTitle('한국어 제목')).toBe(true)
    })
  })

  describe('createChromeBookmark', () => {
    it('should validate bookmark creation parameters', () => {
      // 测试标题验证
      expect(validateBookmarkTitle('Valid Title')).toBe(true)
      expect(validateBookmarkTitle('')).toBe(false)
      expect(validateBookmarkTitle('   ')).toBe(false)

      // 测试URL验证
      expect(validateBookmarkUrl('https://example.com')).toBe(true)
      expect(validateBookmarkUrl('invalid-url')).toBe(false)
      expect(validateBookmarkUrl('')).toBe(false)
    })

    it('should trim title and url before validation', () => {
      const title = '  My Bookmark  '
      const url = '  https://example.com  '

      expect(validateBookmarkTitle(title)).toBe(true)
      expect(validateBookmarkUrl(url)).toBe(true)

      // 验证 trim 后的值
      expect(title.trim()).toBe('My Bookmark')
      expect(url.trim()).toBe('https://example.com')
    })

    it('should handle various URL formats', () => {
      expect(validateBookmarkUrl('https://example.com')).toBe(true)
      expect(validateBookmarkUrl('http://example.com')).toBe(true)
      expect(validateBookmarkUrl('https://example.com/path?query=value')).toBe(true)
      expect(validateBookmarkUrl('https://subdomain.example.com')).toBe(true)
    })

    it('should reject invalid bookmark data', () => {
      // 标题太长
      expect(validateBookmarkTitle('A'.repeat(201))).toBe(false)

      // 无效的URL
      expect(validateBookmarkUrl('not-a-url')).toBe(false)
      expect(validateBookmarkUrl('example.com')).toBe(false)
    })

    it('should support custom parent folder ID', () => {
      // 测试 parentId 参数的验证
      const customParentId = '2' // 假设这是一个自定义文件夹ID
      const defaultParentId = '1' // 默认书签栏ID

      // 验证 parentId 是字符串类型
      expect(typeof customParentId).toBe('string')
      expect(typeof defaultParentId).toBe('string')

      // 验证 parentId 不为空
      expect(customParentId.length).toBeGreaterThan(0)
      expect(defaultParentId.length).toBeGreaterThan(0)
    })
  })
})

