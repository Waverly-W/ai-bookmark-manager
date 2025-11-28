import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsDashboard } from '@/components/dashboard/stats-dashboard';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { calculateBookmarkStats } from '@/lib/statsUtils';
import { Sparkles, ShieldCheck, Construction } from 'lucide-react';
import { DuplicateManager } from '@/components/tools/duplicate-manager';
import { ValidityManager } from '@/components/tools/validity-manager';
import { EmptyFolderManager } from '@/components/tools/empty-folder-manager';

export const ToolsPage: React.FC = () => {
    const { t } = useTranslation('common');
    const { bookmarks, refresh } = useBookmarks();
    const statsData = React.useMemo(() => calculateBookmarkStats(bookmarks), [bookmarks]);
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

            {/* Statistics Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t('statistics')}
                </h2>
                {statsData ? (
                    <StatsDashboard
                        stats={statsData}
                        onDuplicateClick={() => setView('duplicate-manager')}
                        onValidityClick={() => setView('validity-manager')}
                        onEmptyFolderClick={() => setView('empty-folder-manager')}
                    />
                ) : (
                    <div className="h-[200px] flex items-center justify-center border rounded-lg bg-muted/20">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <span>{t('loadingStatistics', 'Loading statistics...')}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Other tools cards can go here in the future */}
            </div>
        </div>
    );
};
