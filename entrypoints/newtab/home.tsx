import React from "react";
import { Bookmarks } from "@/entrypoints/newtab/bookmarks.tsx";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider.tsx";
import { cn } from "@/lib/utils";

interface HomeProps {
    onNavigate?: unknown;
}

export function Home({ onNavigate: _onNavigate }: HomeProps) {
    const { t } = useTranslation('common');
    const { themeId } = useTheme();

    return (
        <div className="container mx-auto max-w-[1600px] p-6 md:p-8">
            <section className="space-y-4">
                <div>
                    <h1 className={cn(
                        "font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl",
                        themeId === 'blueprint' && "font-mono uppercase tracking-[0.18em]"
                    )}>
                        {t('allBookmarks')}
                    </h1>
                    <p className={cn(
                        "mt-2 max-w-2xl text-sm leading-6 text-muted-foreground",
                        themeId === 'blueprint' && "font-mono"
                    )}>
                        {t('workspaceLibraryDesc', 'Browse, search, and batch-manage the bookmarks in your current workspace.')}
                    </p>
                </div>
                <Bookmarks />
            </section>
        </div>
    )
}
