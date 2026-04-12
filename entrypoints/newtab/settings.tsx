import React from "react";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { ThemeSettings } from "@/components/settings/theme-settings.tsx";
import { I18nSettings } from "@/components/settings/i18n-settings.tsx";
import { BookmarkSettings } from "@/components/settings/bookmark-settings.tsx";

import { AIConfigSettings } from "@/components/settings/ai-config-settings.tsx";
import { AIPromptSettings } from "@/components/settings/ai-prompt-settings.tsx";

import { DataExportSettings } from "@/components/settings/data-export-settings.tsx";
import { BackgroundSettings } from "@/components/settings/background-settings.tsx";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider.tsx";
import { cn } from "@/lib/utils";

export function SettingsPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState("bookmarks");
    const { themeId } = useTheme();

    return (
        <div className="container mx-auto flex h-[calc(100vh-2rem)] max-w-7xl gap-8 px-6 py-6 md:px-8 md:py-8">
            {/* Sidebar */}
            <aside className="w-72 flex-shrink-0 space-y-6">
                <div className={cn(
                    "panel-shell space-y-2 p-5",
                    themeId === 'blueprint' ? "blueprint-panel" : "surface-subtle"
                )}>
                    <div className="space-y-2">
                        <span className={cn(
                            "kicker-label",
                            themeId === 'blueprint' ? "border-dashed bg-background/10 text-muted-foreground" : "text-primary"
                        )}>
                            {t('settings')}
                        </span>
                        <h1 className={cn(
                            "font-display text-4xl font-normal tracking-[-0.04em]",
                            themeId === 'blueprint' && "font-mono uppercase tracking-[0.18em]"
                        )}>{t('settings')}</h1>
                        <p className="text-sm leading-6 text-muted-foreground">{t('settingsDescription')}</p>
                    </div>
                </div>
                <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            </aside>

            {/* Content */}
            <main className="flex-1 overflow-y-auto pr-2">
                <div className="max-w-4xl space-y-6 pb-10">
                    {activeTab === "bookmarks" && (
                        <div className="panel-shell p-6">
                            <BookmarkSettings />
                        </div>
                    )}

                    {activeTab === "appearance" && (
                        <div className={cn(
                            "panel-shell space-y-6 p-6",
                            themeId === 'blueprint' && "blueprint-panel border-dashed"
                        )}>
                            <div className="space-y-2 border-b border-border/70 pb-4">
                                <h2 className={cn(
                                    "font-display text-[2rem] font-normal tracking-[-0.03em]",
                                    themeId === 'blueprint' && "font-mono uppercase tracking-[0.16em]"
                                )}>{t('appearanceSettings')}</h2>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {t('appearanceSettingsDescription')}
                                </p>
                            </div>

                            <div className="grid gap-8">
                                <I18nSettings />
                                <ThemeSettings />
                                <BackgroundSettings />
                            </div>
                        </div>
                    )}



                    {activeTab === "ai-service" && (
                        <div className="panel-shell p-6">
                            <AIConfigSettings />
                        </div>
                    )}

                    {activeTab === "prompts" && (
                        <div className="panel-shell p-6">
                            <AIPromptSettings />
                        </div>
                    )}

                    {activeTab === "data" && (
                        <div className="panel-shell p-6">
                            <DataExportSettings />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
