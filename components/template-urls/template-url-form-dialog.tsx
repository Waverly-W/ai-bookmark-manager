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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    validateTemplateUrl,
    type TemplateUrlValidationResult
} from '@/lib/templateUrlUtils';
import type { SaveTemplateUrlInput, TemplateUrlItem } from '@/lib/templateUrlStorage';

interface TemplateUrlFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: TemplateUrlItem | null;
    draftTemplate?: SaveTemplateUrlInput | null;
    isSaving: boolean;
    onSubmit: (input: SaveTemplateUrlInput) => Promise<void>;
}

const mapValidationErrors = (
    validation: TemplateUrlValidationResult,
    t: ReturnType<typeof useTranslation<'common'>>['t']
): string[] =>
    validation.errors.map((error) => {
        if (error === 'Template name is required') {
            return t('templateUrlValidationNameRequired');
        }

        if (error === 'Template URL is required') {
            return t('templateUrlValidationUrlRequired');
        }

        if (error === 'Template URL is invalid') {
            return t('templateUrlValidationUrlInvalid');
        }

        if (error.startsWith('Invalid placeholder: ')) {
            return t('templateUrlValidationPlaceholderInvalid', {
                placeholder: error.replace('Invalid placeholder: ', '')
            });
        }

        return error;
    });

export const TemplateUrlFormDialog: React.FC<TemplateUrlFormDialogProps> = ({
    open,
    onOpenChange,
    template,
    draftTemplate = null,
    isSaving,
    onSubmit
}) => {
    const { t } = useTranslation('common');
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [urlTemplate, setUrlTemplate] = React.useState('');
    const [openMode, setOpenMode] = React.useState<'new-tab' | 'current-tab'>('new-tab');
    const [hasSubmitted, setHasSubmitted] = React.useState(false);
    const [saveError, setSaveError] = React.useState('');

    React.useEffect(() => {
        if (!open) {
            return;
        }

        const initialValues = draftTemplate || template;

        setName(initialValues?.name || '');
        setDescription(initialValues?.description || '');
        setUrlTemplate(initialValues?.urlTemplate || '');
        setOpenMode(initialValues?.openMode || 'new-tab');
        setHasSubmitted(false);
        setSaveError('');
    }, [draftTemplate, open, template]);

    const validation = React.useMemo(
        () => validateTemplateUrl(name, urlTemplate),
        [name, urlTemplate]
    );
    const validationErrors = React.useMemo(
        () => mapValidationErrors(validation, t),
        [t, validation]
    );
    const nameError = hasSubmitted && !name.trim() ? t('templateUrlValidationNameRequired') : '';
    const urlHasError = urlTemplate.trim().length > 0 && validationErrors.length > 0;

    const handleSave = async () => {
        setHasSubmitted(true);
        setSaveError('');

        if (!validation.isValid) {
            return;
        }

        try {
            await onSubmit({
                id: template?.id,
                name,
                description,
                urlTemplate,
                openMode
            });
            onOpenChange(false);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : t('templateUrlSaveFailed'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className={cn("blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.16em]")}>
                        {template ? t('editTemplateUrl') : t('createTemplateUrl')}
                    </DialogTitle>
                    <DialogDescription className={cn("blueprint:font-mono")}>
                        {template ? t('editTemplateUrlDescription') : t('createTemplateUrlDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5">
                    <div className="grid gap-2">
                        <Label htmlFor="template-url-name">{t('templateUrlName')}</Label>
                        <Input
                            id="template-url-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={t('templateUrlNamePlaceholder')}
                            variant={nameError ? 'destructive' : 'default'}
                        />
                        {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="template-url-description">{t('templateUrlDescriptionField')}</Label>
                        <Textarea
                            id="template-url-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder={t('templateUrlDescriptionPlaceholder')}
                            className="min-h-[104px]"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="template-url-template">{t('templateUrlTemplate')}</Label>
                        <Input
                            id="template-url-template"
                            value={urlTemplate}
                            onChange={(event) => setUrlTemplate(event.target.value)}
                            placeholder={t('templateUrlTemplatePlaceholder')}
                            variant={urlHasError ? 'destructive' : 'default'}
                            className="font-mono text-xs"
                        />
                        <p className="text-sm text-muted-foreground">
                            {t('templateUrlTemplateHint')}
                        </p>
                        {urlHasError && (
                            <div className="space-y-1">
                                {validationErrors.map((error) => (
                                    <p key={error} className="text-sm text-destructive">
                                        {error}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label>{t('templateUrlDetectedPlaceholders')}</Label>
                        <div className={cn(
                            "flex min-h-11 flex-wrap items-center gap-2 rounded-[var(--input-radius)] border border-border/70 bg-surface-2/55 px-3 py-3",
                            "blueprint:border-dashed"
                        )}>
                            {validation.placeholders.length > 0 ? (
                                validation.placeholders.map((placeholder) => (
                                    <Badge
                                        key={placeholder}
                                        variant="secondary"
                                        className={cn(
                                            "bg-primary/10 text-primary",
                                            "blueprint:rounded-[var(--badge-radius)] blueprint:border blueprint:border-primary/30 blueprint:font-mono"
                                        )}
                                    >
                                        {`{${placeholder}}`}
                                    </Badge>
                                ))
                            ) : (
                                <span className={cn(
                                    "text-sm text-muted-foreground",
                                    "blueprint:font-mono"
                                )}>
                                    {t('templateUrlNoPlaceholders')}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>{t('templateUrlOpenMode')}</Label>
                        <Select value={openMode} onValueChange={(value: 'new-tab' | 'current-tab') => setOpenMode(value)}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new-tab">{t('templateUrlOpenModeNewTab')}</SelectItem>
                                <SelectItem value="current-tab">{t('templateUrlOpenModeCurrentTab')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {saveError && <p className="text-sm text-destructive">{saveError}</p>}
                </div>

                <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn("blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.12em]")}
                    >
                        {isSaving ? t('saving') : t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
