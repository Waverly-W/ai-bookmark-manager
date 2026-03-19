
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
            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 transition-all duration-300 ${onClick
                ? 'cursor-pointer hover:bg-primary/20 hover:scale-105 hover:shadow-md ring-offset-background'
                : ''
                } ${onClick ? 'relative after:absolute after:inset-0 after:rounded-2xl after:ring-2 after:ring-primary/20 after:animate-pulse hover:after:ring-primary/40' : ''}`}
            onClick={onClick}
        >
            <Icon className="h-5 w-5 text-primary" />
        </div>
    );

    return (
        <Card className="relative overflow-hidden border-border/70 bg-card/92">
            {actionLabel && onClick && (
                <div
                    className="absolute right-0 top-0 cursor-pointer rounded-bl-xl bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                >
                    {actionLabel}
                </div>
            )}
            <CardContent className="flex items-start justify-between space-y-0 p-6">
                <div className="space-y-1.5">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className="font-display text-[2rem] font-semibold tracking-tight">{value}</div>
                    {(description || trend) && (
                        <p className="flex items-center text-xs text-muted-foreground">
                            {trend && (
                                <span className={`${trendUp ? "text-accent" : "text-destructive"} mr-2 font-medium`}>
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
