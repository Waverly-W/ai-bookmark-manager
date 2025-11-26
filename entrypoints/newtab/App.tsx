import React, { useEffect, useRef, useState } from 'react';
import './App.module.css';
import '../../assets/main.css'
import Sidebar, { SidebarType } from "@/entrypoints/sidebar.tsx";
import { browser } from "wxt/browser";
import ExtMessage, { MessageType } from "@/entrypoints/types.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Home } from "@/entrypoints/newtab/home.tsx";
import { SettingsPage } from "@/entrypoints/newtab/settings.tsx";
import { BatchRenamePage } from "@/entrypoints/newtab/batch-rename.tsx";
import { useTheme } from "@/components/theme-provider.tsx";
import { useTranslation } from 'react-i18next';
import { Toaster } from "@/components/ui/toaster";
import { useBackground } from "@/components/background-provider.tsx";

export default () => {
    const [showButton, setShowButton] = useState(false)
    const [showCard, setShowCard] = useState(false)
    const [sidebarType, setSidebarType] = useState<SidebarType>(SidebarType.home);
    const [buttonStyle, setButtonStyle] = useState<any>();
    const [cardStyle, setCardStyle] = useState<any>();
    const cardRef = useRef<HTMLDivElement>(null);
    const { theme, toggleTheme } = useTheme();
    const { t, i18n } = useTranslation();
    const { backgroundConfig } = useBackground();

    async function initI18n() {
        let data = await browser.storage.local.get('i18n');
        if (data.i18n) {
            await i18n.changeLanguage(data.i18n)
        }
    }

    useEffect(() => {
        browser.runtime.onMessage.addListener((message: ExtMessage, sender, sendResponse) => {
            console.log('newtab:')
            console.log(message)
            if (message.messageType == MessageType.changeLocale) {
                i18n.changeLanguage(message.content)
            } else if (message.messageType == MessageType.changeTheme) {
                toggleTheme(message.content)
            }
        });

        initI18n();
    }, []);

    const getBackgroundStyle = () => {
        if (backgroundConfig.type === 'color') {
            return { backgroundColor: backgroundConfig.value };
        } else if (backgroundConfig.type === 'image' && backgroundConfig.value) {
            return {
                backgroundImage: `url(${backgroundConfig.value})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed'
            };
        }
        return {};
    };

    const isCustomBackground = backgroundConfig.type !== 'default';

    return (
        <div className={theme}>
            {isCustomBackground && (
                <>
                    <div
                        className="fixed inset-0 z-[-2] transition-all duration-300 ease-in-out"
                        style={{
                            ...getBackgroundStyle(),
                            filter: `blur(${backgroundConfig.blur || 0}px)`
                        }}
                    />
                    <div
                        className="fixed inset-0 z-[-1] bg-black pointer-events-none transition-opacity duration-300 ease-in-out"
                        style={{ opacity: backgroundConfig.maskOpacity || 0 }}
                    />
                </>
            )}
            <div className={`min-h-screen w-full ${!isCustomBackground ? 'bg-background' : ''}`}>
                <Sidebar sideNav={(sidebarType: SidebarType) => {
                    setSidebarType(sidebarType);
                }} />
                {/* 主内容区域 - 桌面端左边距，移动端底部间距 */}
                <main className={`md:ml-16 mb-16 md:mb-0 min-h-screen ${!isCustomBackground ? 'bg-background' : 'bg-transparent'}`}>
                    {sidebarType === SidebarType.home && <Home />}
                    {sidebarType === SidebarType.batchRename && <BatchRenamePage />}
                    {sidebarType === SidebarType.settings && <SettingsPage />}
                </main>
            </div>
            {showButton &&
                <Button className="absolute z-[100000]" style={buttonStyle}>{t('sendMessage')}</Button>
            }
            {
                <Card ref={cardRef}
                    className={`absolute z-[100000] w-[300px] h-[200px] ${showCard ? 'block' : 'hidden'}`}
                    style={cardStyle}></Card>
            }
            <Toaster />
        </div>

    )
};
