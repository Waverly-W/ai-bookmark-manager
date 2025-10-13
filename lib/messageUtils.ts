import { browser } from "wxt/browser";
import ExtMessage from "@/entrypoints/types";

/**
 * 安全地发送消息到background script
 */
export async function sendMessageToBackground(message: ExtMessage): Promise<any> {
    try {
        const response = await browser.runtime.sendMessage(message);
        console.log('Message sent successfully:', response);
        return response;
    } catch (error) {
        console.error('Failed to send message to background:', error);
        throw error;
    }
}

// Content script相关函数已移除，因为不再使用content script
