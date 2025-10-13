import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeSettings } from "@/components/settings/theme-settings.tsx";
import { I18nSettings } from "@/components/settings/i18n-settings.tsx";
import { BookmarkSettings } from "@/components/settings/bookmark-settings.tsx";
import { AccentColorSettings } from "@/components/settings/accent-color-settings.tsx";
import { AIConfigSettings } from "@/components/settings/ai-config-settings.tsx";
import { AIPromptSettings } from "@/components/settings/ai-prompt-settings.tsx";
import { useTranslation } from "react-i18next";

export function SettingsPage() {
    const { t } = useTranslation();

    return (
        <div className="w-full max-w-4xl mx-auto">
            <Tabs defaultValue="bookmarks" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="bookmarks">{t('bookmarkSettingsTab')}</TabsTrigger>
                    <TabsTrigger value="appearance">{t('appearanceSettingsTab')}</TabsTrigger>
                    <TabsTrigger value="ai">{t('aiSettingsTab')}</TabsTrigger>
                </TabsList>

                <TabsContent value="bookmarks" className="mt-6">
                    <div className="max-w-2xl">
                        <BookmarkSettings />
                    </div>
                </TabsContent>

                <TabsContent value="appearance" className="mt-6">
                    <div className="max-w-2xl space-y-6">
                        {/* 外观设置标题 */}
                        <div className="space-y-1.5">
                            <h2 className="text-lg font-semibold">{t('appearanceSettings')}</h2>
                            <p className="text-sm text-muted-foreground">
                                {t('appearanceSettingsDescription')}
                            </p>
                        </div>

                        {/* 外观设置项 - 水平布局 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-4">
                                <I18nSettings />
                            </div>
                            <div className="space-y-4">
                                <ThemeSettings />
                            </div>
                            <div className="space-y-4">
                                <AccentColorSettings />
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="ai" className="mt-6">
                    <div className="max-w-2xl space-y-6">
                        <AIConfigSettings />
                        <AIPromptSettings />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

