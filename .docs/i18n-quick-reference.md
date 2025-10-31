# AI 书签管家 - 国际化快速参考指南

## 快速开始

### 在组件中使用翻译

```typescript
import { useTranslation } from 'react-i18next';

export default function MyComponent() {
    const { t } = useTranslation();
    
    return (
        <div>
            <h1>{t('pageTitle')}</h1>
            <button>{t('save')}</button>
        </div>
    );
}
```

### 添加新的翻译键值

1. **编辑翻译文件**:
   - `locales/en/common.json` - 英文翻译
   - `locales/zh_CN/common.json` - 中文翻译

2. **添加键值对**:
```json
{
  "myNewKey": "English text here"
}
```

3. **在组件中使用**:
```typescript
<span>{t('myNewKey')}</span>
```

---

## 常见场景

### 1. 按钮文本
```typescript
<Button>{t('save')}</Button>
<Button>{t('cancel')}</Button>
<Button>{t('delete')}</Button>
```

### 2. 错误消息
```typescript
toast({
    title: t('validationError'),
    description: t('bookmarkNameEmpty'),
    variant: "destructive"
});
```

### 3. 成功消息
```typescript
toast({
    title: t('save'),
    description: t('bookmarkUpdatedSuccess'),
});
```

### 4. 加载状态
```typescript
{loading ? (
    <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('saving')}...
    </>
) : (
    t('save')
)}
```

### 5. 表单占位符
```typescript
<Input 
    placeholder={t('apiUrlPlaceholder')}
    type="url"
/>
```

### 6. 条件文本
```typescript
{isSearching ? t('searchNoResults') : t('noBookmarks')}
```

---

## 翻译键值分类

### UI 元素
- `save` - 保存
- `cancel` - 取消
- `delete` - 删除
- `edit` - 编辑
- `add` - 添加

### 消息类型
- **验证错误**: `validationError`, `bookmarkNameEmpty`, `bookmarkUrlEmpty`
- **成功消息**: `bookmarkUpdatedSuccess`, `aiRenameSuccess`
- **失败消息**: `saveFailed`, `failedToSaveBookmark`
- **加载状态**: `saving`, `syncing`, `loading`

### 同步相关
- `syncStatus` - 同步状态
- `synced` - 已同步
- `syncing` - 同步中
- `syncFailed` - 同步失败
- `lastSyncTime` - 最后同步时间
- `pendingChanges` - 待同步变更

### AI 功能
- `aiRenameSuccess` - AI重命名成功
- `aiRenameSuggestion` - AI建议
- `failedToLoadAIConfig` - 加载AI配置失败

---

## 检查清单

添加新功能时，请确保：

- [ ] 所有用户可见的文本都使用 `t()` 函数
- [ ] 在 `locales/en/common.json` 中添加英文翻译
- [ ] 在 `locales/zh_CN/common.json` 中添加中文翻译
- [ ] 键值名称清晰且具有描述性
- [ ] 没有硬编码的中英文文本
- [ ] 没有使用 `|| 'Fallback'` 模式
- [ ] 构建成功 (`npm run build`)

---

## 常见错误

### ❌ 错误做法
```typescript
// 硬编码文本
<button>Save</button>

// 使用 fallback
{t('key') || 'Fallback text'}

// 混合中英文
<span>保存 Save</span>
```

### ✅ 正确做法
```typescript
// 使用 i18n
<button>{t('save')}</button>

// 确保键值存在
{t('key')}

// 分别翻译
<span>{t('save')}</span>
```

---

## 文件位置

- **翻译文件**: `locales/{lang}/common.json`
- **i18n 配置**: `components/i18n.ts`, `components/i18nConfig.ts`
- **使用示例**: 查看 `components/ui/` 和 `components/settings/` 中的组件

---

## 支持的语言

- `en` - English (英文)
- `zh_CN` - 简体中文

---

## 更多信息

- 详细审查报告: `.docs/i18n-audit-report.md`
- 实施总结: `.docs/i18n-implementation-summary.md`
- 项目文档: 查看 README.md

