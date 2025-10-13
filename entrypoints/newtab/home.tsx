// HomePage.js
import React from "react";
import {Bookmarks} from "@/entrypoints/newtab/bookmarks.tsx";

export function Home() {
    return (
        <div className="space-y-6">
            {/* 书签区域 */}
            <Bookmarks />
        </div>
    )
}
