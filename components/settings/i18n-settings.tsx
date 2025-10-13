import {Label} from "@/components/ui/label"
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group"
import {browser} from "wxt/browser";
import {MessageType} from "@/entrypoints/types.ts";
import languages from "@/components/i18nConfig.ts";
import {useTranslation} from "react-i18next";

export function I18nSettings() {
    const {i18n} = useTranslation();
    const {t} = useTranslation();
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h4 className="font-medium text-sm">{t('i18nSettings')}</h4>
                <p className="text-xs text-muted-foreground">{t('i18nSettingsDescription')}</p>
            </div>
            <RadioGroup defaultValue={i18n.language} value={i18n.language} className="space-y-2">
                {
                    languages.map((language, index, array) => {
                        return (
                            <div key={index} className="flex items-center space-y-1.5 justify-between"
                                 onClick={async () => {
                                     await i18n.changeLanguage(language.locale)
                                     await browser.runtime.sendMessage({
                                         messageType: MessageType.changeLocale,
                                         content: language.locale
                                     });
                                     await browser.storage.local.set({i18n: language.locale});
                                 }}>
                                <Label htmlFor={`r${index}`} className="text-sm">{language.name}</Label>
                                <RadioGroupItem value={`${language.locale}`} id={`r${index}`}/>
                            </div>
                        )
                    })
                }
            </RadioGroup>
        </div>

    )
}
