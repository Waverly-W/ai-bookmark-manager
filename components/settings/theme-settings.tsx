import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { browser } from "wxt/browser";
import { MessageType } from "@/entrypoints/types.ts";
import { useTheme } from "@/components/theme-provider.tsx";
import { useTranslation } from "react-i18next";
import { configSyncManager } from "@/lib/configSyncManager";

export function ThemeSettings() {
    const { theme, toggleTheme } = useTheme();
    const themes = ["light", "dark"]
    const { t } = useTranslation();
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h4 className="font-medium text-sm">{t('themeSettings')}</h4>
                <p className="text-xs text-muted-foreground">{t('themeSettingsDescription')}</p>
            </div>
            <RadioGroup defaultValue={theme} value={theme} className="space-y-2">
                {
                    themes && themes.map((theme, index, array) => {
                        return (
                            <div key={index} className="flex items-center space-y-1.5 justify-between"
                                onClick={async () => {
                                    toggleTheme(theme)
                                    await browser.runtime.sendMessage({
                                        messageType: MessageType.changeTheme,
                                        content: theme
                                    });
                                    await configSyncManager.set('theme', theme);
                                }}>
                                <Label htmlFor={`r${index}`} className="text-sm">{t(theme)}</Label>
                                <RadioGroupItem value={theme} id={`r${index}`} />
                            </div>
                        );
                    })
                }
            </RadioGroup>
        </div>

    )
}
