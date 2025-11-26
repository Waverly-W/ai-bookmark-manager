import React, { createContext, useState, useContext, useEffect } from 'react';
import { browser } from "wxt/browser";
import { configSyncManager } from "@/lib/configSyncManager";
import { MessageType } from "@/entrypoints/types.ts";
import { BackgroundConfig } from "@/components/settings/background-settings.tsx";

interface BackgroundContextType {
    backgroundConfig: BackgroundConfig;
    setBackground: (config: BackgroundConfig) => Promise<void>;
}

const BackgroundContext = createContext<BackgroundContextType>({
    backgroundConfig: { type: 'default', value: '' },
    setBackground: async () => { }
});

export const useBackground = () => useContext(BackgroundContext);

export const BackgroundProvider = ({ children }: { children: React.ReactNode }) => {
    const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>({ type: 'default', value: '' });

    const setBackground = async (newConfig: BackgroundConfig) => {
        setBackgroundConfig(newConfig);
        await configSyncManager.set('backgroundConfig', newConfig);
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
        const config = await configSyncManager.get<BackgroundConfig>('backgroundConfig');
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
