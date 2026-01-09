import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Settings, Home, Sparkles, Wrench, PieChart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export enum SidebarType {
    'home' = 'home',
    'statistics' = 'statistics',
    'batchRename' = 'batchRename',
    'settings' = 'settings',
    'tools' = 'tools'
}

const Sidebar = (
    { sideNav, closeContent }: {
        sideNav: (sidebarType: SidebarType) => void,
        closeContent?: () => void
    }) => {
    const [sidebarType, setSidebarType] = useState<SidebarType>(SidebarType.home);
    const { t } = useTranslation('common');

    const handleNavClick = (type: SidebarType) => {
        setSidebarType(type);
        sideNav(type);
    };

    return (
        <>
            {/* Desktop Sidebar - Left vertical */}
            <aside className="hidden md:flex fixed inset-y-0 left-0 z-10 flex-col bg-secondary/15 backdrop-blur-sm w-20 transition-all duration-300">
                {/* Close button */}
                {closeContent && (
                    <div className="flex h-14 items-center justify-center">
                        <button
                            onClick={closeContent}
                            className={cn(
                                "inline-flex items-center justify-center rounded-full",
                                "h-9 w-9 text-muted-foreground",
                                "transition-all duration-200 hover:bg-secondary/20 hover:text-secondary-foreground",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            )}
                            aria-label="Close sidebar"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* Main navigation */}
                <nav className="flex flex-col items-center gap-4 py-8">
                    <TooltipProvider delayDuration={0}>
                        {/* Home */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleNavClick(SidebarType.home)}
                                    className={cn(
                                        "inline-flex items-center justify-center rounded-2xl",
                                        "h-12 w-12 transition-all duration-300 ease-spring",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        sidebarType === SidebarType.home
                                            ? "bg-primary text-primary-foreground shadow-md scale-105"
                                            : "text-muted-foreground/80 hover:bg-secondary/20 hover:text-foreground hover:scale-105"
                                    )}
                                    aria-label={t('home')}
                                >
                                    <Home className="h-6 w-6" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                {t('home')}
                            </TooltipContent>
                        </Tooltip>

                        {/* Statistics */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleNavClick(SidebarType.statistics)}
                                    className={cn(
                                        "inline-flex items-center justify-center rounded-2xl",
                                        "h-12 w-12 transition-all duration-300 ease-spring",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        sidebarType === SidebarType.statistics
                                            ? "bg-primary text-primary-foreground shadow-md scale-105"
                                            : "text-muted-foreground/80 hover:bg-secondary/20 hover:text-foreground hover:scale-105"
                                    )}
                                    aria-label={t('statistics')}
                                >
                                    <PieChart className="h-6 w-6" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                {t('statistics')}
                            </TooltipContent>
                        </Tooltip>



                        {/* Tools */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleNavClick(SidebarType.tools)}
                                    className={cn(
                                        "inline-flex items-center justify-center rounded-2xl",
                                        "h-12 w-12 transition-all duration-300 ease-spring",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        sidebarType === SidebarType.tools
                                            ? "bg-primary text-primary-foreground shadow-md scale-105"
                                            : "text-muted-foreground/80 hover:bg-secondary/20 hover:text-foreground hover:scale-105"
                                    )}
                                    aria-label={t('tools')}
                                >
                                    <Wrench className="h-6 w-6" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                {t('tools')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </nav>

                {/* Bottom navigation - Settings */}
                <nav className="mt-auto flex flex-col items-center gap-4 py-8">
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleNavClick(SidebarType.settings)}
                                    className={cn(
                                        "inline-flex items-center justify-center rounded-2xl",
                                        "h-12 w-12 transition-all duration-300 ease-spring",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        sidebarType === SidebarType.settings
                                            ? "bg-primary text-primary-foreground shadow-md scale-105"
                                            : "text-muted-foreground/80 hover:bg-secondary/20 hover:text-foreground hover:scale-105"
                                    )}
                                    aria-label={t('settings')}
                                >
                                    <Settings className="h-6 w-6" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                {t('settings')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </nav>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center justify-around h-16 px-2">
                    {/* Home */}
                    <button
                        onClick={() => handleNavClick(SidebarType.home)}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                            "transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
                        )}
                        aria-label={t('home')}
                    >
                        <div className={cn(
                            "flex items-center justify-center rounded-lg h-10 w-10 transition-all duration-200",
                            sidebarType === SidebarType.home
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground"
                        )}>
                            <Home className="h-5 w-5" />
                        </div>
                        <span className={cn(
                            "text-xs font-medium transition-colors",
                            sidebarType === SidebarType.home
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}>
                            {t('home')}
                        </span>
                    </button>

                    {/* Statistics */}
                    <button
                        onClick={() => handleNavClick(SidebarType.statistics)}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                            "transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
                        )}
                        aria-label={t('statistics')}
                    >
                        <div className={cn(
                            "flex items-center justify-center rounded-lg h-10 w-10 transition-all duration-200",
                            sidebarType === SidebarType.statistics
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground"
                        )}>
                            <PieChart className="h-5 w-5" />
                        </div>
                        <span className={cn(
                            "text-xs font-medium transition-colors",
                            sidebarType === SidebarType.statistics
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}>
                            {t('statistics')}
                        </span>
                    </button>



                    {/* Tools */}
                    <button
                        onClick={() => handleNavClick(SidebarType.tools)}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                            "transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
                        )}
                        aria-label={t('tools')}
                    >
                        <div className={cn(
                            "flex items-center justify-center rounded-lg h-10 w-10 transition-all duration-200",
                            sidebarType === SidebarType.tools
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground"
                        )}>
                            <Wrench className="h-5 w-5" />
                        </div>
                        <span className={cn(
                            "text-xs font-medium transition-colors",
                            sidebarType === SidebarType.tools
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}>
                            {t('tools')}
                        </span>
                    </button>

                    {/* Settings */}
                    <button
                        onClick={() => handleNavClick(SidebarType.settings)}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                            "transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
                        )}
                        aria-label={t('settings')}
                    >
                        <div className={cn(
                            "flex items-center justify-center rounded-lg h-10 w-10 transition-all duration-200",
                            sidebarType === SidebarType.settings
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground"
                        )}>
                            <Settings className="h-5 w-5" />
                        </div>
                        <span className={cn(
                            "text-xs font-medium transition-colors",
                            sidebarType === SidebarType.settings
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}>
                            {t('settings')}
                        </span>
                    </button>
                </div>
            </nav>
        </>
    );
};

export default Sidebar;
