import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

const basePermissions = ["storage", "tabs", "contextMenus", "bookmarks", "activeTab", "scripting", "sidePanel"];
const hostPermissions = ["https://*/*", "http://*/*"];

// See https://wxt.dev/api/config.html
export default defineConfig({
    outDir: 'dist',
    manifest: ({ browser }) => ({
        permissions: browser === "firefox" ? [...basePermissions, ...hostPermissions] : [...basePermissions, "favicon"],
        // Chrome：安装时不再索取「读取所有网站数据」。需要访问某个站点的功能（AI 服务、WebDAV、
        // 图床、失效链接检测、侧边栏读取页面）在用户点击时通过 lib/hostAccess.ts 单独申请。
        // Firefox（MV2）不支持可选主机权限的这种用法，保持在 permissions 里声明。
        ...(browser === "firefox" ? {} : {
            optional_host_permissions: [...hostPermissions]
        }),
        action: {},
        side_panel: {
            default_path: "sidepanel.html"
        },
        name: '__MSG_extName__',
        description: '__MSG_extDescription__',
        default_locale: "en",
        ...(browser === "firefox" ? {} : {
            web_accessible_resources: [
                {
                    resources: ["_favicon/*"],
                    matches: ["<all_urls>"]
                }
            ],
        }),
        icons: {
            "16": "icon/16.png",
            "32": "icon/32.png",
            "48": "icon/48.png",
            "96": "icon/96.png",
            "128": "icon/128.png"
        }
    }),
    vite: () => ({
        plugins: [react()],
        build: {
            chunkSizeWarningLimit: 1000,
        },
    }),
});
