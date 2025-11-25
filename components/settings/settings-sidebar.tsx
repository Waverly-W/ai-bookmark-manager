import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Bookmark, Palette, Sparkles, RefreshCw, FileText, Database } from "lucide-react";

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
            id: "sync",
            label: t('syncSettingsTab'),
            icon: RefreshCw
        },
        {
            id: "data",
            label: t('dataManagementTab'),
            icon: Database
        }
    ];

    return (
        <nav className={cn("flex flex-col space-y-1", className)}>
            {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                    <Button
                        key={item.id}
                        variant={activeTab === item.id ? "secondary" : "ghost"}
                        className={cn(
                            "justify-start gap-2 px-4",
                            activeTab === item.id && "bg-secondary/50"
                        )}
                        onClick={() => onTabChange(item.id)}
                    >
                        <Icon className="h-4 w-4" />
                        {item.label}
                    </Button>
                );
            })}
        </nav>
    );
}
