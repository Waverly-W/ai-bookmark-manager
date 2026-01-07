import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

// See https://wxt.dev/api/config.html
export default defineConfig({
    outDir: 'dist',
    manifest: {
        permissions: ["storage", "tabs", "contextMenus", "bookmarks", "favicon"],
        host_permissions: [
            "https://*/*",
            "http://*/*"
        ],
        action: {},
        name: '__MSG_extName__',
        description: '__MSG_extDescription__',
        default_locale: "en",
        web_accessible_resources: [
            {
                resources: ["_favicon/*"],
                matches: ["<all_urls>"]
            }
        ],
        icons: {
            "16": "icon/16.png",
            "32": "icon/32.png",
            "48": "icon/48.png",
            "96": "icon/96.png",
            "128": "icon/128.png"
        }
    },
    vite: () => ({
        plugins: [react()],
        build: {
            chunkSizeWarningLimit: 1000,
        },
    }),
});
