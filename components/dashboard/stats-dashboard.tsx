
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Folder Distribution */}
                <Card>
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
                                            outerRadius={80}
                                            fill="#8884d8"
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
                <Card>
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
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                                    <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
