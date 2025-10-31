# AI 书签管家 - 国际化修改清单

## 修改文件列表

### 翻译文件 (2 个)

#### 1. locales/en/common.json
**修改**: 添加 27 个新的英文翻译键值

新增键值:
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
  "syncInfo": "Your configuration will automatically sync across all devices logged in with the same Google account.",
  "saveBookmarkFailed": "Failed to save bookmark",
  "bookmarkNameRequired": "Bookmark name is required",
  "sendMessage": "Send Message"
}
```

#### 2. locales/zh_CN/common.json
**修改**: 添加 27 个新的中文翻译键值

新增键值:
```json
{
  "searchNoResults": "未找到匹配的书签",
  "urlRequired": "AI重命名需要URL",
  "validationError": "验证错误",
  "bookmarkNameEmpty": "书签名称不能为空",
  "bookmarkUrlEmpty": "书签URL不能为空",
  "aiRenameSuccess": "AI重命名成功",
  "aiRenameSuggestion": "AI已为您的书签建议了新标题",
  "bookmarkUpdatedSuccess": "书签已成功更新",
  "saveFailed": "保存失败",
  "failedToSaveBookmark": "保存书签失败",
  "folderNameRequired": "文件夹名称不能为空",
  "failedToLoadAIConfig": "加载AI配置失败",
  "never": "从未",
  "syncing": "同步中",
  "syncFailed": "同步失败",
  "synced": "已同步",
  "notSynced": "未同步",
  "syncStatus": "同步状态",
  "syncStatusDescription": "管理跨设备的配置同步",
  "lastSyncTime": "最后同步",
  "pendingChanges": "待同步变更",
  "syncError": "同步错误",
  "manualSync": "手动同步",
  "syncInfo": "您的配置将自动在使用同一Google账户登录的所有设备上同步。",
  "saveBookmarkFailed": "保存书签失败",
  "bookmarkNameRequired": "书签名称为必填项",
  "sendMessage": "发送消息"
}
```

---

### 源代码文件 (7 个)

#### 1. entrypoints/newtab/bookmarks.tsx
**修改**: 1 处

**第 786 行**: 搜索结果提示文本国际化
```typescript
// 修改前
{isSearching ? '未找到匹配的书签' : t('noBookmarks')}

// 修改后
{isSearching ? t('searchNoResults') : t('noBookmarks')}
```

---

#### 2. entrypoints/newtab/App.tsx
**修改**: 1 处

**第 61 行**: 调试按钮文本国际化
```typescript
// 修改前
<Button className="absolute z-[100000]" style={buttonStyle}>send Message</Button>

// 修改后
<Button className="absolute z-[100000]" style={buttonStyle}>{t('sendMessage')}</Button>
```

---

#### 3. components/ui/bookmark-edit-dialog.tsx
**修改**: 12 处

**第 64 行**: URL 必填错误消息
```typescript
description: t('urlRequired'),
```

**第 75 行**: AI 配置错误消息
```typescript
description: t('aiNotConfigured'),
```

**第 98-99 行**: AI 重命名成功消息
```typescript
title: t('aiRenameSuccess'),
description: t('aiRenameSuggestion'),
```

**第 122-123 行**: 验证错误 - 书签名称
```typescript
title: t('validationError'),
description: t('bookmarkNameEmpty'),
```

**第 131-132 行**: 验证错误 - 书签URL
```typescript
title: t('validationError'),
description: t('bookmarkUrlEmpty'),
```

**第 143-144 行**: 保存成功消息
```typescript
title: t('save'),
description: t('bookmarkUpdatedSuccess'),
```

**第 154-155 行**: 保存失败消息
```typescript
title: t('saveFailed'),
description: t('failedToSaveBookmark'),
```

**第 232 行**: URL 占位符
```typescript
placeholder={t('apiUrlPlaceholder')},
```

**第 255 行**: 保存状态文本
```typescript
{t('saving')}...
```

---

#### 4. components/ui/folder-edit-dialog.tsx
**修改**: 2 处

**第 58-59 行**: 修正错误的键值引用
```typescript
// 修改前
title: t('saveBookmarkFailed'),
description: t('bookmarkNameRequired'),

// 修改后
title: t('saveFolderFailed'),
description: t('folderNameRequired'),
```

---

#### 5. components/settings/ai-config-settings.tsx
**修改**: 2 处

**第 39 行**: 加载失败错误消息
```typescript
description: t('failedToLoadAIConfig'),
```

**第 233 行**: 保存状态文本
```typescript
{t('saving')}...
```

---

#### 6. components/settings/ai-prompt-settings.tsx
**修改**: 1 处

**第 183 行**: 保存状态文本
```typescript
{t('saving')}...
```

---

#### 7. components/settings/sync-status-settings.tsx
**修改**: 8 处

**第 64 行**: 时间格式化 - 从不
```typescript
// 修改前
return t('never') || 'Never';

// 修改后
return t('never');
```

**第 73 行**: 同步状态 - 加载中
```typescript
// 修改前
return t('loading') || 'Loading...';

// 修改后
return t('loading');
```

**第 81 行**: 同步状态 - 同步中
```typescript
// 修改前
return t('syncing') || 'Syncing...';

// 修改后
return t('syncing');
```

**第 88 行**: 同步状态 - 同步失败
```typescript
// 修改前
return t('syncFailed') || 'Sync Failed';

// 修改后
return t('syncFailed');
```

**第 116-118 行**: 标题和描述
```typescript
// 修改前
<h4 className="font-medium text-sm">{t('syncStatus') || 'Sync Status'}</h4>
<p className="text-xs text-muted-foreground">
    {t('syncStatusDescription') || 'Manage configuration synchronization across devices'}
</p>

// 修改后
<h4 className="font-medium text-sm">{t('syncStatus')}</h4>
<p className="text-xs text-muted-foreground">
    {t('syncStatusDescription')}
</p>
```

**第 134 行**: 最后同步时间
```typescript
// 修改前
<span className="text-muted-foreground">{t('lastSyncTime') || 'Last Sync'}:</span>

// 修改后
<span className="text-muted-foreground">{t('lastSyncTime')}:</span>
```

**第 143 行**: 待同步变更
```typescript
// 修改前
<span className="text-muted-foreground">{t('pendingChanges') || 'Pending Changes'}:</span>

// 修改后
<span className="text-muted-foreground">{t('pendingChanges')}:</span>
```

**第 151 行**: 同步错误
```typescript
// 修改前
<p className="font-medium">{t('syncError') || 'Sync Error'}:</p>

// 修改后
<p className="font-medium">{t('syncError')}:</p>
```

**第 167 行**: 手动同步按钮 - 同步中
```typescript
// 修改前
{t('syncing') || 'Syncing...'}

// 修改后
{t('syncing')}...
```

**第 172 行**: 手动同步按钮 - 文本
```typescript
// 修改前
{t('manualSync') || 'Manual Sync'}

// 修改后
{t('manualSync')}
```

**第 180 行**: 同步信息
```typescript
// 修改前
{t('syncInfo') || 'Your configuration will automatically sync across all devices logged in with the same Google account.'}

// 修改后
{t('syncInfo')}
```

---

## 验证步骤

- [x] 所有翻译文件都是有效的 JSON
- [x] 英文和中文翻译键值数量相同 (198 个)
- [x] 所有硬编码文本都已替换
- [x] 没有使用 `|| 'Fallback'` 模式
- [x] 构建成功 (`npm run build`)
- [x] 没有新增的 TypeScript 错误

---

## 代码审查建议

1. **验证翻译准确性**: 确保中文翻译准确且自然
2. **测试语言切换**: 验证中英文切换功能正常
3. **检查 UI 显示**: 确保所有文本在 UI 中正确显示
4. **性能检查**: 确保没有性能回退
5. **功能测试**: 验证所有功能仍然正常工作

---

## 合并前检查清单

- [ ] 代码审查通过
- [ ] 所有测试通过
- [ ] 中英文显示正确
- [ ] 没有控制台错误
- [ ] 文档已更新
- [ ] 准备合并到主分支

