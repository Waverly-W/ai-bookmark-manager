
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    description?: string;
    trend?: string;
    trendUp?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description, trend, trendUp }) => {
    return (
        <Card>
            <CardContent className="p-6 flex items-center justify-between space-y-0">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className="text-2xl font-bold">{value}</div>
                    {(description || trend) && (
                        <p className="text-xs text-muted-foreground flex items-center">
                            {trend && (
                                <span className={`${trendUp ? "text-green-500" : "text-red-500"} mr-2 font-medium`}>
                                    {trend}
                                </span>
                            )}
                            {description}
                        </p>
                    )}
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
            </CardContent>
        </Card>
    );
};
