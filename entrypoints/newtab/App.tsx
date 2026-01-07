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
import { ToolsPage } from "@/entrypoints/newtab/tools.tsx";
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
            <div className={`min-h-screen w-full transition-colors duration-300 relative overflow-hidden ${!isCustomBackground ? 'bg-background' : ''}`}>

                {/* Material You Organic Shapes (Only shown for default background) */}
                {!isCustomBackground && (
                    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                        {/* Top Right - Primary/Secondary Blend */}
                        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-3xl opacity-60 mix-blend-multiply animate-in fade-in duration-1000" />
                        <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-secondary/20 blur-3xl opacity-60 mix-blend-multiply animate-in fade-in duration-1500" />

                        {/* Bottom Left - Tertiary/Accent Blend */}
                        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-accent/15 blur-3xl opacity-50 mix-blend-multiply animate-in fade-in duration-2000" />
                        <div className="absolute bottom-[20%] left-[10%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-3xl opacity-40 mix-blend-multiply" />
                    </div>
                )}

                <Sidebar sideNav={(sidebarType: SidebarType) => {
                    setSidebarType(sidebarType);
                }} />
                {/* Main Content Area */}
                <main className={`relative z-10 md:ml-16 mb-16 md:mb-0 min-h-screen transition-all duration-300 ${!isCustomBackground
                    ? 'bg-transparent' // Make transparent to show shapes
                    : 'bg-transparent p-4 md:p-6'
                    }`}>
                    {isCustomBackground ? (
                        <div className="h-full w-full max-w-[1600px] mx-auto animate-in fade-in zoom-in-[0.99] duration-500 slide-in-from-bottom-2">
                            <div className="bg-background/85 backdrop-blur-md rounded-[2rem] border border-white/20 shadow-2xl h-full min-h-[calc(100vh-3rem)] md:min-h-[calc(100vh-3rem)] p-6 md:p-8 transition-all duration-300 hover:bg-background/90 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                                {sidebarType === SidebarType.home && <Home />}
                                {sidebarType === SidebarType.batchRename && <BatchRenamePage />}
                                {sidebarType === SidebarType.tools && <ToolsPage />}
                                {sidebarType === SidebarType.settings && <SettingsPage />}
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in duration-300">
                            {sidebarType === SidebarType.home && <Home />}
                            {sidebarType === SidebarType.batchRename && <BatchRenamePage />}
                            {sidebarType === SidebarType.tools && <ToolsPage />}
                            {sidebarType === SidebarType.settings && <SettingsPage />}
                        </div>
                    )}
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
