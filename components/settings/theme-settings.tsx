import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { browser } from "wxt/browser";
import { MessageType } from "@/entrypoints/types.ts";
import { useTheme } from "@/components/theme-provider.tsx";
import { useTranslation } from "react-i18next";


export function ThemeSettings() {
    const { theme, toggleTheme } = useTheme();
    const themes = ["light", "dark"]
    const { t } = useTranslation();

    const handleThemeChange = async (newTheme: string) => {
        toggleTheme(newTheme as "light" | "dark");
        await browser.runtime.sendMessage({
            messageType: MessageType.changeTheme,
            content: newTheme
        });
        await browser.storage.local.set({ 'theme': newTheme });
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h4 className="font-medium text-sm">{t('themeSettings')}</h4>
                <p className="text-xs text-muted-foreground">{t('themeSettingsDescription')}</p>
            </div>
            <Tabs defaultValue={theme} value={theme} onValueChange={handleThemeChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    {themes.map((themeItem) => (
                        <TabsTrigger key={themeItem} value={themeItem}>
                            {t(themeItem)}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    )
}
