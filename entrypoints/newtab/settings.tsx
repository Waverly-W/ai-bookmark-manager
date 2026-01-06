import React from "react";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { ThemeSettings } from "@/components/settings/theme-settings.tsx";
import { I18nSettings } from "@/components/settings/i18n-settings.tsx";
import { BookmarkSettings } from "@/components/settings/bookmark-settings.tsx";
import { AccentColorSettings } from "@/components/settings/accent-color-settings.tsx";
import { AIConfigSettings } from "@/components/settings/ai-config-settings.tsx";
import { AIPromptSettings } from "@/components/settings/ai-prompt-settings.tsx";

import { DataExportSettings } from "@/components/settings/data-export-settings.tsx";
import { BackgroundSettings } from "@/components/settings/background-settings.tsx";
import { useTranslation } from "react-i18next";

export function SettingsPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState("bookmarks");

    return (
        <div className="container mx-auto p-6 md:p-8 max-w-7xl flex gap-8 h-[calc(100vh-2rem)]">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 space-y-6">
                <div className="space-y-2 px-4">
                    <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
                    <p className="text-muted-foreground text-sm">{t('settingsDescription')}</p>
                </div>
                <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            </aside>

            {/* Content */}
            <main className="flex-1 overflow-y-auto pr-4">
                <div className="max-w-3xl space-y-6 pb-10">
                    {activeTab === "bookmarks" && (
                        <BookmarkSettings />
                    )}

                    {activeTab === "appearance" && (
                        <div className="space-y-8">
                            <div className="space-y-2 pb-4 border-b border-border">
                                <h2 className="text-xl font-semibold">{t('appearanceSettings')}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {t('appearanceSettingsDescription')}
                                </p>
                            </div>

                            <div className="grid gap-8">
                                <I18nSettings />
                                <ThemeSettings />
                                <AccentColorSettings />
                                <BackgroundSettings />
                            </div>
                        </div>
                    )}



                    {activeTab === "ai-service" && (
                        <AIConfigSettings />
                    )}

                    {activeTab === "prompts" && (
                        <AIPromptSettings />
                    )}

                    {activeTab === "data" && (
                        <DataExportSettings />
                    )}
                </div>
            </main>
        </div>
    );
}

