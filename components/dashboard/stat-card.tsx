
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    description?: string;
    trend?: string;
    trendUp?: boolean;
    onClick?: () => void;
    tooltip?: string;
    actionLabel?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description, trend, trendUp, onClick, tooltip, actionLabel }) => {
    const IconWrapper = (
        <div
            className={`p-3 bg-primary/10 rounded-full transition-all duration-300 ${onClick
                ? 'cursor-pointer hover:bg-primary/20 hover:scale-110 hover:shadow-md ring-offset-background'
                : ''
                } ${onClick ? 'relative after:absolute after:inset-0 after:rounded-full after:ring-2 after:ring-primary/20 after:animate-pulse hover:after:ring-primary/40' : ''}`}
            onClick={onClick}
        >
            <Icon className="h-5 w-5 text-primary" />
        </div>
    );

    return (
        <Card className="relative overflow-hidden">
            {actionLabel && onClick && (
                <div
                    className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-bl-lg font-medium cursor-pointer hover:bg-primary/90 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                >
                    {actionLabel}
                </div>
            )}
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
                {onClick && tooltip ? (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {IconWrapper}
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{tooltip}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    IconWrapper
                )}
            </CardContent>
        </Card>
    );
};
