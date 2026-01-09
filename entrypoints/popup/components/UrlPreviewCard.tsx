import React from 'react';
import { Globe, Link as LinkIcon, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface UrlPreviewCardProps {
    url: string;
    title?: string;
}

export function UrlPreviewCard({ url, title }: UrlPreviewCardProps) {
    const { toast } = useToast();

    // Extract domain for display
    let domain = 'unknown';
    try {
        const u = new URL(url);
        domain = u.hostname.replace('www.', '');
    } catch (e) { }

    const copyUrl = () => {
        navigator.clipboard.writeText(url);
        toast({
            description: "URL Copied to clipboard",
            duration: 1500,
        });
    };

    return (
        <div className="group relative flex items-center gap-2.5 p-2 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/20 hover:bg-secondary/50 transition-all duration-300">
            {/* Favicon or Default Icon */}
            <div className="h-8 w-8 shrink-0 rounded-md bg-background flex items-center justify-center shadow-sm border border-border/20 overflow-hidden">
                <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                    alt="Favicon"
                    className="w-5 h-5 object-contain opacity-90"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                />
                <div className="hidden w-full h-full flex items-center justify-center bg-secondary/20">
                    <Globe className="w-4 h-4 text-muted-foreground/50" />
                </div>
            </div>

            {/* URL Info */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground/80 truncate">
                    {domain}
                </span>
                <span className="text-[10px] text-muted-foreground/60 truncate font-mono">
                    {url}
                </span>
            </div>

            {/* Actions */}
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 rounded-md opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100"
                onClick={copyUrl}
            >
                <Copy className="w-3 h-3" />
            </Button>
        </div>
    );
}
