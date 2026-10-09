import React from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { FileDown, Link2, Plus } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
    deleteTemplateUrl as removeTemplateUrl,
    getTemplateUrls,
    saveTemplateUrl as persistTemplateUrl,
    type SaveTemplateUrlInput,
    type TemplateUrlItem,
    type TemplateUrlOpenMode
} from '@/lib/templateUrlStorage';
import { TemplateUrlList } from '@/components/template-urls/template-url-list';
import { TemplateUrlFormDialog } from '@/components/template-urls/template-url-form-dialog';
import { TemplateUrlRunDialog } from '@/components/template-urls/template-url-run-dialog';
import { TemplateUrlImportDialog } from '@/components/template-urls/template-url-import-dialog';
import type { ImportedTemplateCandidate } from '@/lib/templateUrlImportUtils';

const RESTRICTED_TAB_PREFIXES = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'moz-extension://'
];

const isRestrictedTabUrl = (url?: string): boolean =>
    !!url && RESTRICTED_TAB_PREFIXES.some((prefix) => url.startsWith(prefix));

export const TemplateUrlsPage: React.FC = () => {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [templates, setTemplates] = React.useState<TemplateUrlItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isRunning, setIsRunning] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState<TemplateUrlItem | null>(null);
    const [draftTemplate, setDraftTemplate] = React.useState<SaveTemplateUrlInput | null>(null);
    const [runningTemplate, setRunningTemplate] = React.useState<TemplateUrlItem | null>(null);
    const [deletingTemplate, setDeletingTemplate] = React.useState<TemplateUrlItem | null>(null);
    const [shouldRestoreImportDialog, setShouldRestoreImportDialog] = React.useState(false);

    const loadTemplates = React.useCallback(async () => {
        try {
            setIsLoading(true);
            setTemplates(await getTemplateUrls());
        } catch (error) {
            console.error('Failed to load template urls:', error);
            toast({
                title: t('error'),
                description: t('templateUrlLoadFailed'),
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    }, [t, toast]);

    React.useEffect(() => {
        void loadTemplates();
    }, [loadTemplates]);

    const handleCreate = () => {
        setEditingTemplate(null);
        setDraftTemplate(null);
        setIsFormOpen(true);
    };

    const handleEdit = (template: TemplateUrlItem) => {
        setEditingTemplate(template);
        setDraftTemplate(null);
        setIsFormOpen(true);
    };

    const handleFormOpenChange = (open: boolean) => {
        setIsFormOpen(open);

        if (!open) {
            setEditingTemplate(null);
            setDraftTemplate(null);

            if (shouldRestoreImportDialog) {
                setIsImportDialogOpen(true);
                setShouldRestoreImportDialog(false);
            }
        }
    };

    const handleSaveTemplate = async (input: SaveTemplateUrlInput) => {
        setIsSaving(true);

        try {
            await persistTemplateUrl(input);
            await loadTemplates();
            toast({
                title: t('templateUrlSaved'),
                description: t('templateUrlSavedDescription')
            });
        } catch (error) {
            console.error('Failed to save template url:', error);
            throw error instanceof Error ? error : new Error(t('templateUrlSaveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleRunTemplate = (template: TemplateUrlItem) => {
        setRunningTemplate(template);
    };

    const handleImportCandidate = async (candidate: ImportedTemplateCandidate) => {
        await persistTemplateUrl({
            name: candidate.name,
            description: '',
            urlTemplate: candidate.urlTemplate,
            openMode: 'new-tab'
        });

        await loadTemplates();
    };

    const handleEditImportedCandidate = (candidate: ImportedTemplateCandidate) => {
        setDraftTemplate({
            name: candidate.name,
            description: '',
            urlTemplate: candidate.urlTemplate,
            openMode: 'new-tab'
        });
        setEditingTemplate(null);
        setShouldRestoreImportDialog(true);
        setIsImportDialogOpen(false);
        setIsFormOpen(true);
    };

    const openUrl = async (url: string, openMode: TemplateUrlOpenMode) => {
        setIsRunning(true);

        try {
            if (openMode === 'current-tab') {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                const activeTab = tabs[0];

                if (activeTab?.id && !isRestrictedTabUrl(activeTab.url)) {
                    await browser.tabs.update(activeTab.id, { url });
                    return;
                }
            }

            await browser.tabs.create({ url });
        } catch (error) {
            console.error('Failed to open template url:', error);
            toast({
                title: t('error'),
                description: t('templateUrlExecuteFailed'),
                variant: 'destructive'
            });
            throw error instanceof Error ? error : new Error(t('templateUrlExecuteFailed'));
        } finally {
            setIsRunning(false);
        }
    };

    const handleDeleteTemplate = async () => {
        if (!deletingTemplate) {
            return;
        }

        setIsDeleting(true);

        try {
            await removeTemplateUrl(deletingTemplate.id);
            await loadTemplates();
            setDeletingTemplate(null);
            toast({
                title: t('templateUrlDeleted'),
                description: t('templateUrlDeletedDescription')
            });
        } catch (error) {
            console.error('Failed to delete template url:', error);
            toast({
                title: t('error'),
                description: t('templateUrlDeleteFailed'),
                variant: 'destructive'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-6 md:p-8 animate-in fade-in duration-500">
            <div className={cn(
                "space-y-4 rounded-[1.75rem] border border-border/70 bg-card/88 p-6 shadow-sm",
                "blueprint:blueprint-panel blueprint:rounded-[var(--card-radius)] blueprint:border-dashed"
            )}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                        <span className={cn(
                            "inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary",
                            "blueprint:rounded-[var(--badge-radius)] blueprint:border blueprint:border-border/60 blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.14em]"
                        )}>
                            {t('templateUrls')}
                        </span>
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary",
                                "blueprint:rounded-[var(--card-radius)] blueprint:border blueprint:border-primary/30"
                            )}>
                                <Link2 className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <h1 className={cn(
                                    "font-display text-3xl font-semibold tracking-tight",
                                    "blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.18em]"
                                )}>
                                    {t('templateUrls')}
                                </h1>
                                <p className={cn(
                                    "max-w-2xl text-sm text-muted-foreground",
                                    "blueprint:font-mono"
                                )}>
                                    {t('templateUrlsDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 self-start">
                        <Button
                            onClick={handleCreate}
                            className={cn("gap-2", "blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.12em]")}
                        >
                            <Plus className="h-4 w-4" />
                            {t('createTemplateUrl')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsImportDialogOpen(true)}
                            className={cn("gap-2", "blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.12em]")}
                        >
                            <FileDown className="h-4 w-4" />
                            {t('templateUrlImportButton')}
                        </Button>
                    </div>
                </div>
            </div>

            <TemplateUrlList
                items={templates}
                isLoading={isLoading}
                onCreate={handleCreate}
                onRun={handleRunTemplate}
                onEdit={handleEdit}
                onDelete={setDeletingTemplate}
            />

            <TemplateUrlFormDialog
                open={isFormOpen}
                onOpenChange={handleFormOpenChange}
                template={editingTemplate}
                draftTemplate={draftTemplate}
                isSaving={isSaving}
                onSubmit={handleSaveTemplate}
            />

            <TemplateUrlRunDialog
                open={!!runningTemplate}
                onOpenChange={(open) => {
                    if (!open) {
                        setRunningTemplate(null);
                    }
                }}
                template={runningTemplate}
                isRunning={isRunning}
                onRun={openUrl}
            />

            <TemplateUrlImportDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onImportCandidate={handleImportCandidate}
                onEditCandidate={handleEditImportedCandidate}
            />

            <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('templateUrlDeleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('templateUrlDeleteDescription', {
                                name: deletingTemplate?.name || ''
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/92"
                            disabled={isDeleting}
                            onClick={handleDeleteTemplate}
                        >
                            {isDeleting ? t('deleting') : t('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
