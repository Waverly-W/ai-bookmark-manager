import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Settings, Home, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export enum SidebarType {
    'home' = 'home',
    'batchRename' = 'batchRename',
    'settings' = 'settings'
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
            <aside className="hidden md:flex fixed inset-y-0 left-0 z-10 flex-col border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 w-16">
                {/* Close button */}
                {closeContent && (
                    <div className="flex h-14 items-center justify-center border-b">
                        <button
                            onClick={closeContent}
                            className={cn(
                                "inline-flex items-center justify-center rounded-md",
                                "h-9 w-9 text-muted-foreground",
                                "transition-colors hover:bg-accent hover:text-accent-foreground",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            )}
                            aria-label="Close sidebar"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* Main navigation */}
                <nav className="flex flex-col items-center gap-2 px-2 py-4">
                    <TooltipProvider delayDuration={0}>
                        {/* Home */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleNavClick(SidebarType.home)}
                                    className={cn(
                                        "inline-flex items-center justify-center rounded-lg",
                                        "h-11 w-11 transition-all duration-200",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        sidebarType === SidebarType.home
                                            ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                    aria-label={t('home')}
                                >
                                    <Home className="h-5 w-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                {t('home')}
                            </TooltipContent>
                        </Tooltip>

                        {/* Batch Rename */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleNavClick(SidebarType.batchRename)}
                                    className={cn(
                                        "inline-flex items-center justify-center rounded-lg",
                                        "h-11 w-11 transition-all duration-200",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        sidebarType === SidebarType.batchRename
                                            ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                    aria-label={t('batchRenameTitle')}
                                >
                                    <Sparkles className="h-5 w-5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                {t('batchRenameTitle')}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </nav>

                {/* Bottom navigation - Settings */}
                <nav className="mt-auto flex flex-col items-center gap-2 px-2 py-4 border-t">
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => handleNavClick(SidebarType.settings)}
                                    className={cn(
                                        "inline-flex items-center justify-center rounded-lg",
                                        "h-11 w-11 transition-all duration-200",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        sidebarType === SidebarType.settings
                                            ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                    aria-label={t('settings')}
                                >
                                    <Settings className="h-5 w-5" />
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

                    {/* Batch Rename */}
                    <button
                        onClick={() => handleNavClick(SidebarType.batchRename)}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 flex-1 h-full",
                            "transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
                        )}
                        aria-label={t('batchRenameTitle')}
                    >
                        <div className={cn(
                            "flex items-center justify-center rounded-lg h-10 w-10 transition-all duration-200",
                            sidebarType === SidebarType.batchRename
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground"
                        )}>
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <span className={cn(
                            "text-xs font-medium truncate max-w-[80px] transition-colors",
                            sidebarType === SidebarType.batchRename
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}>
                            {t('batchRenameTitle')}
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
