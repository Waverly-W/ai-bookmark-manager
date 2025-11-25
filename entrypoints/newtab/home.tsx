// HomePage.js
import React from "react";
import { Bookmarks } from "@/entrypoints/newtab/bookmarks.tsx";

export function Home() {
    return (
        <div className="container mx-auto p-6 md:p-8 max-w-7xl space-y-6">
            {/* 书签区域 */}
            <Bookmarks />
        </div>
    )
}
