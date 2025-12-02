import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { browser } from "wxt/browser";
import { MessageType } from "@/entrypoints/types.ts";
import languages from "@/components/i18nConfig.ts";
import { useTranslation } from "react-i18next";

export function I18nSettings() {
    const { i18n } = useTranslation();
    const { t } = useTranslation();

    const handleLanguageChange = async (newLocale: string) => {
        await i18n.changeLanguage(newLocale)
        await browser.runtime.sendMessage({
            messageType: MessageType.changeLocale,
            content: newLocale
        });
        await browser.storage.local.set({ i18n: newLocale });
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h4 className="font-medium text-sm">{t('i18nSettings')}</h4>
                <p className="text-xs text-muted-foreground">{t('i18nSettingsDescription')}</p>
            </div>
            <Tabs defaultValue={i18n.language} value={i18n.language} onValueChange={handleLanguageChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    {languages.map((language) => (
                        <TabsTrigger key={language.locale} value={language.locale}>
                            {language.name}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    )
}
