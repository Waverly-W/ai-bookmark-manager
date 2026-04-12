import React from "react";
import { Bookmarks } from "@/entrypoints/newtab/bookmarks.tsx";

interface HomeProps {
    onNavigate?: unknown;
}

export function Home({ onNavigate: _onNavigate }: HomeProps) {
    return (
        <div className="container mx-auto max-w-[1600px] p-6 md:p-8">
            <Bookmarks />
        </div>
    )
}
