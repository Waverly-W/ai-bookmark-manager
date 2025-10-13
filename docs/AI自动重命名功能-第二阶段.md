# AI自动重命名书签功能 - 第二阶段实现说明

## 阶段概述

第二阶段完成了重命名规范配置功能，用户可以自定义AI重命名书签的Prompt模板，提供了更灵活的重命名规则配置。

## 功能特性

### 🎯 **Prompt模板管理**

#### 1. **默认模板**
**中文默认模板**：
```
请根据以下书签的URL和当前标题，生成一个简洁、描述性的中文标题。

要求：
1. 不超过30个字符
2. 准确反映网页内容
3. 便于搜索和识别
4. 只返回新标题，不要有其他说明文字

书签URL: {url}
当前标题: {title}

新标题：
```

**英文默认模板**：
```
Based on the following bookmark's URL and current title, generate a concise and descriptive title.

Requirements:
1. No more than 50 characters
2. Accurately reflect the page content
3. Easy to search and identify
4. Return only the new title, no additional text

Bookmark URL: {url}
Current Title: {title}

New Title:
```

#### 2. **自定义模板**
- 支持用户完全自定义Prompt内容
- 使用`{url}`和`{title}`作为占位符
- 自动替换占位符为实际的书签数据
- 模板验证（长度、格式检查）

#### 3. **模板切换**
- 自动检测当前使用的是默认模板还是自定义模板
- 一键恢复默认模板
- 保存自定义模板到本地存储

### 🎨 **用户界面**

#### Prompt设置界面
```
┌─────────────────────────────────────────────┐
│ 重命名规范配置                    使用自定义模板 │
│ 自定义AI重命名书签的提示词模板              │
│                                             │
│ 提示词模板                                  │
│ ┌─────────────────────────────────────────┐ │
│ │ 请根据以下书签的URL和当前标题，生成一个 │ │
│ │ 简洁、描述性的中文标题。                │ │
│ │                                         │ │
│ │ 要求：                                  │ │
│ │ 1. 不超过30个字符                       │ │
│ │ 2. 准确反映网页内容                     │ │
│ │ 3. 便于搜索和识别                       │ │
│ │ 4. 只返回新标题，不要有其他说明文字     │ │
│ │                                         │ │
│ │ 书签URL: {url}                          │ │
│ │ 当前标题: {title}                       │ │
│ │                                         │ │
│ │ 新标题：                                │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 💡 使用 {url} 和 {title} 作为占位符        │
│                                             │
│ [恢复默认]  [保存模板]                      │
│                                             │
│ Example placeholders:                       │
│ {url} → https://example.com/page            │
│ {title} → Current Bookmark Title            │
└─────────────────────────────────────────────┘
```

## 技术实现

### 📁 **新增文件结构**

```
lib/
└── aiPromptUtils.ts              # Prompt模板管理工具函数

components/settings/
└── ai-prompt-settings.tsx       # Prompt设置组件

docs/
└── AI自动重命名功能-第二阶段.md  # 功能说明文档
```

### 🔧 **核心模块**

#### 1. **aiPromptUtils.ts** - Prompt管理
```typescript
// 默认模板常量
export const DEFAULT_PROMPT_ZH: string
export const DEFAULT_PROMPT_EN: string

// 核心函数
getDefaultPrompt(locale: string): string
saveCustomPrompt(prompt: string): Promise<void>
getCurrentPrompt(locale: string): Promise<string>
isUsingCustomPrompt(): Promise<boolean>
restoreDefaultPrompt(): Promise<void>
clearCustomPrompt(): Promise<void>
formatPrompt(template: string, url: string, title: string): string
validatePrompt(prompt: string): { valid: boolean; errors: string[] }
```

**存储结构**：
```typescript
{
  aiCustomPrompt: string,      // 自定义Prompt内容
  aiUseCustomPrompt: boolean   // 是否使用自定义Prompt
}
```

#### 2. **AIPromptSettings组件**
```typescript
// 状态管理
const [prompt, setPrompt] = useState('')
const [loading, setLoading] = useState(true)
const [saving, setSaving] = useState(false)
const [restoring, setRestoring] = useState(false)
const [isCustom, setIsCustom] = useState(false)

// 核心功能
handlePromptChange(e)        // 处理Prompt输入变化
handleSavePrompt()          // 保存自定义Prompt
handleRestoreDefault()      // 恢复默认Prompt
```

#### 3. **智能语言适配**
- 根据当前界面语言自动选择默认模板
- 中文界面使用中文Prompt模板
- 英文界面使用英文Prompt模板
- 语言切换时自动更新默认模板

#### 4. **占位符系统**
```typescript
// 占位符替换
formatPrompt(template, url, title) {
    return template
        .replace(/{url}/g, url)
        .replace(/{title}/g, title);
}

// 使用示例
const template = "URL: {url}, Title: {title}";
const formatted = formatPrompt(template, "https://example.com", "Example");
// 结果: "URL: https://example.com, Title: Example"
```

### 🔄 **与第一阶段的集成**

#### 更新aiService.ts
```typescript
// 之前的实现
const prompt = customPrompt || defaultPrompt;

// 新的实现
const promptTemplate = await getCurrentPrompt(locale);
const prompt = formatPrompt(promptTemplate, bookmarkUrl, currentTitle);
```

**优势**：
- 自动使用用户配置的Prompt模板
- 支持占位符替换
- 根据语言自动选择合适的默认模板

### 🌐 **国际化支持**

#### 新增文本
```json
// 中文
{
  "aiPromptSettings": "重命名规范配置",
  "aiPromptDescription": "自定义AI重命名书签的提示词模板",
  "promptTemplate": "提示词模板",
  "promptPlaceholder": "在此输入自定义提示词模板...",
  "promptHint": "使用 {url} 和 {title} 作为占位符，它们将被替换为实际的书签URL和标题",
  "restoreDefault": "恢复默认",
  "saveTemplate": "保存模板",
  "templateSaved": "模板已保存",
  "templateRestored": "已恢复默认模板",
  "usingDefaultTemplate": "当前使用默认模板",
  "usingCustomTemplate": "当前使用自定义模板"
}

// 英文
{
  "aiPromptSettings": "Rename Prompt Configuration",
  "aiPromptDescription": "Customize the AI prompt template for renaming bookmarks",
  "promptTemplate": "Prompt Template",
  "promptPlaceholder": "Enter your custom prompt template here...",
  "promptHint": "Use {url} and {title} as placeholders, they will be replaced with actual bookmark URL and title",
  "restoreDefault": "Restore Default",
  "saveTemplate": "Save Template",
  "templateSaved": "Template saved",
  "templateRestored": "Default template restored",
  "usingDefaultTemplate": "Using default template",
  "usingCustomTemplate": "Using custom template"
}
```

### 📊 **构建结果**

- **构建成功**: 总大小808.19 kB
- **新增功能**: Prompt模板管理
- **新增组件**: AIPromptSettings
- **新增工具**: aiPromptUtils
- **功能完整**: 所有Prompt配置功能正常工作

## 用户体验设计

### ✨ **交互特性**

#### 1. **智能状态显示**
- 右上角显示当前使用的模板类型
- "使用默认模板" / "使用自定义模板"
- 恢复默认按钮仅在使用自定义模板时可用

#### 2. **实时反馈**
- 保存成功的Toast通知
- 恢复默认的Toast通知
- 加载状态指示器
- 错误提示和验证

#### 3. **用户指导**
- 占位符使用说明
- 示例占位符展示
- 提示信息框说明占位符用法

#### 4. **表单验证**
```typescript
validatePrompt(prompt: string) {
    const errors = [];
    
    if (!prompt || prompt.trim() === '') {
        errors.push('Prompt template cannot be empty');
    }
    
    if (prompt && prompt.length < 20) {
        errors.push('Prompt template is too short (minimum 20 characters)');
    }
    
    if (prompt && prompt.length > 2000) {
        errors.push('Prompt template is too long (maximum 2000 characters)');
    }
    
    return { valid: errors.length === 0, errors };
}
```

### 🎯 **设计亮点**

#### 1. **模块化设计**
- Prompt管理与AI配置分离
- 独立的工具函数库
- 可复用的组件设计

#### 2. **灵活性**
- 完全自定义的Prompt内容
- 占位符系统支持动态内容
- 语言自适应的默认模板

#### 3. **用户友好**
- 直观的界面设计
- 清晰的操作反馈
- 详细的使用说明

## 使用指南

### 👤 **用户操作流程**

#### 1. **查看默认模板**
1. 打开AI设置Tab
2. 查看Prompt设置组件
3. 默认显示当前语言的默认模板

#### 2. **自定义模板**
1. 在文本框中编辑Prompt内容
2. 使用`{url}`和`{title}`作为占位符
3. 点击"保存模板"
4. 查看状态变为"使用自定义模板"

#### 3. **恢复默认**
1. 点击"恢复默认"按钮
2. 确认Toast通知
3. 查看状态变为"使用默认模板"

### 🔧 **开发者扩展**

#### 1. **添加新的占位符**
```typescript
// 在formatPrompt函数中添加新的替换规则
export const formatPrompt = (template: string, url: string, title: string, domain?: string): string => {
    return template
        .replace(/{url}/g, url)
        .replace(/{title}/g, title)
        .replace(/{domain}/g, domain || new URL(url).hostname);  // 新增域名占位符
};
```

#### 2. **添加模板预设**
```typescript
// 创建模板预设系统
export const TEMPLATE_PRESETS = {
    simple: "Generate a short title for: {title}",
    detailed: "Based on {url}, create a descriptive title for: {title}",
    technical: "Create a technical documentation title for: {title} from {url}"
};
```

#### 3. **模板验证增强**
```typescript
// 添加更多验证规则
const hasRequiredPlaceholders = prompt.includes('{url}') || prompt.includes('{title}');
if (!hasRequiredPlaceholders) {
    errors.push('Template should contain at least one placeholder ({url} or {title})');
}
```

## 下一阶段预告

### 第三阶段：单条书签重命名功能
- 在书签卡片添加"AI重命名"按钮
- 实现重命名对比界面（原标题 vs AI建议标题）
- 集成AI API调用和Prompt系统
- 更新Chrome书签数据和插件显示

### 第四阶段：批量AI重命名
- 创建批量重命名专用页面
- 实现文件夹选择器
- 显示批量处理进度条
- 提供差异对比表格和选择性应用

## 总结

第二阶段成功实现了Prompt模板管理系统，为AI重命名功能提供了高度的自定义能力。

### 🎯 **核心成就**
- ✅ 完整的Prompt模板管理系统
- ✅ 智能的语言适配机制
- ✅ 灵活的占位符替换系统
- ✅ 用户友好的编辑界面
- ✅ 完善的模板验证机制
- ✅ 与第一阶段的无缝集成
- ✅ 为后续阶段提供的Prompt支持

现在用户可以完全自定义AI重命名的规则，为接下来的实际重命名功能提供了强大的配置基础！🎉
