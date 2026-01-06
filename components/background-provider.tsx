import React, { createContext, useState, useContext, useEffect } from 'react';
import { browser } from "wxt/browser";

import { MessageType } from "@/entrypoints/types.ts";
export interface BackgroundConfig {
    type: 'default' | 'color' | 'image';
    value: string;
    blur?: number;
    maskOpacity?: number;
}

interface BackgroundContextType {
    backgroundConfig: BackgroundConfig;
    setBackground: (config: BackgroundConfig) => Promise<void>;
}

const BackgroundContext = createContext<BackgroundContextType>({
    backgroundConfig: { type: 'default', value: '', blur: 0, maskOpacity: 0 },
    setBackground: async () => { }
});

export const useBackground = () => useContext(BackgroundContext);

export const BackgroundProvider = ({ children }: { children: React.ReactNode }) => {
    const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>({ type: 'default', value: '', blur: 0, maskOpacity: 0 });

    const setBackground = async (newConfig: BackgroundConfig) => {
        setBackgroundConfig(newConfig);
        await browser.storage.local.set({ 'backgroundConfig': newConfig });
        try {
            await browser.runtime.sendMessage({
                messageType: MessageType.changeBackground,
                content: JSON.stringify(newConfig)
            });
        } catch (e) {
            // Ignore errors if no listeners (e.g. no background script listening)
            console.log("Message sending failed (expected if no listeners):", e);
        }
    };

    async function initBackground() {
        const result = await browser.storage.local.get('backgroundConfig');
        const config = result['backgroundConfig'] as BackgroundConfig | undefined;
        if (config) {
            setBackgroundConfig(config);
        }
    }

    useEffect(() => {
        initBackground();

        const handleMessage = (message: any) => {
            if (message.messageType == MessageType.changeBackground) {
                if (message.content) {
                    try {
                        const config = JSON.parse(message.content);
                        setBackgroundConfig(config);
                    } catch (e) {
                        console.error("Failed to parse background config", e);
                    }
                }
            }
        };

        browser.runtime.onMessage.addListener(handleMessage);
        return () => {
            browser.runtime.onMessage.removeListener(handleMessage);
        }
    }, []);

    return (
        <BackgroundContext.Provider value={{ backgroundConfig, setBackground }}>
            {children}
        </BackgroundContext.Provider>
    );
};
