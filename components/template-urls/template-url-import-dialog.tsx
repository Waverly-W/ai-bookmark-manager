import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, FolderSearch, Loader2, RefreshCcw } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchableFolderSelect } from '@/components/ui/searchable-folder-select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getBookmarkFolderTree, getBookmarksInFolder, type BookmarkFolder } from '@/lib/bookmarkUtils';
import {
    buildImportTemplateCandidates,
    type ImportedTemplateCandidate
} from '@/lib/templateUrlImportUtils';
import { TemplateUrlImportCandidateCard } from '@/components/template-urls/template-url-import-candidate-card';

type ImportView = 'select-folder' | 'scanning' | 'candidates';

interface TemplateUrlImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportCandidate: (candidate: ImportedTemplateCandidate) => Promise<void>;
    onEditCandidate: (candidate: ImportedTemplateCandidate) => void;
}

const findFolderById = (folders: BookmarkFolder[], id: string): BookmarkFolder | null => {
    for (const folder of folders) {
        if (folder.id === id) {
            return folder;
        }

        if (folder.children) {
            const found = findFolderById(folder.children, id);
            if (found) {
                return found;
            }
        }
    }

    return null;
};

export const TemplateUrlImportDialog: React.FC<TemplateUrlImportDialogProps> = ({
    open,
    onOpenChange,
    onImportCandidate,
    onEditCandidate
}) => {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [folders, setFolders] = React.useState<BookmarkFolder[]>([]);
    const [selectedFolderId, setSelectedFolderId] = React.useState('');
    const [view, setView] = React.useState<ImportView>('select-folder');
    const [candidates, setCandidates] = React.useState<ImportedTemplateCandidate[]>([]);
    const [isLoadingFolders, setIsLoadingFolders] = React.useState(false);
    const [isScanning, setIsScanning] = React.useState(false);
    const [importingCandidateId, setImportingCandidateId] = React.useState<string | null>(null);
    const [emptyStateMessage, setEmptyStateMessage] = React.useState('');
    const [inlineError, setInlineError] = React.useState('');

    const selectedFolder = React.useMemo(
        () => findFolderById(folders, selectedFolderId),
        [folders, selectedFolderId]
    );

    React.useEffect(() => {
        if (!open || folders.length > 0 || isLoadingFolders) {
            return;
        }

        const loadFolders = async () => {
            setIsLoadingFolders(true);

            try {
                const folderTree = await getBookmarkFolderTree();
                const nextFolders = folderTree.filter((folder) => folder.id !== 'all');
                setFolders(nextFolders);
                setSelectedFolderId((current) => current || nextFolders[0]?.id || '');
            } catch (error) {
                console.error('Failed to load bookmark folders for import:', error);
                setInlineError(t('templateUrlImportFolderLoadFailed'));
            } finally {
                setIsLoadingFolders(false);
            }
        };

        void loadFolders();
    }, [folders.length, isLoadingFolders, open, t]);

    const handleScan = async () => {
        if (!selectedFolderId || !selectedFolder) {
            return;
        }

        setIsScanning(true);
        setInlineError('');
        setEmptyStateMessage('');
        setView('scanning');

        try {
            const bookmarks = await getBookmarksInFolder(selectedFolderId);
            const nextCandidates = buildImportTemplateCandidates(bookmarks, selectedFolder.title);

            setCandidates(nextCandidates);
            setView('candidates');

            if (nextCandidates.length === 0) {
                setEmptyStateMessage(t('templateUrlImportNoCandidates'));
            }
        } catch (error) {
            console.error('Failed to scan bookmark folder for template import:', error);
            setInlineError(t('templateUrlImportScanFailed'));
            setView('select-folder');
            toast({
                title: t('error'),
                description: t('templateUrlImportScanFailed'),
                variant: 'destructive'
            });
        } finally {
            setIsScanning(false);
        }
    };

    const handleImportCandidate = async (candidate: ImportedTemplateCandidate) => {
        setImportingCandidateId(candidate.id);

        try {
            await onImportCandidate(candidate);
            setCandidates((current) => current.filter((item) => item.id !== candidate.id));
            toast({
                title: t('templateUrlSaved'),
                description: t('templateUrlImportSuccess')
            });
        } catch (error) {
            console.error('Failed to import template candidate:', error);
            toast({
                title: t('error'),
                description: error instanceof Error ? error.message : t('templateUrlImportFailed'),
                variant: 'destructive'
            });
        } finally {
            setImportingCandidateId(null);
        }
    };

    const renderSelectFolder = () => (
        <div className="grid gap-5">
            <div className="grid gap-2">
                <p className={cn(
                    "text-sm text-muted-foreground",
                    "blueprint:font-mono"
                )}>
                    {t('templateUrlImportDescription')}
                </p>
            </div>

            <div className="grid gap-2">
                <label className="text-sm font-medium">{t('templateUrlImportFolder')}</label>
                <SearchableFolderSelect
                    folders={folders}
                    selectedId={selectedFolderId}
                    onSelect={setSelectedFolderId}
                    placeholder={t('templateUrlImportFolderPlaceholder')}
                    popoverContentClassName="z-[10010]"
                />
            </div>

            {inlineError && <p className="text-sm text-destructive">{inlineError}</p>}

            <div className="flex justify-end">
                <Button
                    onClick={() => void handleScan()}
                    disabled={!selectedFolderId || isLoadingFolders}
                    className={cn("blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.12em]")}
                >
                    {isLoadingFolders ? t('loading') : t('templateUrlImportScan')}
                </Button>
            </div>
        </div>
    );

    const renderScanning = () => (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="space-y-2 text-center">
                <p className={cn(
                    "text-base font-medium",
                    "blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.12em]"
                )}>
                    {t('templateUrlImportScanning')}
                </p>
                <p className="text-sm text-muted-foreground">
                    {selectedFolder?.title || t('templateUrlImportFolder')}
                </p>
            </div>
        </div>
    );

    const renderCandidates = () => {
        if (candidates.length === 0) {
            return (
                <div className="space-y-4">
                    <EmptyState
                        className={cn(
                            "rounded-[1.5rem] border-border/70 bg-card/72 py-12",
                            "blueprint:blueprint-panel blueprint:rounded-[var(--card-radius)] blueprint:border-dashed blueprint:bg-card/82"
                        )}
                        icon={<FolderSearch className="h-8 w-8 text-primary" />}
                        title={t('templateUrlImportEmptyTitle')}
                        description={emptyStateMessage || t('templateUrlImportNoCandidates')}
                    />
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={() => setView('select-folder')}>
                            {t('templateUrlImportChangeFolder')}
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        {t('templateUrlImportCandidatesCount', { count: candidates.length })}
                    </p>
                    <Button variant="outline" className="gap-2" onClick={() => setView('select-folder')}>
                        <RefreshCcw className="h-4 w-4" />
                        {t('templateUrlImportChangeFolder')}
                    </Button>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                    {candidates.map((candidate) => (
                        <TemplateUrlImportCandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            isImporting={importingCandidateId === candidate.id}
                            onImport={handleImportCandidate}
                            onEdit={onEditCandidate}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className={cn("blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.16em]")}>
                        {t('templateUrlImportTitle')}
                    </DialogTitle>
                    <DialogDescription className={cn("blueprint:font-mono")}>
                        {t('templateUrlImportDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5">
                    {view === 'select-folder' && renderSelectFolder()}
                    {view === 'scanning' && renderScanning()}
                    {view === 'candidates' && renderCandidates()}
                </div>
            </DialogContent>
        </Dialog>
    );
};
