import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

const basePermissions = ["storage", "tabs", "contextMenus", "bookmarks"];
const hostPermissions = ["https://*/*", "http://*/*"];

// See https://wxt.dev/api/config.html
export default defineConfig({
    outDir: 'dist',
    manifest: ({ browser }) => ({
        permissions: browser === "firefox" ? [...basePermissions, ...hostPermissions] : [...basePermissions, "favicon"],
        ...(browser === "firefox" ? {} : {
            host_permissions: hostPermissions
        }),
        action: {},
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
