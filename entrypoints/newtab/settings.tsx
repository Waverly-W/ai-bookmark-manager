import React from "react";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { ThemeSettings } from "@/components/settings/theme-settings.tsx";
import { I18nSettings } from "@/components/settings/i18n-settings.tsx";
import { BookmarkSettings } from "@/components/settings/bookmark-settings.tsx";

import { AIConfigSettings } from "@/components/settings/ai-config-settings.tsx";
import { AIPromptSettings } from "@/components/settings/ai-prompt-settings.tsx";
import { ObsidianSettings } from "@/components/settings/obsidian-settings.tsx";

import { DataExportSettings } from "@/components/settings/data-export-settings.tsx";
import { BackgroundSettings } from "@/components/settings/background-settings.tsx";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function SettingsPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState("bookmarks");

    return (
        <div className="container mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:h-[calc(100vh-2rem)] lg:flex-row lg:gap-8 lg:px-8 lg:py-8">
            {/* Sidebar：窄屏时位于顶部，菜单横向滚动 */}
            <aside className="w-full space-y-4 lg:w-72 lg:flex-shrink-0 lg:space-y-6">
                <div className={cn(
                    "panel-shell space-y-2 p-4 lg:p-5",
                    "classic:surface-subtle blueprint:blueprint-panel"
                )}>
                    <div className="space-y-2">
                        <h1 className={cn(
                            "font-display text-3xl font-normal tracking-[-0.04em] lg:text-4xl",
                            "blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.18em]"
                        )}>{t('settings')}</h1>
                        <p className="text-sm leading-6 text-muted-foreground">{t('settingsDescription')}</p>
                    </div>
                </div>
                <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            </aside>

            {/* Content */}
            <main className="min-w-0 flex-1 lg:overflow-y-auto lg:pr-2">
                <div className="max-w-4xl space-y-6 pb-10">
                    {activeTab === "bookmarks" && (
                        <div className="panel-shell p-6">
                            <BookmarkSettings />
                        </div>
                    )}

                    {activeTab === "appearance" && (
                        <div className={cn(
                            "panel-shell space-y-6 p-6",
                            "blueprint:blueprint-panel blueprint:border-dashed"
                        )}>
                            <div className="space-y-2 border-b border-border/70 pb-4">
                                <h2 className={cn(
                                    "font-display text-[2rem] font-normal tracking-[-0.03em]",
                                    "blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.16em]"
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

                    {activeTab === "obsidian" && (
                        <div className="panel-shell p-6">
                            <ObsidianSettings />
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
