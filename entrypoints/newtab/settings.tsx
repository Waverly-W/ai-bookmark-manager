import React from "react";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { ThemeSettings } from "@/components/settings/theme-settings.tsx";
import { I18nSettings } from "@/components/settings/i18n-settings.tsx";
import { BookmarkSettings } from "@/components/settings/bookmark-settings.tsx";
import { AccentColorSettings } from "@/components/settings/accent-color-settings.tsx";
import { AIConfigSettings } from "@/components/settings/ai-config-settings.tsx";
import { AIPromptSettings } from "@/components/settings/ai-prompt-settings.tsx";
import { SyncSettings } from "@/components/settings/sync-settings.tsx";
import { useTranslation } from "react-i18next";

export function SettingsPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState("bookmarks");

    return (
        <div className="flex h-[calc(100vh-4rem)] w-full max-w-6xl mx-auto gap-8 p-6">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 space-y-6">
                <div className="space-y-2 px-4">
                    <h1 className="text-2xl font-bold tracking-tight">{t('settings')}</h1>
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
                            <div className="space-y-2 pb-4 border-b border-border/50">
                                <h2 className="text-xl font-semibold">{t('appearanceSettings')}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {t('appearanceSettingsDescription')}
                                </p>
                            </div>

                            <div className="grid gap-8">
                                <I18nSettings />
                                <ThemeSettings />
                                <AccentColorSettings />
                            </div>
                        </div>
                    )}

                    {activeTab === "sync" && (
                        <SyncSettings />
                    )}

                    {activeTab === "ai-service" && (
                        <AIConfigSettings />
                    )}

                    {activeTab === "prompts" && (
                        <AIPromptSettings />
                    )}
                </div>
            </main>
        </div>
    );
}

