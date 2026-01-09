import React from 'react';
import { Sparkles, Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import { browser } from "wxt/browser";

export function PopupHeader() {
    const { t } = useTranslation('popup');

    const openOptionsPage = () => {
        browser.runtime.openOptionsPage();
    };

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/10 shadow-sm">
                    <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                    <h1 className="text-sm font-semibold tracking-tight text-foreground/90">
                        AI Bookmark
                    </h1>
                    <p className="text-[10px] text-muted-foreground font-medium">
                        Smart Manager
                    </p>
                </div>
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/50 rounded-full transition-colors"
                onClick={openOptionsPage}
            >
                <Settings className="w-4 h-4" />
            </Button>
        </div>
    );
}
