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
            <section className="space-y-6">
                <div className={cn(
                    "panel-shell relative overflow-hidden p-6 md:p-8",
                    themeId === 'blueprint' ? "blueprint-panel" : "surface-subtle"
                )}>
                    {themeId !== 'blueprint' && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-[38%] hero-band opacity-95" />
                    )}
                    <div className="relative z-10 max-w-3xl space-y-4">
                        <span className={cn(
                            "kicker-label",
                            themeId === 'blueprint' && "border-dashed bg-background/10 text-muted-foreground"
                        )}>
                            {t('workspaceLabel', 'Bookmark Workspace')}
                        </span>
                        <div>
                            <h1 className={cn(
                                "font-display text-4xl font-normal tracking-[-0.04em] text-foreground md:text-5xl",
                                themeId === 'blueprint' && "font-mono uppercase tracking-[0.18em]"
                            )}>
                                {t('allBookmarks')}
                            </h1>
                            <p className={cn(
                                "mt-3 max-w-2xl text-base leading-7 text-muted-foreground",
                                themeId === 'blueprint' && "font-mono text-sm leading-6"
                            )}>
                                {t('workspaceLibraryDesc', 'Browse, search, and batch-manage the bookmarks in your current workspace.')}
                            </p>
                        </div>
                    </div>
                </div>
                <Bookmarks />
            </section>
        </div>
    )
}
