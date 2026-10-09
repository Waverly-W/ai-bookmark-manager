import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Bookmark, Palette, Sparkles, FileText, Database, FolderTree } from "lucide-react";

interface SettingsSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    className?: string;
}

export function SettingsSidebar({ activeTab, onTabChange, className }: SettingsSidebarProps) {
    const { t } = useTranslation();

    const menuItems = [
        {
            id: "bookmarks",
            label: t('bookmarkSettingsTab'),
            icon: Bookmark
        },
        {
            id: "appearance",
            label: t('appearanceSettingsTab'),
            icon: Palette
        },
        {
            id: "ai-service",
            label: t('aiServiceTab'),
            icon: Sparkles
        },
        {
            id: "prompts",
            label: t('promptsTab'),
            icon: FileText
        },
        {
            id: "obsidian",
            label: t('obsidianSettingsTab'),
            icon: FolderTree
        },
        {
            id: "data",
            label: t('dataManagementTab'),
            icon: Database
        }
    ];

    return (
        <nav className={cn(
            "flex gap-1 overflow-x-auto rounded-[1.5rem] border border-border/70 bg-card/88 p-2 shadow-sm lg:flex-col lg:overflow-x-visible",
            "blueprint:rounded-[var(--card-radius)] blueprint:border-dashed",
            className
        )}>
            {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                    <Button
                        key={item.id}
                        variant={activeTab === item.id ? "subtle" : "ghost"}
                        className={cn(
                            "h-11 shrink-0 justify-start gap-3 whitespace-nowrap rounded-[1rem] px-4 lg:w-full",
                            "blueprint:rounded-[var(--button-radius)] blueprint:font-mono blueprint:uppercase blueprint:tracking-[0.14em]",
                            activeTab === item.id
                                ? "bg-primary-soft text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-current={activeTab === item.id ? "page" : undefined}
                        onClick={() => onTabChange(item.id)}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                    </Button>
                );
            })}
        </nav>
    );
}
