# AI 书签管家 - 国际化审查报告

## 执行摘要

本报告对 AI 书签管家项目进行了全面的国际化(i18n)审查，识别了所有硬编码的中英文混杂文本，并提出了规范化方案。

**审查日期**: 2025-10-31  
**项目**: AI 书签管家 (ai-bookmark-manager)  
**当前状态**: 国际化系统已部分实现，但存在多处硬编码文本

---

## 1. 现状分析

### 1.1 国际化基础设施
✅ **已实现**:
- i18next 框架集成完成
- 支持中文(zh_CN)和英文(en)两种语言
- 翻译文件结构: `locales/{lang}/{namespace}.json`
- 命名空间: `common.json`, `newtab.json`, `content.json`
- 173 个翻译键值已定义

❌ **存在问题**:
- 多个组件中存在硬编码的英文文本
- 部分硬编码的中文文本未通过 i18n 系统管理
- 缺少部分新增功能的翻译键值

### 1.2 翻译文件现状
- **en/common.json**: 173 个键值 ✓
- **zh_CN/common.json**: 173 个键值 ✓
- **en/newtab.json**: 仅包含 `name: "english"` (不完整)
- **zh_CN/newtab.json**: 仅包含 `contentName: "中文简体"` (不完整)

---

## 2. 发现的硬编码文本问题

### 2.1 关键问题清单

#### 问题 1: bookmarks.tsx 第 131 行
**文件**: `entrypoints/newtab/bookmarks.tsx`  
**位置**: 第 131 行  
**硬编码文本**: `'All Bookmarks'` (英文)  
**应该使用**: `t('allBookmarks')`  
**严重程度**: 🔴 高 (导航历史初始值)

#### 问题 2: bookmarks.tsx 第 786 行
**文件**: `entrypoints/newtab/bookmarks.tsx`  
**位置**: 第 786 行  
**硬编码文本**: `'未找到匹配的书签'` (中文)  
**应该使用**: 需要新增 i18n 键值 `searchNoResults`  
**严重程度**: 🔴 高 (搜索结果提示)

#### 问题 3: App.tsx 第 61 行
**文件**: `entrypoints/newtab/App.tsx`  
**位置**: 第 61 行  
**硬编码文本**: `'send Message'` (英文)  
**应该使用**: 调试代码，应删除或国际化  
**严重程度**: 🟡 中 (调试按钮)

#### 问题 4: bookmark-edit-dialog.tsx 多处
**文件**: `components/ui/bookmark-edit-dialog.tsx`  
**位置**: 第 64, 75, 98, 122, 143, 155 行  
**硬编码文本**:
- `'URL is required for AI rename'` (第 64 行)
- `'Please configure AI service in settings first'` (第 75 行)
- `'AI Rename Success'` (第 98 行)
- `'AI has suggested a new title for your bookmark'` (第 99 行)
- `'Validation Error'` (第 122, 131 行)
- `'Bookmark name cannot be empty'` (第 123 行)
- `'Bookmark URL cannot be empty'` (第 132 行)
- `'Success'` (第 143 行)
- `'Bookmark updated successfully'` (第 144 行)
- `'Save Failed'` (第 154 行)
- `'Failed to save bookmark'` (第 155 行)
- `'Saving...'` (第 255 行)
- `'https://example.com'` (第 232 行 - 占位符)

**严重程度**: 🔴 高 (用户可见的关键消息)

#### 问题 5: ai-config-settings.tsx 第 39 行
**文件**: `components/settings/ai-config-settings.tsx`  
**位置**: 第 39 行  
**硬编码文本**: `'Failed to load AI configuration'`  
**严重程度**: 🔴 高 (错误消息)

#### 问题 6: sync-status-settings.tsx 多处
**文件**: `components/settings/sync-status-settings.tsx`  
**位置**: 第 64, 73, 81, 88, 116, 118, 134, 143, 151, 167, 172, 180 行  
**硬编码文本**: 多个英文 fallback 文本  
**严重程度**: 🟡 中 (缺少翻译键值)

#### 问题 7: folder-edit-dialog.tsx 第 58-59 行
**文件**: `components/ui/folder-edit-dialog.tsx`  
**位置**: 第 58-59 行  
**硬编码文本**: 
- `'saveBookmarkFailed'` (应为 `'saveFolderFailed'`)
- `'bookmarkNameRequired'` (应为 `'folderNameRequired'`)

**严重程度**: 🟡 中 (错误的键值引用)

---

## 3. 缺失的翻译键值

需要新增以下键值到 `common.json`:

```json
{
  "searchNoResults": "No matching bookmarks found",
  "urlRequired": "URL is required for AI rename",
  "validationError": "Validation Error",
  "bookmarkNameEmpty": "Bookmark name cannot be empty",
  "bookmarkUrlEmpty": "Bookmark URL cannot be empty",
  "aiRenameSuccess": "AI Rename Success",
  "aiRenameSuggestion": "AI has suggested a new title for your bookmark",
  "bookmarkUpdatedSuccess": "Bookmark updated successfully",
  "saveFailed": "Save Failed",
  "failedToSaveBookmark": "Failed to save bookmark",
  "saving": "Saving",
  "folderNameRequired": "Folder name cannot be empty",
  "failedToLoadAIConfig": "Failed to load AI configuration",
  "never": "Never",
  "syncing": "Syncing",
  "syncFailed": "Sync Failed",
  "synced": "Synced",
  "notSynced": "Not Synced",
  "syncStatus": "Sync Status",
  "syncStatusDescription": "Manage configuration synchronization across devices",
  "lastSyncTime": "Last Sync",
  "pendingChanges": "Pending Changes",
  "syncError": "Sync Error",
  "manualSync": "Manual Sync",
  "syncInfo": "Your configuration will automatically sync across all devices logged in with the same Google account."
}
```

---

## 4. 规范化建议

### 4.1 键值命名规范

建议采用层级结构命名规范:

```
{category}.{section}.{element}
```

**示例**:
- `ui.button.save` - 保存按钮
- `ui.dialog.title.editBookmark` - 编辑书签对话框标题
- `message.error.bookmarkNameEmpty` - 书签名称为空错误消息
- `message.success.bookmarkUpdated` - 书签更新成功消息
- `message.loading.processing` - 处理中加载消息

### 4.2 分类建议

- **ui**: UI 元素文本 (按钮、标签、占位符)
- **message**: 用户消息 (错误、成功、警告、信息)
- **page**: 页面级文本 (标题、描述)
- **dialog**: 对话框内容
- **validation**: 验证消息

---

## 5. 修复优先级

| 优先级 | 问题数 | 影响范围 | 修复工作量 |
|--------|--------|---------|----------|
| 🔴 高 | 4 | 核心功能 | 中等 |
| 🟡 中 | 3 | 辅助功能 | 小 |
| 🟢 低 | 1 | 调试代码 | 小 |

---

## 6. 后续行动

1. ✅ 完成本分析报告
2. ⏳ 更新翻译文件，添加缺失的键值
3. ⏳ 修复所有硬编码文本
4. ⏳ 验证国际化系统正常工作
5. ⏳ 运行测试确保功能完整性

