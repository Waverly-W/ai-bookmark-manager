import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider.tsx";
import { THEME_DEFINITIONS, THEME_MODES, ThemeMode } from "@/lib/theme";

const MODE_ICONS = {
    light: Sun,
    dark: Moon,
    auto: Monitor
};

export function ThemeSettings() {
    const { t } = useTranslation();
    const { themeMode, themeId, setThemeId, setThemeMode } = useTheme();

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h4 className="text-sm font-medium">{t('themeSettings')}</h4>
                <p className="text-xs text-muted-foreground">{t('themeSettingsDescription')}</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-1">
                    <h5 className="text-sm font-medium">{t('themeMode')}</h5>
                    <p className="text-xs text-muted-foreground">{t('themeModeDescription')}</p>
                </div>

                <RadioGroup
                    value={themeMode}
                    onValueChange={(value) => setThemeMode(value as ThemeMode)}
                    className="grid gap-3 md:grid-cols-3"
                >
                    {THEME_MODES.map((mode) => {
                        const Icon = MODE_ICONS[mode];
                        const selected = themeMode === mode;

                        return (
                            <Label
                                key={mode}
                                htmlFor={`theme-mode-${mode}`}
                                className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-border/70 bg-background/80 p-4 transition-all duration-200 hover:border-border hover:bg-surface-2/70",
                                    selected && "border-primary/50 bg-primary/5 shadow-sm"
                                )}
                            >
                                <RadioGroupItem id={`theme-mode-${mode}`} value={mode} className="mt-1" />
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-foreground">{t(mode)}</div>
                                        <p className="text-xs leading-relaxed text-muted-foreground">
                                            {t(`${mode}ThemeModeDescription`)}
                                        </p>
                                    </div>
                                </div>
                            </Label>
                        );
                    })}
                </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-4">
                <div className="space-y-1">
                    <h5 className="text-sm font-medium">{t('themeStyle')}</h5>
                    <p className="text-xs text-muted-foreground">{t('themeStyleDescription')}</p>
                </div>

                <RadioGroup
                    value={themeId}
                    onValueChange={(value) => setThemeId(value as typeof themeId)}
                    className="grid gap-4 md:grid-cols-2"
                >
                    {THEME_DEFINITIONS.map((theme) => {
                        const selected = themeId === theme.id;
                        return (
                            <Label key={theme.id} htmlFor={`theme-style-${theme.id}`} className="cursor-pointer">
                                <Card
                                    className={cn(
                                        "overflow-hidden rounded-[1.5rem] border-border/70 bg-card/96 transition-all duration-200 hover:-translate-y-0.5 hover:border-border",
                                        selected && "border-primary/60 shadow-md"
                                    )}
                                >
                                    <div className={cn("relative h-28 border-b border-border/70", theme.previewClassName)}>
                                        {theme.id === 'blueprint' && (
                                            <>
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(160,196,232,0.18),transparent_32%)]" />
                                                <div className="absolute left-4 top-4 h-8 w-20 border border-white/50" />
                                                <div className="absolute bottom-4 right-4 h-10 w-14 border border-dashed border-white/40" />
                                            </>
                                        )}
                                        {theme.id === 'default' && (
                                            <div className="absolute inset-x-4 bottom-4 top-4 rounded-[1.25rem] border border-white/40 bg-white/50 backdrop-blur-sm dark:bg-black/10" />
                                        )}
                                    </div>
                                    <CardContent className="space-y-3 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Palette className="h-4 w-4 text-primary" />
                                                    <span className="text-sm font-medium text-foreground">{t(theme.labelKey)}</span>
                                                </div>
                                                <p className="text-xs leading-relaxed text-muted-foreground">
                                                    {t(theme.descriptionKey)}
                                                </p>
                                            </div>
                                            <RadioGroupItem id={`theme-style-${theme.id}`} value={theme.id} className="mt-1" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Label>
                        );
                    })}
                </RadioGroup>
            </div>
        </div>
    );
}
