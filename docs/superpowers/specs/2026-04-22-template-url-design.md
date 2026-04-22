# 模板 URL 侧栏页面设计

## 背景

参考文档 `furlg/docs/product-function-map.md` 中的“模板 URL”能力，需要在当前扩展的侧栏中新增一个独立一级入口，用于沉淀和执行可复用的搜索 URL 模板。

本次设计只覆盖：

- 模板配置层：新增、编辑、删除模板
- 搜索执行层：基于模板输入参数并打开生成后的 URL

本次明确不做：

- 常用书签 Dock
- 搜索历史记录
- 历史建议联想
- 模板分类与分组
- 书签导入为模板

## 目标

- 在侧栏中新增一个独立一级入口，承载模板 URL 能力
- 让用户可以保存常用站点的搜索 URL 模板
- 让用户可以直接从模板卡片发起搜索，而不必先打开目标网站
- 保持首版实现足够小，优先建立可扩展的数据结构和纯逻辑边界

## 非目标

- 不改造现有 Home 页面为搜索工作台
- 不在首版引入模板分类、排序、收藏等管理能力
- 不同步模板数据到远端或浏览器同步存储
- 不支持复杂模板语法，例如默认值、条件语法、数组参数

## 现状约束

当前新标签页内容切换由 `entrypoints/newtab/App.tsx` 统一控制，侧栏导航定义在 `entrypoints/sidebar.tsx`。仓库已有大量基于 `Dialog` 的表单交互，纯逻辑和存储测试主要放在 `lib/__tests__/`。

当前项目模式说明：

- 侧栏支持独立一级入口
- 页面适合做“列表页 + 弹窗”结构
- `browser.storage.local` 与 `wxt/storage` 均已在仓库使用
- 测试更偏向 `lib` 层，UI 组件未形成稳定测试模式

## 方案选择

候选方案：

1. 单页双栏工作台
2. 列表页 + 编辑弹窗 + 执行弹窗
3. 两级页签

最终选择方案 2。

选择原因：

- 与现有仓库的 `Dialog` 交互模式一致
- 主页面可以保持轻量，聚焦模板资产浏览和入口操作
- 模板管理与模板执行边界清晰，首版状态管理更可控
- 更适合作为独立一级入口落地，不需要引入复杂布局状态

## 用户体验设计

### 信息架构

在侧栏新增一个独立一级入口，名称为“模板 URL”。

导航层级调整后，一级入口包括：

- 首页
- 统计
- 模板 URL
- 工具
- 设置

移动端底部导航也同步增加“模板 URL”入口。

### 主页面

主页面采用模板卡片列表形式，负责“浏览、选择、触发操作”，不直接承载复杂表单。

页面内容包括：

- 页面标题与说明
- `新增模板` 主按钮
- 模板空状态
- 模板卡片列表

模板卡片展示字段：

- 模板名称
- 模板描述
- 模板 URL 摘要
- 占位符数量
- 默认打开方式

模板卡片操作：

- `立即搜索`
- `编辑`
- `删除`

空状态下显示简短说明和 `新增模板` 按钮，引导用户创建第一个模板。

### 新增/编辑模板弹窗

新增和编辑共用同一套表单组件，仅初始值和标题不同。

表单字段：

- 模板名称
- 模板描述
- 模板 URL
- 默认打开方式

辅助展示区域：

- 实时解析出的占位符列表
- URL 校验状态
- 校验失败时的错误提示

关键交互规则：

- `urlTemplate` 为单一事实来源
- 占位符列表由 `urlTemplate` 实时解析生成，不允许用户单独维护
- 模板名为空时不可保存
- URL 模板不合法时不可保存
- 占位符格式不合法时不可保存

### 执行搜索弹窗

执行弹窗根据当前模板中的占位符动态渲染输入表单。

弹窗内容包括：

- 模板名称
- 模板描述或 URL 预览
- 占位符输入项
- 默认打开方式与临时覆盖选项
- 生成后的最终 URL 预览
- `搜索` 按钮

执行规则：

- 如果模板没有占位符，允许直接打开 URL
- 如果模板存在占位符，所有输入项有值后才允许执行
- 提交前统一对替换值做 `encodeURIComponent`
- 用户可临时覆盖打开方式，不回写模板默认值

### 删除确认

删除模板使用轻量确认弹窗：

- 展示模板名称
- 明确说明删除后不可恢复
- 成功后刷新列表并给出 toast

## 数据模型

首版仅维护一份本地模板列表，不引入分类、历史、收藏、同步状态等扩展字段。

```ts
interface TemplateUrlItem {
    id: string;
    name: string;
    description?: string;
    urlTemplate: string;
    placeholders: string[];
    openMode: 'new-tab' | 'current-tab';
    createdAt: number;
    updatedAt: number;
}
```

说明：

- `placeholders` 为持久化后的派生字段，用于简化页面渲染
- 保存时始终根据 `urlTemplate` 重新解析，避免脏数据
- `createdAt` 和 `updatedAt` 用于后续支持排序或审计

存储结构建议：

- 使用单一 storage key 保存数组
- 首版保存到本地存储

建议 key：

```ts
const TEMPLATE_URL_STORAGE_KEY = 'local:templateUrls';
```

## 占位符语法与解析规则

首版只支持简单占位符语法：`{placeholder}`。

规则如下：

- 占位符名只允许字母、数字、下划线
- 占位符名必须以字母开头
- 同一个模板内允许同名占位符重复出现
- UI 只渲染一份同名输入项，但执行时替换所有出现位置
- URL 中不含占位符时，也允许保存为模板

合法示例：

- `https://www.google.com/search?q={keyword}`
- `https://example.com/search?city={city}&date={date}`
- `https://example.com/find?q={keyword}&source={keyword}`

非法示例：

- `https://example.com/search?q={keyword-name}`
- `https://example.com/search?q={1keyword}`
- `https://example.com/search?q={}`

解析输出要求：

- 返回去重后的占位符列表
- 保持首次出现顺序
- 不自动推断 label、类型、默认值

## URL 校验与生成规则

### 模板校验

模板校验在新增/编辑时执行，目标是判断模板是否可被可靠保存。

校验项：

- 模板名称非空
- URL 模板非空
- 将所有占位符统一替换为固定示例值 `example` 后，整体可被 `URL` 构造函数解析
- 模板中的占位符语法均合法

校验失败时：

- 在表单内联提示错误
- 禁止点击保存

### 执行校验

执行校验在点击 `搜索` 时执行。

校验项：

- 所有占位符均已填写
- 基于替换值生成后的最终 URL 合法

执行失败时：

- 阻止打开页面
- 在执行弹窗内提示错误

### URL 生成

生成逻辑：

1. 解析模板中的占位符
2. 按占位符名取输入值
3. 对输入值做 `encodeURIComponent`
4. 替换模板中的所有对应占位符
5. 返回最终 URL 字符串

## 页面与组件拆分

### 页面入口

- `entrypoints/newtab/template-urls.tsx`

职责：

- 加载模板列表
- 管理弹窗开关状态
- 持有当前编辑或执行中的模板
- 调用存储层 CRUD

### 组件

- `components/template-urls/template-url-list.tsx`
- `components/template-urls/template-url-card.tsx`
- `components/template-urls/template-url-form-dialog.tsx`
- `components/template-urls/template-url-run-dialog.tsx`

拆分原则：

- 列表与卡片负责展示和事件抛出
- 表单弹窗负责数据录入与内联校验
- 执行弹窗负责参数输入与最终 URL 预览

### 逻辑层

- `lib/templateUrlUtils.ts`
- `lib/templateUrlStorage.ts`

其中：

- `templateUrlUtils.ts` 只放纯逻辑
- `templateUrlStorage.ts` 只负责数据读写与序列化边界

## 路由与导航修改

需要改动：

- `entrypoints/sidebar.tsx`
- `entrypoints/newtab/App.tsx`

具体包括：

- 新增 `SidebarType.templateUrls`
- 在桌面侧栏增加“模板 URL”按钮
- 在移动底部导航增加“模板 URL”按钮
- 在 `App.tsx` 中增加对应页面渲染分支

## 存储接口设计

建议暴露以下接口：

```ts
function getTemplateUrls(): Promise<TemplateUrlItem[]>;
function saveTemplateUrl(input: Omit<TemplateUrlItem, 'id' | 'createdAt' | 'updatedAt' | 'placeholders'> & { id?: string }): Promise<TemplateUrlItem>;
function deleteTemplateUrl(id: string): Promise<void>;
function getTemplateUrlById(id: string): Promise<TemplateUrlItem | null>;
```

保存逻辑要求：

- 新增时创建 `id`、`createdAt`、`updatedAt`
- 编辑时保留原有 `id` 和 `createdAt`
- 每次保存重新解析并写入 `placeholders`
- 列表默认按 `updatedAt` 倒序

## 浏览器打开行为

打开行为依赖扩展环境中的浏览器 API。

执行搜索时：

- `new-tab` 使用 `browser.tabs.create`
- `current-tab` 优先更新当前激活标签页

如果当前标签页不存在、没有 `id`、或属于不适合更新的特殊页上下文：

- 降级为新标签页打开

此降级行为需要在实现中显式处理，避免当前页打开路径导致无响应。

## 错误处理策略

### 表单级错误

适用场景：

- 模板名称为空
- URL 模板为空
- URL 模板不合法
- 占位符语法非法
- 执行弹窗缺少必填参数

处理方式：

- 表单内联错误提示
- 禁止提交按钮

### 操作级错误

适用场景：

- 读取模板列表失败
- 保存模板失败
- 删除模板失败
- 执行打开失败

处理方式：

- 使用 toast 提示
- 保留当前界面状态，避免丢失输入

### 空状态

适用场景：

- 首次进入且没有任何模板

处理方式：

- 展示简短说明
- 引导用户点击 `新增模板`

## 国际化要求

需要在中英文资源中补齐文案，至少覆盖：

- 入口名称
- 页面标题与说明
- 新增、编辑、删除、立即搜索
- 模板字段名
- 校验错误
- 打开方式
- 空状态提示

涉及文件：

- `locales/zh_CN/common.json`
- `locales/en/common.json`

## 测试策略

首版测试只覆盖 `lib` 层，不新增 UI 测试。

### `lib/__tests__/templateUrlUtils.test.ts`

覆盖内容：

- 占位符解析
- 占位符去重且保持顺序
- 合法与非法占位符格式
- 模板 URL 校验
- 参数替换与编码
- 无占位符模板生成最终 URL

### `lib/__tests__/templateUrlStorage.test.ts`

覆盖内容：

- 空数据读取默认值
- 新增模板
- 编辑模板
- 删除模板
- 保存时自动更新 `placeholders`
- 列表按 `updatedAt` 排序

测试风格要求：

- 模仿现有 `lib/__tests__/tagStorage.test.ts`
- 使用 mock storage，不依赖真实浏览器环境

## 兼容性与扩展性

本设计为后续能力预留空间：

- 历史记录与历史建议可围绕 `TemplateUrlItem.id + placeholderName` 扩展
- 模板分类可在数据模型中新增 `groupId` 或 `category`
- Dock 能力可以在未来复用模板的执行能力，但不与本次实现耦合

首版不提前引入这些字段，避免过早设计。

## 实施边界

本次实现应控制在以下边界内：

- 新增一个一级侧栏入口
- 新增一个模板列表页面
- 新增新增/编辑弹窗
- 新增执行弹窗
- 新增本地存储模块与纯逻辑模块
- 新增对应的 `lib` 层测试

不应扩展到：

- Home 页面重构
- 书签体系联动
- AI 能力接入
- 历史建议
- Dock

## 验收标准

满足以下条件视为首版完成：

- 侧栏可进入“模板 URL”页面
- 用户可以新增、编辑、删除模板
- URL 模板能正确解析占位符并做内联校验
- 用户可以从模板卡片打开执行弹窗
- 执行弹窗能根据占位符生成输入项
- 搜索前能预览最终 URL
- 可以按当前页或新标签页打开结果
- `lib` 层测试覆盖模板解析与模板存储核心逻辑

## 风险与注意事项

- `URL` 构造校验与占位符替换顺序要保持一致，否则可能出现“可保存但不可执行”的不一致
- `current-tab` 打开方式在扩展上下文中可能受当前活动页状态影响，需要实现降级逻辑
- 如果直接把 `placeholders` 作为用户可编辑字段，会引入双向同步问题，因此必须坚持 `urlTemplate` 单一事实来源
- 首版 UI 文案必须明确“这是 URL 模板，不是浏览器书签”
