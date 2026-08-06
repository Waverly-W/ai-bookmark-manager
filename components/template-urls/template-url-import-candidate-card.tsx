import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Pencil, Link2, Layers3 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/theme-provider.tsx';
import { cn } from '@/lib/utils';
import type { ImportedTemplateCandidate } from '@/lib/templateUrlImportUtils';

interface TemplateUrlImportCandidateCardProps {
    candidate: ImportedTemplateCandidate;
    isImporting: boolean;
    onImport: (candidate: ImportedTemplateCandidate) => Promise<void>;
    onEdit: (candidate: ImportedTemplateCandidate) => void;
}

export const TemplateUrlImportCandidateCard: React.FC<TemplateUrlImportCandidateCardProps> = ({
    candidate,
    isImporting,
    onImport,
    onEdit
}) => {
    const { t } = useTranslation('common');
    const { themeId } = useTheme();

    return (
        <Card className={cn(
            "flex h-full flex-col overflow-hidden border-border/70 bg-card/92",
            themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed"
        )}>
            <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                        <CardTitle className={cn(
                            "line-clamp-2 text-xl",
                            themeId === 'blueprint' && "font-mono uppercase tracking-[0.14em]"
                        )}>
                            {candidate.name}
                        </CardTitle>
                        <CardDescription className={cn(
                            themeId === 'blueprint' && "font-mono"
                        )}>
                            {candidate.domain}
                        </CardDescription>
                    </div>

                    <Badge
                        variant="outline"
                        className={cn(
                            "shrink-0 border-border/70 bg-background/75 text-muted-foreground",
                            themeId === 'blueprint' && "rounded-[var(--badge-radius)] font-mono"
                        )}
                    >
                        {t('templateUrlImportSampleCount', { count: candidate.sampleCount })}
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
                        {candidate.urlTemplate}
                    </p>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {candidate.placeholders.map((placeholder) => (
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
                    ))}
                </div>

                <div className="grid gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Layers3 className="h-4 w-4" />
                        <span>{t('templateUrlImportSamples')}</span>
                    </div>
                    {candidate.sampleUrls.map((sampleUrl) => (
                        <div
                            key={sampleUrl}
                            className={cn(
                                "rounded-[0.85rem] border border-border/60 bg-background/80 p-3",
                                themeId === 'blueprint' && "rounded-[var(--button-radius)] border-dashed"
                            )}
                        >
                            <p className="break-all font-mono text-[11px] text-muted-foreground">
                                {sampleUrl}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                    <span>{t('templateUrlPlaceholderCount', { count: candidate.placeholders.length })}</span>
                </div>
            </CardContent>

            <CardFooter className="mt-auto flex flex-col gap-3 sm:flex-row">
                <Button
                    className={cn("w-full justify-between", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")}
                    disabled={isImporting}
                    onClick={() => void onImport(candidate)}
                >
                    <span>{isImporting ? t('importing') : t('templateUrlImportDirect')}</span>
                    <FileDown className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    className={cn("w-full justify-between", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")}
                    disabled={isImporting}
                    onClick={() => onEdit(candidate)}
                >
                    <span>{t('templateUrlImportEditBefore')}</span>
                    <Pencil className="h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    );
};
