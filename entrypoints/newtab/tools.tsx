import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { Sparkles, ShieldCheck, Construction, Copy, Folder } from 'lucide-react';
import { DuplicateManager } from '@/components/tools/duplicate-manager';
import { ValidityManager } from '@/components/tools/validity-manager';
import { EmptyFolderManager } from '@/components/tools/empty-folder-manager';
import { SidebarType } from '@/entrypoints/sidebar';

interface ToolsPageProps {
    navigateTo?: (type: SidebarType) => void;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({ navigateTo }) => {
    const { t } = useTranslation('common');
    const { bookmarks, refresh } = useBookmarks();
    const [view, setView] = React.useState<'dashboard' | 'duplicate-manager' | 'validity-manager' | 'empty-folder-manager'>('dashboard');

    if (view === 'duplicate-manager') {
        return (
            <div className="container mx-auto p-6 md:p-8 max-w-7xl animate-in fade-in duration-500">
                <DuplicateManager
                    bookmarks={bookmarks}
                    onRefresh={refresh}
                    onBack={() => setView('dashboard')}
                />
            </div>
        );
    }

    if (view === 'validity-manager') {
        return (
            <div className="container mx-auto p-6 md:p-8 max-w-7xl animate-in fade-in duration-500">
                <ValidityManager
                    bookmarks={bookmarks}
                    onRefresh={refresh}
                    onBack={() => setView('dashboard')}
                />
            </div>
        );
    }

    if (view === 'empty-folder-manager') {
        return (
            <div className="container mx-auto p-6 md:p-8 max-w-7xl animate-in fade-in duration-500">
                <EmptyFolderManager
                    bookmarks={bookmarks}
                    onRefresh={refresh}
                    onBack={() => setView('dashboard')}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 container mx-auto p-6 md:p-8 max-w-7xl animate-in fade-in duration-500">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{t('tools')}</h1>
                <p className="text-muted-foreground">
                    {t('toolsDescription', 'Manage and analyze your bookmarks with advanced tools.')}
                </p>
            </div>


            {/* Tools Grid */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                    <Construction className="h-5 w-5 text-primary" />
                    {t('managementTools')}
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                    {/* Batch Rename Card */}
                    <Card className="flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                        <CardHeader>
                            <div className="p-2 w-fit rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400 mb-2">
                                <Sparkles className="h-6 w-6" />
                            </div>
                            <CardTitle>{t('batchRenameTitle')}</CardTitle>
                            <CardDescription>
                                {t('batchRenameDescription')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0">
                            <Button
                                onClick={() => navigateTo?.(SidebarType.batchRename)}
                                className="w-full"
                                variant="outline"
                            >
                                {t('openTool')}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Duplicate Manager Card */}
                    <Card className="flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                        <CardHeader>
                            <div className="p-2 w-fit rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 mb-2">
                                <Copy className="h-6 w-6" />
                            </div>
                            <CardTitle>{t('duplicateManager')}</CardTitle>
                            <CardDescription>
                                {t('duplicateManagerDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0">
                            <Button
                                onClick={() => setView('duplicate-manager')}
                                className="w-full"
                                variant="outline"
                            >
                                {t('manageDuplicates')}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Validity Check Card */}
                    <Card className="flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                        <CardHeader>
                            <div className="p-2 w-fit rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 mb-2">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <CardTitle>{t('validityCheck')}</CardTitle>
                            <CardDescription>
                                {t('validityCheckDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0">
                            <Button
                                onClick={() => setView('validity-manager')}
                                className="w-full"
                                variant="outline"
                            >
                                {t('checkLinks')}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Empty Folder Card */}
                    <Card className="flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                        <CardHeader>
                            <div className="p-2 w-fit rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-2">
                                <Folder className="h-6 w-6" />
                            </div>
                            <CardTitle>{t('emptyFolders')}</CardTitle>
                            <CardDescription>
                                {t('emptyFoldersDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="mt-auto pt-0">
                            <Button
                                onClick={() => setView('empty-folder-manager')}
                                className="w-full"
                                variant="outline"
                            >
                                {t('manageFolders')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
