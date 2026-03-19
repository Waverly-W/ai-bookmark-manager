
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from './stat-card';
import { BookmarkStats } from '@/lib/statsUtils';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { BookOpen, Folder, Clock, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StatsDashboardProps {
    stats: BookmarkStats;
}

const COLORS = ['#b68a2e', '#6f8a52', '#d1a458', '#8a5a31', '#8a7160'];

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ stats }) => {
    const { t } = useTranslation();

    // Filter out empty dates for cleaner chart if needed, or keep them for continuity
    // For now, we use the data as is.

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title={t('totalBookmarks')}
                    value={stats.totalBookmarks}
                    icon={BookOpen}
                    description={t('totalBookmarksDesc')}
                />
                <StatCard
                    title={t('totalFolders')}
                    value={stats.totalFolders}
                    icon={Folder}
                />
                <StatCard
                    title={t('recentAdditions')}
                    value={stats.recentAdditions}
                    icon={Clock}
                    description={t('last30Days')}
                    trend={`+${stats.recentAdditions}`}
                    trendUp={true}
                />
                <StatCard
                    title={t('duplicates')}
                    value={stats.duplicateCount}
                    icon={Copy}
                    description={t('duplicatesDesc')}
                    trend={stats.duplicateCount > 0 ? `${stats.duplicateCount}` : undefined}
                    trendUp={false}
                />
            </div>

            <Card className="overflow-hidden border-border/70 bg-card/92">
                <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-2">
                        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                            {t('statistics')}
                        </span>
                        <div className="space-y-1">
                            <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                                {stats.recentAdditions > 0
                                    ? `${t('recentAdditions')}: ${stats.recentAdditions}`
                                    : t('totalBookmarks')}
                            </h3>
                            <p className="max-w-2xl text-sm text-muted-foreground">
                                {stats.duplicateCount > 0
                                    ? `${t('duplicates')}: ${stats.duplicateCount} · ${t('activityTrend')}`
                                    : `${t('activityTrend')} · ${t('topFolders')}`}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm md:min-w-[280px]">
                        <div className="rounded-[1rem] border border-border/70 bg-surface-2 px-4 py-3">
                            <div className="text-xs text-muted-foreground">{t('totalBookmarks')}</div>
                            <div className="mt-1 font-display text-xl font-semibold">{stats.totalBookmarks}</div>
                        </div>
                        <div className="rounded-[1rem] border border-border/70 bg-surface-2 px-4 py-3">
                            <div className="text-xs text-muted-foreground">{t('totalFolders')}</div>
                            <div className="mt-1 font-display text-xl font-semibold">{stats.totalFolders}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Folder Distribution */}
                <Card className="border-border/70 bg-card/92">
                    <CardHeader>
                        <CardTitle className="text-base font-medium">{t('topFolders')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            {stats.topFolders.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <PieChart>
                                        <Pie
                                            data={stats.topFolders}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={82}
                                            fill="hsl(var(--primary))"
                                            dataKey="count"
                                            nameKey="name"
                                            label={({ name, percent }: { name?: string, percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {stats.topFolders.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    {t('noData')}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Activity Trend */}
                <Card className="border-border/70 bg-card/92">
                    <CardHeader>
                        <CardTitle className="text-base font-medium">{t('activityTrend')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart
                                    data={stats.bookmarksByDate}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(value) => {
                                            const date = new Date(value);
                                            return `${date.getMonth() + 1}/${date.getDate()}`;
                                        }}
                                        minTickGap={30}
                                        fontSize={12}
                                    />
                                    <YAxis allowDecimals={false} fontSize={12} />
                                    <Tooltip
                                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                                        contentStyle={{ borderRadius: '8px' }}
                                    />
                                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
