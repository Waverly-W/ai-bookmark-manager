import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useTheme } from '@/components/theme-provider.tsx';
import { cn } from '@/lib/utils';
import { buildTemplateUrl } from '@/lib/templateUrlUtils';
import type { TemplateUrlItem, TemplateUrlOpenMode } from '@/lib/templateUrlStorage';

interface TemplateUrlRunDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: TemplateUrlItem | null;
    isRunning: boolean;
    onRun: (url: string, openMode: TemplateUrlOpenMode) => Promise<void>;
}

export const TemplateUrlRunDialog: React.FC<TemplateUrlRunDialogProps> = ({
    open,
    onOpenChange,
    template,
    isRunning,
    onRun
}) => {
    const { t } = useTranslation('common');
    const { themeId } = useTheme();
    const [values, setValues] = React.useState<Record<string, string>>({});
    const [openMode, setOpenMode] = React.useState<TemplateUrlOpenMode>('new-tab');
    const [runError, setRunError] = React.useState('');

    React.useEffect(() => {
        if (!open || !template) {
            return;
        }

        const nextValues = Object.fromEntries(
            template.placeholders.map((placeholder) => [placeholder, ''])
        );

        setValues(nextValues);
        setOpenMode(template.openMode);
        setRunError('');
    }, [open, template]);

    const finalUrl = React.useMemo(() => {
        if (!template) {
            return '';
        }

        return buildTemplateUrl(template.urlTemplate, values);
    }, [template, values]);

    const hasMissingValues = React.useMemo(() => (
        template?.placeholders.some((placeholder) => !values[placeholder]?.trim())
    ), [template, values]);

    const isPreviewValid = React.useMemo(() => {
        if (!finalUrl) {
            return false;
        }

        try {
            new URL(finalUrl);
            return true;
        } catch {
            return false;
        }
    }, [finalUrl]);

    const handleRun = async () => {
        if (!template) {
            return;
        }

        setRunError('');

        if (hasMissingValues) {
            setRunError(t('templateUrlFillAllValues'));
            return;
        }

        if (!isPreviewValid) {
            setRunError(t('templateUrlValidationUrlInvalid'));
            return;
        }

        try {
            await onRun(finalUrl, openMode);
            onOpenChange(false);
        } catch (error) {
            setRunError(error instanceof Error ? error.message : t('templateUrlExecuteFailed'));
        }
    };

    if (!template) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className={cn(themeId === 'blueprint' && "font-mono uppercase tracking-[0.16em]")}>
                        {t('runTemplateUrl')}
                    </DialogTitle>
                    <DialogDescription className={cn(themeId === 'blueprint' && "font-mono")}>
                        {template.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5">
                    {template.placeholders.length > 0 ? (
                        <div className="grid gap-4">
                            {template.placeholders.map((placeholder) => (
                                <div key={placeholder} className="grid gap-2">
                                    <Label htmlFor={`template-url-placeholder-${placeholder}`}>
                                        {t('templateUrlPlaceholderLabel', { name: placeholder })}
                                    </Label>
                                    <Input
                                        id={`template-url-placeholder-${placeholder}`}
                                        value={values[placeholder] || ''}
                                        onChange={(event) => setValues((current) => ({
                                            ...current,
                                            [placeholder]: event.target.value
                                        }))}
                                        placeholder={t('templateUrlPlaceholderPlaceholder', { name: placeholder })}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={cn(
                            "text-sm text-muted-foreground",
                            themeId === 'blueprint' && "font-mono"
                        )}>
                            {t('templateUrlRunWithoutPlaceholders')}
                        </p>
                    )}

                    <div className="grid gap-2">
                        <Label>{t('templateUrlOpenMode')}</Label>
                        <Select value={openMode} onValueChange={(value: TemplateUrlOpenMode) => setOpenMode(value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new-tab">{t('templateUrlOpenModeNewTab')}</SelectItem>
                                <SelectItem value="current-tab">{t('templateUrlOpenModeCurrentTab')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>{t('templateUrlFinalUrl')}</Label>
                        <div className={cn(
                            "rounded-[1rem] border border-border/70 bg-surface-2/70 p-3",
                            themeId === 'blueprint' && "rounded-[var(--card-radius)] border-dashed"
                        )}>
                            <p className="break-all font-mono text-xs text-foreground/88">
                                {finalUrl || template.urlTemplate}
                            </p>
                        </div>
                        {hasMissingValues && (
                            <p className="text-sm text-muted-foreground">
                                {t('templateUrlFillAllValues')}
                            </p>
                        )}
                    </div>

                    {runError && <p className="text-sm text-destructive">{runError}</p>}
                </div>

                <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleRun}
                        disabled={isRunning || hasMissingValues || !isPreviewValid}
                        className={cn(themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")}
                    >
                        {isRunning ? t('processing') : t('executeSearch')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
