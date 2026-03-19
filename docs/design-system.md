# Design System

## 视觉方向

项目当前采用 warm editorial / archive 风格，而不是常见的冷色 SaaS 面板。整体原则是：

- 用暖灰纸感背景和琥珀主色建立识别度。
- 用橄榄绿 `accent` 处理“正向、完成、推荐”类反馈。
- 让信息层级靠版式、留白、圆角和表面层次拉开，而不是靠大量饱和色。

## Token 约定

### Color

- `background`: 页面大底。
- `card` / `popover`: 主容器和浮层。
- `surface-1` / `surface-2` / `surface-3`: 次级表面递进。
- `primary`: 主操作、核心品牌强调、主要文件夹图标。
- `accent`: 推荐、完成、通过、辅助亮点。
- `destructive`: 危险操作、错误、失败状态。
- `muted-foreground`: 说明文案、辅助标签、次级元信息。

### Radius & Shadow

- 默认大卡片：`rounded-[1.5rem]` 或组件内置 `lg`。
- 小型输入/胶囊按钮：`rounded-full`。
- 局部信息块：`rounded-[1rem]` 到 `rounded-[1.25rem]`。
- 卡片阴影优先用 `shadow-sm` / `shadow-md`。
- 弹层优先用 `shadow-panel`，避免再手写 `shadow-2xl`。

## 组件使用规则

### Button

- 主 CTA 用 `default`。
- 次级操作优先 `outline` 或 `secondary`。
- 工具栏和弱交互优先 `ghost`。
- 不再单独手写按钮底色，优先扩展 `buttonVariants`。

### Input / Select

- 表单输入统一用柔和表面和 token 边框，不再使用蓝色焦点外的硬编码色。
- 触发器优先 `rounded-full`，用于匹配当前 quick-save 与 dashboard 风格。
- 下拉和弹层内容统一使用 `border-border/70 + bg-popover/98 + shadow-panel`。

### Card

- 主内容块统一基于 `Card`，保留 `bg-card/92` 的轻微透气感。
- 状态容器在卡片内部再用 `surface-2` 或 `primary/10` 做二级区分。
- 不建议继续出现裸 `border rounded-lg bg-background` 组合。

## 状态色规则

- 成功、推荐、完成：优先 `accent` 系列。
- 失败、删除、校验错误：统一 `destructive` 系列。
- 普通提醒和中性提示：使用 `primary-soft`、`surface-2` 或 `muted`。
- 除非业务必须，不再直接使用 `text-blue-*`、`text-green-*`、`bg-red-*` 之类硬编码。

## Dark Mode

- 深色主题已经由 token 驱动，组件内尽量不要再写 `dark:*` 分支。
- 若某个组件在深色下需要单独处理，优先先补 token，再决定是否加局部 `dark:*`。
- 弹层、卡片、输入框在深色下要保持“材质层级”清晰，而不是单纯提亮边框。

## 新增页面自检

- 是否优先使用了现有 `Card` / `Button` / `Input` / `Select` 原语。
- 是否只使用 token 颜色表达状态。
- 是否区分了页面底、卡片表面、浮层表面。
- 是否避免出现孤立的冷蓝色、纯黑投影和过小字号堆积。
