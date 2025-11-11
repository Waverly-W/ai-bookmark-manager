# JSON Mode 实现文档

## 概述

为了解决用户自定义 Prompt 后导致 AI 返回格式不可控的问题，我们实现了 **JSON Mode** 功能。JSON Mode 通过在 API 请求中添加 `response_format: {"type": "json_object"}` 参数，确保 AI 始终返回标准的 JSON 格式，从而避免解析失败。

## 问题背景

### 原始问题
- 用户修改"推荐提示词设置"后，文件夹推荐功能频繁失败
- 错误提示："无法解析推荐结果，使用默认文件夹"
- 根本原因：用户自定义 Prompt 时可能移除格式要求，导致 AI 返回自然语言而非 JSON

### 解决方案
参考阿里云通义千问的 JSON Mode 文档：
- 文档链接：https://help.aliyun.com/zh/model-studio/json-mode
- 核心机制：设置 `response_format` 参数为 `{"type": "json_object"}`
- 要求：System Message 或 User Message 必须包含 "JSON" 关键词（不区分大小写）

## 实现细节

### 1. 修改 AI API 调用函数

**文件：`lib/folderRecommendation.ts`**

在 `callAIForRecommendation()` 函数中添加 `response_format` 参数：

```typescript
const requestBody: any = {
    model: modelId,
    messages: [
        {
            role: 'user',
            content: prompt
        }
    ],
    temperature: 0.3,
    max_tokens: 150,
    // 启用 JSON Mode 确保返回标准 JSON 格式
    response_format: { type: 'json_object' }
};
```

### 2. 更新 Prompt 模板

**文件：`lib/aiPromptUtils.ts`**

#### 多推荐 Prompt（中文）
```
【重要】必须返回 JSON 格式的响应，格式如下：
{
  "recommendations": [
    {"index": 1, "reason": "推荐理由", "confidence": 0.9},
    {"index": 2, "reason": "推荐理由", "confidence": 0.7}
  ]
}

不要返回任何其他文本或解释，只返回 JSON 对象。
```

#### 多推荐 Prompt（英文）
```
【IMPORTANT】You MUST return a JSON format response as follows:
{
  "recommendations": [
    {"index": 1, "reason": "explanation", "confidence": 0.9},
    {"index": 2, "reason": "explanation", "confidence": 0.7}
  ]
}

Do not return any other text or explanation, only return the JSON object.
```

#### 单推荐 Prompt（中文）
```
【重要】必须返回 JSON 格式的响应：
{"recommendation": {"index": 序号, "reason": "推荐理由", "confidence": 0.9}}

不要返回任何其他文本或解释，只返回 JSON 对象。
```

#### 单推荐 Prompt（英文）
```
【IMPORTANT】You MUST return a JSON format response:
{"recommendation": {"index": number, "reason": "explanation", "confidence": 0.9}}

Do not return any other text or explanation, only return the JSON object.
```

### 3. 更新解析逻辑

**文件：`lib/folderRecommendation.ts`**

#### 多推荐解析（支持新旧格式）
```typescript
// 支持两种格式：
// 1. 新格式（JSON Mode）: {"recommendations": [...]}
// 2. 旧格式（兼容）: [...]
let recommendationsArray: any[] = [];

if (json.recommendations && Array.isArray(json.recommendations)) {
    // 新格式：JSON Mode 返回的对象格式
    recommendationsArray = json.recommendations;
    console.log('[FolderRecommendation] 使用新格式（JSON Mode）');
} else if (Array.isArray(json)) {
    // 旧格式：直接返回数组（向后兼容）
    recommendationsArray = json;
    console.log('[FolderRecommendation] 使用旧格式（数组）');
}
```

#### 单推荐解析（支持新旧格式）
```typescript
// 支持两种格式：
// 1. 新格式（JSON Mode）: {"recommendation": {"index": ..., "reason": ..., "confidence": ...}}
// 2. 旧格式（兼容）: {"index": ..., "reason": ..., "confidence": ...}
let recommendationData = json.recommendation || json;
```

## JSON Mode 要求

### 支持的模型
根据阿里云文档，以下模型支持 JSON Mode：
- Qwen（通义千问）系列：Max、Plus、Flash、Turbo、Coder、Long
- Qwen3/Qwen3-Coder/Qwen2.5 开源模型
- Qwen3-VL-Plus/Flash 多模态模型
- GLM-4.6/4.5/4.5-air

### 必要条件
1. **API 请求中包含 `response_format: {"type": "json_object"}`**
2. **Prompt 中必须包含 "JSON" 关键词**（不区分大小写）
   - 可以是 "JSON"、"json"、"Json" 等任何形式
   - 必须出现在 System Message 或 User Message 中

### 效果
- AI 保证返回标准 JSON 格式
- 不会包含 Markdown 代码块标记（如 ```json）
- 不会包含额外的解释文本
- 大幅降低解析失败率

## 向后兼容性

为了确保与旧版本和不支持 JSON Mode 的模型兼容，解析逻辑同时支持：

1. **新格式（JSON Mode）**
   - 多推荐：`{"recommendations": [...]}`
   - 单推荐：`{"recommendation": {...}}`

2. **旧格式（兼容）**
   - 多推荐：`[...]`（直接返回数组）
   - 单推荐：`{...}`（直接返回对象）

## 调试建议

### 查看日志
在浏览器开发者工具的控制台中，可以看到详细的调试信息：

```
[FolderRecommendation] 启用 JSON Mode，请求体: {...}
[FolderRecommendation] AI 原始响应: {...}
[FolderRecommendation] 清理后的响应: {...}
[FolderRecommendation] 解析后的 JSON: {...}
[FolderRecommendation] 使用新格式（JSON Mode）
[FolderRecommendation] 成功解析推荐: [...]
```

### 常见问题

#### 1. 仍然解析失败
**可能原因：**
- AI 模型不支持 JSON Mode
- Prompt 中缺少 "JSON" 关键词

**解决方案：**
- 检查使用的 AI 模型是否在支持列表中
- 确保 Prompt 中包含 "JSON" 关键词
- 查看控制台日志，检查 AI 返回的原始响应

#### 2. 用户自定义 Prompt 后失败
**可能原因：**
- 用户移除了 "JSON" 关键词

**解决方案：**
- 在设置界面添加提示，说明自定义 Prompt 必须包含 "JSON" 关键词
- 在保存自定义 Prompt 时进行验证，检查是否包含 "JSON"

#### 3. 不同 AI 服务商的兼容性
**注意事项：**
- JSON Mode 是 OpenAI 和部分兼容服务商支持的功能
- 如果使用不支持的服务商，可能会忽略 `response_format` 参数
- 建议在文档中说明推荐使用的 AI 服务商

## 未来优化

### 1. 配置选项
可以在设置中添加 JSON Mode 开关：
```typescript
interface FolderRecommendationConfig {
    // ... 其他配置
    useJsonMode: boolean; // 是否启用 JSON Mode（默认 true）
}
```

### 2. Prompt 验证
在保存自定义 Prompt 时，验证是否包含 "JSON" 关键词：
```typescript
function validateCustomPrompt(prompt: string): boolean {
    return /json/i.test(prompt);
}
```

### 3. 错误提示优化
当 JSON Mode 失败时，提供更友好的错误提示：
```
"AI 返回格式不正确。请确保：
1. 使用的 AI 模型支持 JSON Mode
2. 自定义 Prompt 中包含 'JSON' 关键词"
```

## 总结

通过实现 JSON Mode，我们解决了用户自定义 Prompt 后导致的解析失败问题。主要改进包括：

1. ✅ 在 API 请求中添加 `response_format: {"type": "json_object"}`
2. ✅ 更新 Prompt 模板，明确要求返回 JSON 格式并包含 "JSON" 关键词
3. ✅ 更新解析逻辑，同时支持新旧格式，确保向后兼容
4. ✅ 添加详细的调试日志，便于问题排查

这些改进大幅提高了文件夹推荐功能的稳定性和可靠性，即使用户自定义 Prompt，只要包含 "JSON" 关键词，也能确保正确解析。

