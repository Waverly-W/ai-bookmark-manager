# 芥子书签隐私政策 / Mustard Seed Bookmark Privacy Policy

生效日期 / Effective date: 2026-10-10

## 中文

芥子书签用于保存、整理和检索浏览器书签，以及将用户选择的网页剪藏到本地笔记文件夹。扩展将新标签页替换为书签看板。扩展没有开发者运营的数据收集服务器、广告跟踪或分析遥测。

### 数据与用途

- 书签标题、URL、文件夹、标签及维护快照：用于书签展示、搜索、分类、批量操作、撤销和备份。
- 当前网页的标题、URL、用户选取或提取的正文、图片和生成的 Markdown：用于收藏、剪藏、预览和保存笔记。只读取功能所需的页面内容，不持续记录完整浏览历史。
- AI 服务地址、模型配置、API Key，WebDAV 凭据、图床配置与密钥：用于连接用户选择的服务。密钥在浏览器本地保存，本地存储和 Base64 编码不等于加密保护。
- 外观、语言、提示词、目录授权和剪藏任务：用于用户设置与任务恢复。所选本地目录由浏览器授权管理。

### 外部传输与用户选择

基础书签整理可在本地运行。外部服务按功能使用：

- AI：用户主动执行 AI 功能，或单独开启默认关闭的弹窗自动 AI、剪藏自动排版后，扩展将相关标题、URL、文件夹路径、书签上下文、提示词或网页正文发送到用户配置的 AI 地址。备份冲突处理可发送非敏感的冲突内容。不同功能发送内容不同；服务商可能收费，数据保留由该服务商的政策决定。API Key 仅用于该 AI 服务的认证，不作为备份冲突内容发送。
- WebDAV：用户启动备份或恢复时，将书签、标签、非敏感 AI 设置及提示词发送到用户配置的服务器。备份不包含密钥或密码；历史备份里的认证字段不会恢复。旧备份可能仍含历史密钥，需由用户在服务器删除并在服务商处轮换。
- 图床：用户开启图床转存或测试上传时，图片发送到配置的 PicGo 或 Cloudflare R2 服务，返回的地址用于笔记。转存的图片可能成为公开链接，取决于图床设置。
- 网站访问：用户启动失效链接检测、剪藏或图片下载时，扩展请求相关网站。对方可能收到 URL、IP 地址及常规网络请求信息。
- 网站图标：Chrome 版优先使用浏览器内部图标接口；其他支持场景的网络备用方式可能向 Google、DuckDuckGo 或 Favicon Grabber 发送网站域名。

公网 AI、WebDAV、PicGo 服务须使用 HTTPS，本机 localhost、127.0.0.1 或 ::1 服务可使用 HTTP。用户可拒绝或撤销网站权限，并关闭自动 AI。站点访问授权与自动 AI 开关是独立选择。

### 保存、删除与有限使用

书签由浏览器书签系统管理，浏览器自身的同步功能遵循其提供商的政策。配置及缓存保存在扩展本地存储或 IndexedDB；剪藏文件写入用户选择的文件夹。卸载扩展会移除其本地扩展存储，但不会删除浏览器书签、已保存的笔记或外部备份。用户可在浏览器中删除书签、在文件管理器中删除笔记、在外部服务器删除备份和图片，并在服务提供商处撤销密钥。

扩展不出售用户数据，不为广告或信用评估使用用户数据。数据仅用于上述用户可见功能及其必要操作，不向无关第三方共享。外部服务按用户配置接受请求，开发者无法控制其独立数据保留政策。

隐私问题与删除请求可通过项目支持页联系：https://github.com/Waverly-W/ai-bookmark-manager/issues 。请勿在公开问题中提交密钥、私人书签或网页正文。

## English

Mustard Seed Bookmark saves, organizes and searches browser bookmarks and clips selected web pages to a local notes directory. It replaces the new tab page with a bookmark dashboard. The extension has no developer-operated collection server, advertising tracking or analytics telemetry.

### Data and purposes

The extension processes bookmark titles, URLs, folders, tags and maintenance snapshots for bookmark management, undo and backup. It processes the current page title, URL, selected or extracted content, images and Markdown for saving and clipping; it does not continuously record a complete browsing history. Service endpoints, model settings, API keys, WebDAV credentials and image-host credentials are stored locally to connect to services selected by the user. Local storage and Base64 encoding are not encryption. Preferences, prompts, directory permissions and clipping jobs support settings and task recovery.

### Transmission and choices

- AI requests are made when users invoke an AI action or separately enable popup automatic AI or clipper automatic formatting, both off by default. Depending on the feature, relevant titles, URLs, folder paths, bookmark context, prompts or page text are sent to the configured AI endpoint. Backup conflict resolution sends non-sensitive conflicts. Keys authenticate to the configured service and are not sent as conflict data. Providers may charge fees and apply their own retention policies.
- User-initiated WebDAV backup transfers bookmarks, tags, non-sensitive AI settings and prompts to the configured server. Credentials are excluded; credentials in historical backups are not restored. Users should delete historical backups containing secrets and rotate affected keys.
- When image rehosting is enabled or a test upload is requested, images are uploaded to configured PicGo or Cloudflare R2 services. Resulting URLs may be public according to the host's configuration.
- Link checks, page clipping and image downloads contact relevant websites, which may receive requested URLs, IP addresses and normal request metadata.
- Chrome prefers its internal favicon API. Network fallback in other supported contexts may share website domains with Google, DuckDuckGo or Favicon Grabber.

Remote AI, WebDAV and PicGo services require HTTPS; HTTP is permitted only for localhost, 127.0.0.1 or ::1 services. Users may deny or revoke website permissions and disable automatic AI. Host permission and automatic AI consent are separate choices.

### Retention, deletion and limited use

Bookmarks are managed by the browser; browser sync is governed by the browser provider. Extension settings and caches remain in local extension storage or IndexedDB. Notes are written to the selected local directory. Uninstalling removes local extension storage but does not delete bookmarks, saved notes or remote backups. Users can delete those separately and revoke credentials with their service providers.

The extension does not sell data or use it for advertising or credit assessment. Data is used only for the described user-facing features and necessary operations and is not shared with unrelated third parties. User-configured services apply their own retention policies.

Privacy support: https://github.com/Waverly-W/ai-bookmark-manager/issues . Do not post keys, private bookmarks or page content in public issues.
