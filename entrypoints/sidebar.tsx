import React, {useState} from "react";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {IoMdCloseCircle} from "react-icons/io";
import {IoIosSettings} from "react-icons/io";
import {RiDashboardFill} from "react-icons/ri";
import {Sparkles} from "lucide-react";
import {useTranslation} from "react-i18next";

export enum SidebarType {
    'home' = 'home',
    'batchRename' = 'batchRename',
    'settings' = 'settings'
}

const Sidebar = (
    {sideNav, closeContent}: {
        sideNav: (sidebarType: SidebarType) => void,
        closeContent?: () => void
    }) => {
    const [sidebarType, setSidebarType] = useState<SidebarType>(SidebarType.home);
    const { t } = useTranslation('common');

    const navItemClass = (isActive: boolean) => `
        hover:cursor-pointer flex items-center justify-center text-muted-foreground
        transition-smooth hover:text-foreground
        md:h-9 md:w-9 md:rounded-full
        h-12 w-12 rounded-lg
        ${isActive ? "md:bg-primary md:text-primary-foreground bg-primary text-primary-foreground" : ""}
    `;

    return (
        <>
            {/* 桌面端侧边栏 - 左侧竖向 */}
            <aside className="hidden md:flex fixed inset-y-0 left-0 z-10 flex-col border-r bg-background w-14">
                {closeContent && <a
                    className="hover:cursor-pointer flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground mx-auto"
                    href="#" onClick={() => {
                    closeContent()
                }}
                >
                    <IoMdCloseCircle className="h-4 w-4 transition-all group-hover:scale-110"/>
                    <span className="sr-only">close sidebar</span>
                </a>
                }
                <nav className="flex flex-col items-center gap-4 px-2 py-5">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <a
                                    className={navItemClass(sidebarType === SidebarType.home)}
                                    href="#" onClick={() => {
                                    setSidebarType(SidebarType.home)
                                    sideNav(SidebarType.home)
                                }}
                                    title={t('home')}
                                >
                                    <RiDashboardFill className="h-5 w-5 transition-smooth hover:scale-110"/>
                                    <span className="sr-only">{t('home')}</span>
                                </a>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="animate-fade-in">{t('home')}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <a
                                    className={navItemClass(sidebarType === SidebarType.batchRename)}
                                    href="#" onClick={() => {
                                    setSidebarType(SidebarType.batchRename)
                                    sideNav(SidebarType.batchRename)
                                }}
                                    title={t('batchRenameTitle')}
                                >
                                    <Sparkles className="h-5 w-5 transition-smooth hover:scale-110"/>
                                    <span className="sr-only">{t('batchRenameTitle')}</span>
                                </a>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="animate-fade-in">{t('batchRenameTitle')}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </nav>
                <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-5">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <a
                                    className={navItemClass(sidebarType === SidebarType.settings)}
                                    href="#" onClick={() => {
                                    setSidebarType(SidebarType.settings)
                                    sideNav(SidebarType.settings)
                                }}
                                    title={t('settings')}
                                >
                                    <IoIosSettings className="h-5 w-5 transition-smooth hover:scale-110"/>
                                    <span className="sr-only">{t('settings')}</span>
                                </a>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="animate-fade-in">{t('settings')}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </nav>
            </aside>

            {/* 移动端底部导航栏 */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 flex items-center justify-around border-t bg-background h-16 px-2 py-2 gap-2">
                <div className="flex flex-col items-center gap-1 flex-1">
                    <a
                        className={navItemClass(sidebarType === SidebarType.home)}
                        href="#" onClick={() => {
                        setSidebarType(SidebarType.home)
                        sideNav(SidebarType.home)
                    }}
                        title={t('home')}
                    >
                        <RiDashboardFill className="h-5 w-5 transition-smooth"/>
                        <span className="sr-only">{t('home')}</span>
                    </a>
                    <span className="text-xs text-muted-foreground">{t('home')}</span>
                </div>

                <div className="flex flex-col items-center gap-1 flex-1">
                    <a
                        className={navItemClass(sidebarType === SidebarType.batchRename)}
                        href="#" onClick={() => {
                        setSidebarType(SidebarType.batchRename)
                        sideNav(SidebarType.batchRename)
                    }}
                        title={t('batchRenameTitle')}
                    >
                        <Sparkles className="h-5 w-5 transition-smooth"/>
                        <span className="sr-only">{t('batchRenameTitle')}</span>
                    </a>
                    <span className="text-xs text-muted-foreground truncate">{t('batchRenameTitle')}</span>
                </div>

                <div className="flex flex-col items-center gap-1 flex-1">
                    <a
                        className={navItemClass(sidebarType === SidebarType.settings)}
                        href="#" onClick={() => {
                        setSidebarType(SidebarType.settings)
                        sideNav(SidebarType.settings)
                    }}
                        title={t('settings')}
                    >
                        <IoIosSettings className="h-5 w-5 transition-smooth"/>
                        <span className="sr-only">{t('settings')}</span>
                    </a>
                    <span className="text-xs text-muted-foreground">{t('settings')}</span>
                </div>
            </nav>
        </>);
};

export default Sidebar;


