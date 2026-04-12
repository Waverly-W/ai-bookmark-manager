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
import { BatchTagPage } from "@/entrypoints/newtab/batch-tag.tsx";
import { ToolsPage } from "@/entrypoints/newtab/tools.tsx";
import { StatisticsPage } from "@/entrypoints/newtab/statistics.tsx";
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
    const { themeId } = useTheme();
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
                i18n.changeLanguage(message.content as string | undefined)
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
        <div data-theme-id={themeId}>
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

                {!isCustomBackground && themeId !== 'blueprint' && (
                    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                        <div className="enterprise-grid absolute inset-0 opacity-60" />
                        <div className="absolute inset-x-0 top-0 h-[36vh] bg-[radial-gradient(circle_at_top_left,rgba(24,99,220,0.08),transparent_36%),radial-gradient(circle_at_top_right,rgba(155,96,170,0.1),transparent_28%)]" />
                        <div className="absolute inset-x-0 bottom-0 h-[28vh] bg-[linear-gradient(180deg,transparent,rgba(23,23,28,0.04))]" />
                    </div>
                )}

                <Sidebar
                    activeType={sidebarType}
                    sideNav={(sidebarType: SidebarType) => {
                        setSidebarType(sidebarType);
                    }}
                />
                {/* Main Content Area */}
                <main className={`relative z-10 md:ml-24 mb-16 md:mb-0 min-h-screen transition-all duration-300 ${!isCustomBackground
                    ? 'bg-transparent' // Make transparent to show shapes
                    : 'bg-transparent p-4 md:p-6'
                    }`}>
                    {isCustomBackground ? (
                        <div className="h-full w-full max-w-[1600px] mx-auto animate-in fade-in zoom-in-[0.99] duration-500 slide-in-from-bottom-2">
                            <div className={`h-full min-h-[calc(100vh-3rem)] rounded-[2rem] border border-border/40 bg-background/88 p-6 shadow-panel backdrop-blur-md transition-all duration-300 hover:bg-background/92 md:min-h-[calc(100vh-3rem)] md:p-8 ${themeId === 'blueprint' ? 'blueprint-panel rounded-[var(--card-radius)] border-dashed bg-background/84 hover:bg-background/88' : ''}`}>
                                {sidebarType === SidebarType.home && <Home onNavigate={setSidebarType} />}
                                {sidebarType === SidebarType.statistics && <StatisticsPage />}
                                {sidebarType === SidebarType.batchRename && <BatchRenamePage />}
                                {sidebarType === SidebarType.batchTag && <BatchTagPage />}
                                {sidebarType === SidebarType.tools && <ToolsPage navigateTo={setSidebarType} />}
                                {sidebarType === SidebarType.settings && <SettingsPage />}
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in duration-300">
                            {sidebarType === SidebarType.home && <Home onNavigate={setSidebarType} />}
                            {sidebarType === SidebarType.statistics && <StatisticsPage />}
                            {sidebarType === SidebarType.batchRename && <BatchRenamePage />}
                            {sidebarType === SidebarType.batchTag && <BatchTagPage />}
                            {sidebarType === SidebarType.tools && <ToolsPage navigateTo={setSidebarType} />}
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
