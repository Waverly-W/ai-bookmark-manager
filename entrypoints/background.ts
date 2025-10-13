import {browser} from "wxt/browser";
import ExtMessage, {MessageType} from "@/entrypoints/types.ts";

export default defineBackground(() => {
    console.log('Hello background!', {id: browser.runtime.id});// background.js

    // 创建右键菜单
    browser.runtime.onInstalled.addListener(() => {
        browser.contextMenus.create({
            id: "openNewTab",
            title: "打开新标签页",
            contexts: ["action"]
        });
    });

    // 处理右键菜单点击
    browser.contextMenus.onClicked.addListener(async (info, _tab) => {
        try {
            if (info.menuItemId === "openNewTab") {
                // 打开新标签页
                await browser.tabs.create({});
            }
        } catch (error) {
            console.error('Error handling context menu click:', error);
        }
    });

    // 移除了Side Panel相关配置，现在使用newtab页面

    // 移除了action点击监听器，因为不再需要与content script通信

    // 简化的消息监听器，只处理主题和语言变更
    browser.runtime.onMessage.addListener(async (message: ExtMessage, _sender, sendResponse: (message: any) => void) => {
        console.log("background:")
        console.log(message)
        try {
            if (message.messageType === MessageType.changeTheme || message.messageType === MessageType.changeLocale) {
                // 这里可以处理主题和语言变更的逻辑
                sendResponse({success: true});
                return true;
            }
        } catch (error) {
            console.error('Error in message listener:', error);
            sendResponse({success: false, error: error instanceof Error ? error.message : 'Unknown error'});
        }
    });


});
