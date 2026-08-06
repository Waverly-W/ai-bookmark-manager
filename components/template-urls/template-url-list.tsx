import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/theme-provider.tsx';
import { cn } from '@/lib/utils';
import type { TemplateUrlItem } from '@/lib/templateUrlStorage';
import { TemplateUrlCard } from '@/components/template-urls/template-url-card';

interface TemplateUrlListProps {
    items: TemplateUrlItem[];
    isLoading: boolean;
    onCreate: () => void;
    onRun: (template: TemplateUrlItem) => void;
    onEdit: (template: TemplateUrlItem) => void;
    onDelete: (template: TemplateUrlItem) => void;
}

export const TemplateUrlList: React.FC<TemplateUrlListProps> = ({
    items,
    isLoading,
    onCreate,
    onRun,
    onEdit,
    onDelete
}) => {
    const { t } = useTranslation('common');
    const { themeId } = useTheme();

    if (isLoading) {
        return (
            <Card className={cn(
                "border-border/70 bg-card/92",
                themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed"
            )}>
                <CardContent className="flex min-h-[220px] items-center justify-center">
                    <div className={cn(
                        "flex flex-col items-center gap-3 text-muted-foreground",
                        themeId === 'blueprint' && "font-mono"
                    )}>
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                        <span>{t('loading')}</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (items.length === 0) {
        return (
            <EmptyState
                className={cn(
                    "rounded-[1.75rem] border-border/70 bg-card/72 py-14",
                    themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed bg-card/82"
                )}
                icon={<Link2 className="h-8 w-8 text-primary" />}
                title={t('templateUrlEmptyTitle')}
                description={t('templateUrlEmptyDescription')}
                actions={
                    <Button className={cn(themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")} onClick={onCreate}>
                        {t('createTemplateUrl')}
                    </Button>
                }
            />
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((template) => (
                <TemplateUrlCard
                    key={template.id}
                    template={template}
                    onRun={onRun}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};
