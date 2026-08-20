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

**芥子书签**是一款基于 WXT + React + Tailwind CSS + shadcn/ui 构建的现代化浏览器扩展（支持 Chrome 与 Firefox），集成了先进的 AI 技术与本地离线优先能力，让书签管理、网页剪藏与知识归档变得智能、高效、优雅。

- 🌐 运行环境：Node >= 18
- 🌍 语言支持：简体中文 / English
- 🎨 UI 风格：Warm Editorial / Archive 风格与经典 Blueprint 主题切换，支持明暗模式与动态主题色
- 🤖 AI 驱动：智能分类推荐、智能重命名、AI 标签生成、备份冲突智能解决、网页正文规范化排版
- 📝 深度剪藏：内置 Web to Obsidian 剪藏工作流，直写本地 Vault，支持 PicGo / Cloudflare R2 图床转存
- ☁️ 数据同步：支持 WebDAV 多端双向同步与智能增量备份合并
- 🔗 模板 URL：支持参数化动态快速检索与书签一键转模板

---

## ✨ 核心功能

### 🚀 快速添加书签 (Popup)
- **一键添加**：点击扩展图标快速保存当前页面
- **智能提取**：自动提取页面标题、URL 及 Favicon
- **灵活编辑**：支持实时修改标题、URL 与标签
- **🌟 AI 智能分类推荐**：
  - 自动分析页面内容，推荐最合适的文件夹
  - 显示推荐理由和置信度，支持单选/多推荐结果
  - 支持一键应用或手动级联选择
  - 智能降级策略与超时容错，确保流畅体验
- **🏷️ 智能标签生成**：支持调用 AI 自动分析网页并推荐语义标签
- **快捷操作**：支持一键直达 Obsidian 深度剪藏

### 📑 现代化书签管理看板 (Newtab)
- **层级化书签树**：支持级联导航、文件夹展开与路径追踪
- **多维度视图**：支持卡片网格与紧凑列表视图切换
- **强大的搜索与过滤**：支持按标题、URL 实时模糊搜索，以及按 `#标签` 进行精准筛选
- **批量管理**：支持批量多选、批量移动与批量删除
- **书签统计与可视化**：多维度图表统计（总书签数、文件夹数、重复数、深层分布等）

### 📝 Obsidian 网页剪藏与归档 (Side Panel)
- **智能正文抽取**：基于 Mozilla Readability 算法智能解析正文，支持可视选区高亮提取
- **Obsidian 规范 Markdown 转换**：自动构建 Frontmatter 元数据，支持 GFM 语法、表格与任务列表
- **🤖 AI 规范排版**：大模型结构优化与格式整理，具备代码/公式/图片 Token 占位保护
- **本地 Vault 静默直写**：基于 File System Access API 直写本地 Obsidian 笔记库，智能解决文件名冲突
- **防盗链图床转存**：支持本地 PicGo Server 及 Cloudflare R2 / S3 存储桶自动转存图片

### 🤖 AI 增强工具箱
- **AI 批量重命名 (Batch Rename)**：选择文件夹一键优化所有书签标题，风格一致性检测，可视化前后审查与差异对比
- **AI 批量打标 (Batch Tag)**：智能识别文件夹下所有书签内容并生成结构化标签，支持批量合并与增量打标
- **AI 智能分类整理**：支持对零散书签进行语义归类推荐与智能重整

### 🛠️ 书签维护与健康检查
- **重复书签管理**：多算法扫描重复链接，一键合并或清理
- **链接有效性检查**：批量异步探测链接状态，检测并标记 404/超时失效死链
- **空文件夹清理**：一键识别并批量删除冗余空目录

### 🔗 模板 URL (Template URLs)
- **参数化快速查询**：定义类似 `https://github.com/search?q={keyword}` 的动态链接模板
- **一键运行与直达**：弹窗输入变量参数立即生成并打开目标网页
- **书签智能导入**：自动识别收藏夹中的模式化 URL，一键提炼并导入为动态模板

### ☁️ 数据备份、同步与恢复
- **WebDAV 云端同步**：配置自建 WebDAV 服务器（如坚果云、Nextcloud），支持自动/手动双向备份
- **智能增量合并**：本地与远端多版本快照对比，支持基于 AI 的书签冲突智能解决
- **数据导入导出**：支持标准 HTML 书签文件、JSON 配置数据的导出与导入

### ⚙️ 灵活强大的配置中心
- **AI 服务配置向导**：
  - 支持 OpenAI、DeepSeek、Moonshot、Claude (OpenAI-compatible)、Ollama 本地大模型等预设
  - 支持 `chat/completions` 与 `responses` 两种 API 协议格式
  - 支持自定义 API Base URL、Key、Model ID 与连通性实时测试
- **AI 提示词管理**：支持自定义或一键重置重命名、分类推荐、智能打标、剪藏排版、冲突解决提示词
- **个性化外观**：支持 Default (Warm Editorial) 与 Blueprint 双主题、明暗模式跟随系统、7 种强调色切换
- **国际化多语言**：支持简体中文与 English 完整中英文界面无缝切换

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
