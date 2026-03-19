import React, { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Settings, Home, Wrench, PieChart, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export enum SidebarType {
    'home' = 'home',
    'statistics' = 'statistics',
    'batchRename' = 'batchRename',
    'batchTag' = 'batchTag',
    'settings' = 'settings',
    'tools' = 'tools'
}

const Sidebar = (
    {
        sideNav,
        activeType,
        closeContent
    }: {
        sideNav: (sidebarType: SidebarType) => void,
        activeType: SidebarType,
        closeContent?: () => void
    }) => {
    const { t } = useTranslation('common');

    const primaryItems = useMemo(() => ([
        { type: SidebarType.home, label: t('home'), icon: Home },
        { type: SidebarType.statistics, label: t('statistics'), icon: PieChart },
        { type: SidebarType.tools, label: t('tools'), icon: Wrench },
    ]), [t]);

    const secondaryItems = useMemo(() => ([
        { type: SidebarType.settings, label: t('settings'), icon: Settings },
    ]), [t]);

    const isNavItemActive = (type: SidebarType) => {
        if (type === SidebarType.tools) {
            return [SidebarType.tools, SidebarType.batchRename, SidebarType.batchTag].includes(activeType);
        }

        return activeType === type;
    };

    const renderNavItem = (item: typeof primaryItems[number]) => {
        const Icon = item.icon;
        const isActive = isNavItemActive(item.type);

        const button = (
            <button
                onClick={() => sideNav(item.type)}
                className={cn(
                    "inline-flex h-12 w-12 items-center justify-center rounded-[1rem] transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                )}
                aria-label={item.label}
            >
                <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-current")} />
            </button>
        );

        return (
            <Tooltip key={item.type}>
                <TooltipTrigger asChild>
                    {button}
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                    {item.label}
                </TooltipContent>
            </Tooltip>
        );
    };

    return (
        <>
            <aside
                className={cn(
                    "hidden md:flex fixed inset-y-0 left-0 z-20 w-24 flex-col border-r border-border/70 bg-card/82 px-3 py-5 shadow-panel backdrop-blur-xl"
                )}
            >
                <div className="flex items-center justify-center px-1">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
                        <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    {closeContent && (
                        <button
                            onClick={closeContent}
                            className={cn(
                                "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground",
                                "transition-all duration-200 hover:bg-surface-2 hover:text-foreground",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            )}
                            aria-label="Close sidebar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                </div>

                <TooltipProvider delayDuration={0}>
                    <nav className="mt-8 flex flex-col items-center gap-2">
                        {renderNavItem(primaryItems[0])}
                        {renderNavItem(primaryItems[1])}
                        {renderNavItem(primaryItems[2])}
                    </nav>

                    <div className="my-6 h-px bg-border/70" />

                    <nav className="mt-auto flex flex-col items-center gap-2">
                        {secondaryItems.map(renderNavItem)}
                    </nav>
                </TooltipProvider>
            </aside>

            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center justify-around h-16 px-2">
                    {[
                        { type: SidebarType.home, label: t('home'), icon: Home },
                        { type: SidebarType.statistics, label: t('statistics'), icon: PieChart },
                        { type: SidebarType.tools, label: t('tools'), icon: Wrench },
                        { type: SidebarType.settings, label: t('settings'), icon: Settings },
                    ].map((item) => {
                        const Icon = item.icon;
                        const isActive = isNavItemActive(item.type);

                        return (
                            <button
                                key={item.type}
                                onClick={() => sideNav(item.type)}
                                className={cn(
                                    "flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-lg transition-colors duration-200",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                )}
                                aria-label={item.label}
                            >
                                <div className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground"
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <span className={cn(
                                    "text-xs font-medium transition-colors",
                                    isActive ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};

export default Sidebar;
