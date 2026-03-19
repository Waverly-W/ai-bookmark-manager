import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { Sparkles, ShieldCheck, Construction, Copy, Folder, Tags, ArrowUpRight } from 'lucide-react';
import { DuplicateManager } from '@/components/tools/duplicate-manager';
import { ValidityManager } from '@/components/tools/validity-manager';
import { EmptyFolderManager } from '@/components/tools/empty-folder-manager';
import { SidebarType } from '@/entrypoints/sidebar';
import { calculateBookmarkStats } from '@/lib/statsUtils';
import { cn } from '@/lib/utils';

interface ToolsPageProps {
    navigateTo?: (type: SidebarType) => void;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({ navigateTo }) => {
    const { t } = useTranslation('common');
    const { bookmarks, refresh } = useBookmarks();
    const [view, setView] = React.useState<'dashboard' | 'duplicate-manager' | 'validity-manager' | 'empty-folder-manager'>('dashboard');
    const stats = React.useMemo(() => calculateBookmarkStats(bookmarks), [bookmarks]);

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
        <div className="container mx-auto max-w-7xl space-y-6 p-6 md:p-8 animate-in fade-in duration-500">
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <Card className="overflow-hidden border-border/70 bg-card/92">
                    <CardContent className="space-y-6 p-6">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                                    {t('tools')}
                                </span>
                                <span className="rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs text-muted-foreground">
                                    {t('managementTools')}
                                </span>
                            </div>
                            <div className="space-y-2">
                                <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">{t('tools')}</h1>
                                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                                    {t('toolsDescription', 'Manage and analyze your bookmarks with advanced tools.')}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            {[
                                { label: t('totalBookmarks'), value: stats.totalBookmarks, accent: "bg-primary/10 text-primary" },
                                { label: t('duplicates'), value: stats.duplicateCount, accent: "bg-destructive/10 text-destructive" },
                                { label: t('totalFolders'), value: stats.totalFolders, accent: "bg-accent/15 text-accent" },
                            ].map((item) => (
                                <div key={item.label} className="rounded-[1.25rem] border border-border/70 bg-surface-2/85 p-4 shadow-sm">
                                    <div className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", item.accent)}>
                                        {item.label}
                                    </div>
                                    <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/92">
                    <CardHeader className="space-y-2">
                        <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                            {t('quickActions', 'Quick actions')}
                        </span>
                        <CardTitle className="text-2xl">{t('continueOrganizing', 'Continue organizing')}</CardTitle>
                        <CardDescription>{t('workspaceFocus', 'Focus areas')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <Button variant="subtle" className="w-full justify-between" onClick={() => navigateTo?.(SidebarType.batchRename)}>
                            <span>{t('batchRenameTitle')}</span>
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                        <Button variant="subtle" className="w-full justify-between" onClick={() => navigateTo?.(SidebarType.batchTag)}>
                            <span>{t('batchTagTitle')}</span>
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="w-full justify-between" onClick={() => setView('duplicate-manager')}>
                            <span>{t('manageDuplicates')}</span>
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </section>

            <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                    <Construction className="h-5 w-5 text-primary" />
                    {t('managementTools')}
                </h2>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {[
                        {
                            title: t('batchRenameTitle'),
                            description: t('batchRenameDescription'),
                            action: t('openTool'),
                            icon: Sparkles,
                            accent: "bg-primary/10 text-primary",
                            onClick: () => navigateTo?.(SidebarType.batchRename),
                        },
                        {
                            title: t('batchTagTitle'),
                            description: t('batchTagDescription'),
                            action: t('openTool'),
                            icon: Tags,
                            accent: "bg-accent/15 text-accent",
                            onClick: () => navigateTo?.(SidebarType.batchTag),
                        },
                        {
                            title: t('duplicateManager'),
                            description: t('duplicateManagerDesc'),
                            action: t('manageDuplicates'),
                            icon: Copy,
                            accent: "bg-destructive/10 text-destructive",
                            onClick: () => setView('duplicate-manager'),
                        },
                        {
                            title: t('validityCheck'),
                            description: t('validityCheckDesc'),
                            action: t('checkLinks'),
                            icon: ShieldCheck,
                            accent: "bg-accent/15 text-accent",
                            onClick: () => setView('validity-manager'),
                        },
                        {
                            title: t('emptyFolders'),
                            description: t('emptyFoldersDesc'),
                            action: t('manageFolders'),
                            icon: Folder,
                            accent: "bg-secondary text-secondary-foreground",
                            onClick: () => setView('empty-folder-manager'),
                        }
                    ].map((tool) => {
                        const Icon = tool.icon;

                        return (
                            <Card key={tool.title} className="flex flex-col overflow-hidden border-border/70 bg-card/92 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                                <CardHeader className="space-y-4">
                                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm", tool.accent)}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <CardTitle>{tool.title}</CardTitle>
                                        <CardDescription>{tool.description}</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="mt-auto pt-0">
                                    <Button onClick={tool.onClick} className="w-full justify-between" variant="outline">
                                        <span>{tool.action}</span>
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
