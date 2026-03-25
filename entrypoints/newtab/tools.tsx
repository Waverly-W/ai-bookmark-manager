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
import { useTheme } from '@/components/theme-provider.tsx';

interface ToolsPageProps {
    navigateTo?: (type: SidebarType) => void;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({ navigateTo }) => {
    const { t } = useTranslation('common');
    const { themeId } = useTheme();
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
                <Card className={cn(
                    "overflow-hidden border-border/70 bg-card/92",
                    themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed"
                )}>
                    <CardContent className="space-y-6 p-6">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={cn(
                                    "rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary",
                                    themeId === 'blueprint' && "rounded-[var(--badge-radius)] border border-border/60 font-mono uppercase tracking-[0.14em]"
                                )}>
                                    {t('tools')}
                                </span>
                                <span className={cn(
                                    "rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs text-muted-foreground",
                                    themeId === 'blueprint' && "rounded-[var(--badge-radius)] font-mono"
                                )}>
                                    {t('managementTools')}
                                </span>
                            </div>
                            <div className="space-y-2">
                                <h1 className={cn(
                                    "font-display text-4xl font-semibold tracking-tight text-foreground",
                                    themeId === 'blueprint' && "font-mono uppercase tracking-[0.18em]"
                                )}>{t('tools')}</h1>
                                <p className={cn(
                                    "max-w-2xl text-sm leading-6 text-muted-foreground",
                                    themeId === 'blueprint' && "font-mono"
                                )}>
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
                                <div key={item.label} className={cn(
                                    "rounded-[1.25rem] border border-border/70 bg-surface-2/85 p-4 shadow-sm",
                                    themeId === 'blueprint' && "rounded-[var(--card-radius)] border-dashed"
                                )}>
                                    <div className={cn(
                                        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
                                        themeId === 'blueprint' && "rounded-[var(--badge-radius)] font-mono uppercase tracking-[0.12em]",
                                        item.accent
                                    )}>
                                        {item.label}
                                    </div>
                                    <div className={cn(
                                        "mt-3 font-display text-3xl font-semibold tracking-tight text-foreground",
                                        themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]"
                                    )}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className={cn(
                    "border-border/70 bg-card/92",
                    themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed"
                )}>
                    <CardHeader className="space-y-2">
                        <span className={cn(
                            "inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary",
                            themeId === 'blueprint' && "rounded-[var(--badge-radius)] border border-border/60 font-mono uppercase tracking-[0.14em]"
                        )}>
                            {t('quickActions', 'Quick actions')}
                        </span>
                        <CardTitle className={cn("text-2xl", themeId === 'blueprint' && "font-mono uppercase tracking-[0.16em]")}>{t('continueOrganizing', 'Continue organizing')}</CardTitle>
                        <CardDescription className={cn(themeId === 'blueprint' && "font-mono")}>{t('workspaceFocus', 'Focus areas')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <Button variant="subtle" className={cn("w-full justify-between", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")} onClick={() => navigateTo?.(SidebarType.batchRename)}>
                            <span>{t('batchRenameTitle')}</span>
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                        <Button variant="subtle" className={cn("w-full justify-between", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")} onClick={() => navigateTo?.(SidebarType.batchTag)}>
                            <span>{t('batchTagTitle')}</span>
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className={cn("w-full justify-between", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")} onClick={() => setView('duplicate-manager')}>
                            <span>{t('manageDuplicates')}</span>
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </section>

            <div className="space-y-4">
                <h2 className={cn(
                    "flex items-center gap-2 text-xl font-semibold tracking-tight",
                    themeId === 'blueprint' && "font-mono uppercase tracking-[0.16em]"
                )}>
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
                            <Card key={tool.title} className={cn(
                                "flex flex-col overflow-hidden border-border/70 bg-card/92 transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
                                themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed"
                            )}>
                                <CardHeader className="space-y-4">
                                    <div className={cn(
                                        "flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm",
                                        themeId === 'blueprint' && "rounded-[var(--card-radius)] border border-border/40",
                                        tool.accent
                                    )}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <CardTitle className={cn(themeId === 'blueprint' && "font-mono uppercase tracking-[0.14em]")}>{tool.title}</CardTitle>
                                        <CardDescription className={cn(themeId === 'blueprint' && "font-mono")}>{tool.description}</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="mt-auto pt-0">
                                    <Button onClick={tool.onClick} className={cn("w-full justify-between", themeId === 'blueprint' && "font-mono uppercase tracking-[0.12em]")} variant="outline">
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
