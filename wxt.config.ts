import {defineConfig} from 'wxt';
import react from '@vitejs/plugin-react';

// See https://wxt.dev/api/config.html
export default defineConfig({
        outDir: 'dist',
    manifest: {
        permissions: ["storage", "tabs", "contextMenus", "bookmarks"],
        host_permissions: [
            "https://*/*",
            "http://*/*"
        ],
        action: {},
        name: '__MSG_extName__',
        description: '__MSG_extDescription__',
        default_locale: "en"
    },
    vite: () => ({
        plugins: [react()],
    }),
});
