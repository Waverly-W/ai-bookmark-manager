# AI 书签管家（AI Bookmark Manager）

> 基于 WXT + React + Tailwind CSS + shadcn/ui 的 Chrome 扩展。支持 AI 批量重命名书签、可审查与编辑的结果列表、两种进度模式、书签根目录选择、外观设置（主题/强调色/语言）以及 AI 配置与提示词设置。

- 运行环境：Node >= 18
- 语言：简体中文 / English

---

## ✨ 功能特性

- AI 批量重命名书签
  - 选择文件夹，一键调用 AI 生成新标题
  - 审查页面单行紧凑布局，原/新标题对比清晰
  - 建议标题与输入框合并，所见即所得，可随时修改/重置
  - 成功/失败状态标识与提示
- 进度条两种模式（可在设置中切换）：
  - 批量模式：一次性请求，进度条平滑模拟（0→90%→100%）
  - 逐个模式：逐条请求，显示真实进度（current/total）
- 书签设置
  - 级联文件夹选择器，支持树结构
  - 指定主页展示的书签根目录
- 外观设置（与 Tab 同宽，水平平铺）
  - 主题设置：明亮 / 暗黑
  - 强调色设置：多种主题色一键切换
  - 界面语言：中文 / 英文
- AI 设置
  - API 地址 / Key / 模型 ID 配置
  - 一键连通性测试
  - 提示词管理（自定义 / 恢复默认）
- 国际化
  - 使用 react-i18next，按需加载命名空间

---

## 📦 技术栈
- WXT（浏览器扩展开发框架）
- React + TypeScript
- Tailwind CSS + shadcn/ui
- i18next（国际化）

---

## 🚀 快速开始

```bash
# 克隆并进入项目
git clone https://github.com/Waverly-W/ai-bookmark-manager.git
cd ai-bookmark-manager

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
```

### 在浏览器中加载扩展
1. 运行 `npm run build`
2. 打开 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `.output/chrome-mv3` 目录

---

## ⚙️ 配置说明

### AI 配置
- 设置位置：新标签页 → 设置 → AI 设置
- 需填写：API Base URL、API Key、Model ID
- 支持连通性测试；提示词可自定义并恢复默认

### 外观设置
- 与上方 Tab 等宽，采用水平三列布局（移动端自动改为一列）
- 包含主题、强调色、界面语言三项

### 书签设置
- 使用级联选择器选择书签根目录（树结构）

---

## 🧩 目录结构（节选）

```
├── entrypoints/newtab/          # 新标签页
│   ├── App.tsx
│   └── settings.tsx             # 设置页（Tab 布局）
├── components/settings/         # 各类设置组件
│   ├── ai-config-settings.tsx
│   ├── ai-prompt-settings.tsx
│   ├── bookmark-settings.tsx
│   ├── theme-settings.tsx
│   └── accent-color-settings.tsx
├── lib/                         # 业务逻辑
│   ├── aiService.ts             # 批量/逐个处理 + 进度回调
│   └── accentColorUtils.ts
├── locales/                     # 文案与i18n资源
└── public/_locales/             # 扩展名称与描述（manifest 本地化）
```

---

## 🧠 常见问题
- 进度条为何从 0 直接跳到 100%？
  - 批量模式下为单次请求，显示模拟进度；可切换为逐个模式查看真实进度
- 样式在部分网站不一致？
  - 已使用 postcss-rem-to-px 解决 shadow DOM 下 rem 计算差异问题

---

## 📝 许可
本项目作为学习与示例用途提供。请在遵守本仓库 License 的前提下使用。

---

## 🙌 致谢
- [WXT](https://wxt.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)

如果本项目对你有帮助，欢迎 Star 支持！