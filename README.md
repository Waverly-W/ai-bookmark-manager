# 芥子书签 (Mustard Seed Bookmark)

<div align="center">

**芥子纳须弥 · AI驱动的智能书签管理扩展**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Waverly-W/mustard-seed-bookmark)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[简体中文](#) | [English](#english-version)

</div>

---

## 📖 关于芥子

> "芥子纳须弥" —— 佛家典故，意指微小的芥子中能容纳巨大的须弥山。芥子书签寓意于此，帮助你在微小的浏览器扩展中，智能地收纳、整理和管理浩瀚网络世界中的无限信息。

**芥子书签**是一款基于 WXT + React + Tailwind CSS + shadcn/ui 构建的现代化 Chrome 扩展，集成了先进的 AI 技术，让书签管理变得智能、高效、优雅。

- 🌐 运行环境：Node >= 18
- 🌍 语言支持：简体中文 / English
- 🎨 UI 框架：shadcn/ui + Tailwind CSS
- 🤖 AI 驱动：智能推荐与批量重命名

---

## ✨ 核心功能

### 🚀 快速添加书签 (Popup)
- **一键添加**：点击扩展图标快速保存当前页面
- **智能获取**：自动提取页面标题和 URL
- **灵活编辑**：支持手动修改标题和 URL
- **实时验证**：确保输入数据的有效性
- **文件夹选择**：级联选择器，支持保存到任意文件夹
- **🌟 AI 智能推荐**：
  - 自动分析页面内容，推荐最合适的文件夹
  - 显示推荐理由和置信度
  - 支持一键应用或手动选择
  - 智能降级策略，确保流畅体验
- **自动关闭**：添加成功后自动关闭弹窗，流畅无感

### 🤖 AI 批量重命名
- **智能重命名**：选择文件夹，一键调用 AI 优化所有书签标题
- **可视化审查**：紧凑布局，原标题与新标题对比清晰
- **灵活编辑**：所见即所得，随时修改或重置建议
- **状态反馈**：清晰的成功/失败标识

### 📊 双模式进度显示
- **批量模式**：一次性请求，平滑进度动画（0→90%→100%）
- **逐个模式**：逐条处理，显示真实进度（current/total）
- **灵活切换**：在设置中自由选择适合的模式

### 📁 书签管理
- **根目录选择**：级联选择器，支持树形结构
- **主页展示**：自定义新标签页显示的书签范围

- **🎨 Material Design 3**: 全新视觉体验
  - **Tonal Palette**: 动态紫色系主题，柔和舒适
  - **Organic Shapes**: 圆润的 Pill 风格按钮与输入框
  - **Micro-interactions**: 细腻的交互动画与状态反馈
- **强调色**：7种精选配色方案（紫/蓝/绿/橙/红/粉/青）
- **多语言**：中文 / 英文无缝切换
- **响应式布局**：完美适配各种屏幕尺寸

### 🛠️ 高级书签工箱
- **重复书签管理**：扫描并清理重复书签，保持收藏夹整洁
- **链接有效性检查**：检测并标记失效链接，一键移除死链
- **空文件夹清理**：识别并删除无用的空文件夹
- **国际化界面**：工具页面支持中英双语切换

### ⚙️ AI 配置
- **灵活配置**：支持自定义 API 地址、Key 和模型 ID
- **连通性测试**：一键验证 API 配置
- **提示词管理**：自定义提示词或恢复默认
- **推荐设置**：
  - 启用/禁用智能推荐
  - 显示/隐藏推荐理由
  - 自动应用或仅作建议
  - 超时时间和降级策略

### 🌍 国际化支持
- 基于 react-i18next
- 按需加载命名空间
- 完整的中英文翻译

---

## 📦 技术栈

- **框架**：[WXT](https://wxt.dev) - 现代化浏览器扩展开发框架
- **UI**：React 18 + TypeScript
- **样式**：Tailwind CSS + [shadcn/ui](https://ui.shadcn.com)
- **国际化**：i18next + react-i18next
- **图标**：Lucide React + React Icons

---

## 🚀 快速开始

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/Waverly-W/mustard-seed-bookmark.git
cd mustard-seed-bookmark

# 安装依赖
npm install
```

### 开发模式

```bash
# Chrome 开发模式
npm run dev

# Firefox 开发模式
npm run dev:firefox
```

### 生产构建

```bash
# 同时构建 Chrome 插件和 Firefox Add-on
npm run build

# Chrome 构建
npm run build:chrome

# Firefox 构建
npm run build:firefox

# 打包为 zip
npm run zip
```

### 加载扩展

1. 运行 `npm run build`
2. Chrome：打开 `chrome://extensions/`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择 `dist/chrome-mv3`
3. Firefox：打开 `about:debugging`，点击「此 Firefox」，点击「临时载入附加组件」，选择 `dist/firefox-mv2`；如果弹出的是文件选择器，则进入该目录并选择 `manifest.json`

Firefox 的临时附加组件会在重启浏览器后失效；开发调试时也可以直接运行 `npm run dev:firefox`，由 WXT 启动 Firefox 并临时载入扩展。

---

## ⚙️ 配置指南

### AI 配置
1. 打开新标签页
2. 点击右上角「设置」图标
3. 进入「AI 设置」→「AI 服务」
4. 填写：
   - API Base URL（如：`https://api.openai.com/v1`）
   - API Key
   - Model ID（如：`gpt-4`）
5. 点击「测试连接」验证配置

### 外观设置
- **主题**：在设置中选择明亮或暗黑模式
- **强调色**：选择喜欢的主题色
- **语言**：切换中文或英文界面

### 书签设置
- 使用级联选择器选择主页显示的书签根目录

---

## 🧩 项目结构

```
```
mustard-seed-bookmark/
├── entrypoints/
│   ├── newtab/              # 新标签页
│   │   ├── App.tsx
│   │   └── settings.tsx     # 设置页面
│   ├── popup/               # 快速添加弹窗
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── background.ts        # 后台脚本
├── components/
│   ├── settings/            # 设置组件
│   │   ├── ai-config-settings.tsx
│   │   ├── ai-prompt-settings.tsx
│   │   ├── bookmark-settings.tsx
│   │   ├── theme-settings.tsx
│   │   └── accent-color-settings.tsx
│   └── ui/                  # shadcn/ui 组件
├── lib/                     # 业务逻辑
│   ├── aiService.ts         # AI 服务
│   ├── bookmarkUtils.ts     # 书签工具
│   └── accentColorUtils.ts  # 主题色工具
├── locales/                 # 国际化资源
│   ├── en/
│   └── zh_CN/
└── public/
    ├── icon/                # 扩展图标
    └── _locales/            # Manifest 本地化
```

---

## 🎯 使用场景

- 📚 **学习研究**：智能分类保存学术资料和参考文献
- 💼 **工作效率**：快速收集和整理工作相关资源
- 🎨 **灵感收集**：保存设计灵感和创意素材
- 🛍️ **购物清单**：管理待购商品和比价链接
- 📰 **阅读列表**：整理待读文章和新闻

---

## 🧠 常见问题

**Q: 进度条为何从 0 直接跳到 100%？**  
A: 批量模式下为单次 API 请求，显示模拟进度。可在设置中切换为「逐个模式」查看真实进度。

**Q: AI 推荐不准确怎么办？**  
A: 可以在设置中自定义推荐提示词，或调整推荐策略。同时支持手动选择文件夹。

**Q: 支持哪些 AI 模型？**  
A: 支持所有兼容 OpenAI API 格式的模型，包括 GPT-4、GPT-3.5、Claude（通过代理）等。

**Q: 数据安全吗？**  
A: 所有配置（包括 API Key）仅存储在浏览器本地，不会上传到任何服务器。

---

## 📝 开发计划

- [ ] 支持书签导入/导出
- [ ] 添加书签搜索功能
- [ ] 支持更多浏览器（Firefox、Edge）
- [ ] 添加书签统计和可视化
- [ ] 支持书签标签系统

---

## 🙌 致谢

感谢以下开源项目：

- [WXT](https://wxt.dev) - 现代化扩展开发框架
- [shadcn/ui](https://ui.shadcn.com) - 精美的 UI 组件库
- [Tailwind CSS](https://tailwindcss.com) - 实用优先的 CSS 框架
- [Lucide](https://lucide.dev) - 优雅的图标库

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 🌟 支持项目

如果这个项目对你有帮助，欢迎：

- ⭐ Star 本项目
- 🐛 提交 Issue 反馈问题
- 🔧 提交 Pull Request 贡献代码
- 📢 分享给更多人

---

<div align="center">

Made with ❤️ by [Waverly-W](https://github.com/Waverly-W)

**芥子纳须弥，智理书签**

</div>

---

## English Version

# Mustard Seed Bookmark

<div align="center">

**Mustard Seed Contains Sumeru · AI-Powered Smart Bookmark Manager**

</div>

## About

> "Mustard seed contains Sumeru" is a Buddhist metaphor meaning a tiny mustard seed can contain the immense Mount Sumeru. Mustard Seed Bookmark embodies this concept, helping you intelligently collect, organize, and manage infinite information from the vast web within a tiny browser extension.

**Mustard Seed Bookmark** is a modern Chrome extension built with WXT + React + Tailwind CSS + shadcn/ui, integrated with advanced AI technology to make bookmark management intelligent, efficient, and elegant.

## Key Features

- 🚀 **Quick Add Popup**: One-click bookmark saving with AI folder recommendations
- 🤖 **AI Batch Rename**: Intelligent batch renaming with review and edit capabilities
- 📊 **Dual Progress Modes**: Choose between batch or sequential processing
- 🎨 **Customizable Appearance**: Themes, accent colors, and multi-language support
- ⚙️ **Flexible AI Configuration**: Custom API settings and prompt management
- 🌍 **Internationalization**: Full support for English and Simplified Chinese

## Quick Start

```bash
# Clone and install
git clone https://github.com/Waverly-W/mustard-seed-bookmark.git
cd mustard-seed-bookmark
npm install

# Development
npm run dev

# Production build
npm run build
```

## Tech Stack

- **Framework**: WXT
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **i18n**: react-i18next

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Mustard Seed contains Sumeru, manages bookmarks wisely**

</div>
