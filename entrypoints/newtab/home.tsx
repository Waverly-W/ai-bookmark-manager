import React from "react";
import { Bookmarks } from "@/entrypoints/newtab/bookmarks.tsx";
import { useTranslation } from "react-i18next";

interface HomeProps {
    onNavigate?: unknown;
}

export function Home({ onNavigate: _onNavigate }: HomeProps) {
    const { t } = useTranslation('common');

    return (
        <div className="container mx-auto max-w-[1600px] p-6 md:p-8">
            <section className="space-y-4">
                <div>
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                        {t('allBookmarks')}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {t('workspaceLibraryDesc', 'Browse, search, and batch-manage the bookmarks in your current workspace.')}
                    </p>
                </div>
                <Bookmarks />
            </section>
        </div>
    )
}
