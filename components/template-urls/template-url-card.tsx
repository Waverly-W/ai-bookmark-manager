import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Pencil, Play, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/theme-provider.tsx';
import { cn } from '@/lib/utils';
import type { TemplateUrlItem } from '@/lib/templateUrlStorage';

interface TemplateUrlCardProps {
    template: TemplateUrlItem;
    onRun: (template: TemplateUrlItem) => void;
    onEdit: (template: TemplateUrlItem) => void;
    onDelete: (template: TemplateUrlItem) => void;
}

export const TemplateUrlCard: React.FC<TemplateUrlCardProps> = ({
    template,
    onRun,
    onEdit,
    onDelete
}) => {
    const { t } = useTranslation('common');
    const { themeId } = useTheme();

    return (
        <Card className={cn(
            "flex h-full flex-col overflow-hidden border-border/70 bg-card/92 transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
            themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed"
        )}>
            <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                        <CardTitle className={cn(
                            "line-clamp-2 text-xl",
                            themeId === 'blueprint' && "font-mono uppercase tracking-[0.14em]"
                        )}>
                            {template.name}
                        </CardTitle>
                        <CardDescription className={cn(
                            "line-clamp-2 min-h-[2.5rem]",
                            themeId === 'blueprint' && "font-mono"
                        )}>
                            {template.description || t('templateUrlsDescription')}
                        </CardDescription>
                    </div>

                    <Badge variant="outline" className={cn(
                        "shrink-0 border-border/70 bg-background/75 text-muted-foreground",
                        themeId === 'blueprint' && "rounded-[var(--badge-radius)] font-mono"
                    )}>
                        {template.openMode === 'new-tab'
                            ? t('templateUrlOpenModeNewTab')
                            : t('templateUrlOpenModeCurrentTab')}
                    </Badge>
                </div>

                <div className={cn(
                    "rounded-[1rem] border border-border/70 bg-surface-2/70 p-3",
                    themeId === 'blueprint' && "rounded-[var(--card-radius)] border-dashed"
                )}>
                    <p className={cn(
                        "mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
                        themeId === 'blueprint' && "font-mono"
                    )}>
                        {t('templateUrlTemplate')}
                    </p>
                    <p className="break-all font-mono text-xs text-foreground/88">
                        {template.urlTemplate}
                    </p>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {template.placeholders.length > 0 ? (
                        template.placeholders.map((placeholder) => (
                            <Badge
                                key={placeholder}
                                variant="secondary"
                                className={cn(
                                    "bg-primary/10 text-primary",
                                    themeId === 'blueprint' && "rounded-[var(--badge-radius)] border border-primary/30 font-mono"
                                )}
                            >
                                {`{${placeholder}}`}
                            </Badge>
                        ))
                    ) : (
                        <Badge
                            variant="outline"
                            className={cn(
                                "border-border/70 bg-background/70 text-muted-foreground",
                                themeId === 'blueprint' && "rounded-[var(--badge-radius)] font-mono"
                            )}
                        >
                            {t('templateUrlNoPlaceholders')}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ExternalLink className="h-4 w-4" />
                    <span>
                        {t('templateUrlPlaceholderCount', { count: template.placeholders.length })}
                    </span>
                </div>
            </CardContent>

            <CardFooter className="mt-auto flex flex-col gap-3 sm:flex-row">
                <Button
                    className={cn("w-full justify-between", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")}
                    onClick={() => onRun(template)}
                >
                    <span>{t('runTemplateUrl')}</span>
                    <Play className="h-4 w-4" />
                </Button>
                <div className="flex w-full gap-2">
                    <Button
                        variant="outline"
                        className={cn("flex-1 justify-between", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")}
                        onClick={() => onEdit(template)}
                    >
                        <span>{t('edit')}</span>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className={cn("flex-1 justify-between text-destructive hover:text-destructive", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")}
                        onClick={() => onDelete(template)}
                    >
                        <span>{t('delete')}</span>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
};
