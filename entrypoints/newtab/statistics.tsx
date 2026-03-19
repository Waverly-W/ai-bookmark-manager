import React from 'react';
import { useTranslation } from 'react-i18next';
import { StatsDashboard } from '@/components/dashboard/stats-dashboard';
import { useBookmarks } from '@/hooks/use-bookmarks';
import { calculateBookmarkStats } from '@/lib/statsUtils';
import { Sparkles } from 'lucide-react';

export const StatisticsPage: React.FC = () => {
    const { t } = useTranslation('common');
    const { bookmarks } = useBookmarks();
    const statsData = React.useMemo(() => calculateBookmarkStats(bookmarks), [bookmarks]);

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-6 md:p-8 animate-in fade-in duration-500">
            <div className="space-y-2 rounded-[1.75rem] border border-border/70 bg-card/88 p-6 shadow-sm">
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                    {t('statistics')}
                </span>
                <h1 className="font-display text-3xl font-semibold tracking-tight">{t('statistics')}</h1>
                <p className="max-w-2xl text-muted-foreground">
                    {t('statisticsDescription', 'Visualize and analyze your bookmark data.')}
                </p>
            </div>

            <div className="space-y-4">
                {statsData ? (
                    <StatsDashboard stats={statsData} />
                ) : (
                    <div className="h-[200px] flex items-center justify-center border rounded-lg bg-muted/20">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <span>{t('loadingStatistics', 'Loading statistics...')}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
