import React, { useState, useEffect } from 'react';
import { BookmarkFolder } from "@/lib/bookmarkUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronLeft, Folder, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider.tsx";

interface DrillDownFolderSelectProps {
    folders: BookmarkFolder[]; // Tree structure
    selectedId: string;
    onSelect: (id: string) => void;
    className?: string;
    placeholder?: string;
}

export function DrillDownFolderSelect({
    folders,
    selectedId,
    onSelect,
    className,
    placeholder = "Select folder..."
}: DrillDownFolderSelectProps) {
    const { themeId } = useTheme();
    const [open, setOpen] = useState(false);
    // View state: which folder's children are we looking at?
    const [viewId, setViewId] = useState<string>('1');

    // Helper: Find node by ID in tree
    const findNode = (nodes: BookmarkFolder[], id: string): BookmarkFolder | null => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    // Helper: Find parent of a node
    const findParent = (nodes: BookmarkFolder[], targetId: string, parent: BookmarkFolder | null = null): BookmarkFolder | null => {
        for (const node of nodes) {
            if (node.id === targetId) return parent;
            if (node.children) {
                const found = findParent(node.children, targetId, node);
                if (found) return found;
            }
        }
        return null;
    };

    // Initialize view based on selectedId when opening
    useEffect(() => {
        if (open) {
            if (selectedId) {
                const parent = findParent(folders, selectedId);
                if (parent) {
                    setViewId(parent.id);
                } else {
                    setViewId(folders[0]?.id || '1');
                }
            } else {
                setViewId(folders[0]?.id || '1');
            }
        }
    }, [open, selectedId, folders]);

    const currentViewFolder = findNode(folders, viewId);
    const subfolders = currentViewFolder?.children?.filter(c => c.children !== undefined) || [];

    const selectedFolder = findNode(folders, selectedId);

    const handleSelect = (id: string) => {
        onSelect(id);
        setOpen(false);
    };

    const handleDrillDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setViewId(id);
    };

    const handleBack = () => {
        const parent = findParent(folders, viewId);
        if (parent) {
            setViewId(parent.id);
        }
    };

    const canGoBack = !!findParent(folders, viewId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between font-normal bg-secondary/40 hover:bg-secondary/60 text-foreground border-0 transition-all shadow-none",
                        themeId === 'blueprint' && "rounded-[var(--input-radius)] border border-border/60 bg-input/85 font-mono uppercase tracking-[0.08em] hover:bg-input",
                        className
                    )}
                >
                    <span className="truncate flex items-center gap-2">
                        {selectedFolder ? (
                            <>
                                <div className={cn(
                                    "p-1 rounded bg-primary/10 text-primary shrink-0",
                                    themeId === 'blueprint' && "rounded-[var(--badge-radius)] border border-primary/20"
                                )}>
                                    <Folder className="h-3.5 w-3.5" />
                                </div>
                                <span className="opacity-90">{selectedFolder.title}</span>
                            </>
                        ) : (
                            placeholder
                        )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn(
                "w-[300px] p-0 border-0 shadow-lg bg-popover rounded-xl overflow-hidden",
                themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border border-border/60 shadow-panel"
            )} align="start">
                {/* Header */}
                <div className={cn(
                    "flex items-center gap-2 p-2 bg-secondary/30 backdrop-blur-md border-b border-white/5",
                    themeId === 'blueprint' && "border-b border-border/40 bg-surface-2/80"
                )}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-7 w-7 shrink-0 rounded-full hover:bg-background/50",
                            themeId === 'blueprint' && "rounded-[var(--button-radius)] border border-transparent"
                        )}
                        onClick={handleBack}
                        disabled={!canGoBack}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className={cn(
                        "text-xs font-semibold truncate flex-1 text-center text-foreground/90",
                        themeId === 'blueprint' && "font-mono uppercase tracking-[0.14em]"
                    )}>
                        {currentViewFolder?.title || "Folders"}
                    </span>
                    <div className="w-7 text-center">
                        <Folder className="h-4 w-4 mx-auto opacity-30" />
                    </div>
                </div>

                {/* List */}
                <ScrollArea className={cn("h-[200px] bg-background", themeId === 'blueprint' && "bg-background/85")}>
                    <div className="p-1.5 space-y-0.5">
                        {subfolders.map((folder) => {
                            const isSelected = folder.id === selectedId;
                            const hasChildren = folder.children && folder.children.length > 0;

                            return (
                                <div
                                    key={folder.id}
                                    className={cn(
                                        "flex items-center w-full rounded-lg px-2.5 py-2 text-sm outline-none transition-all cursor-pointer group select-none",
                                        themeId === 'blueprint' && "rounded-[var(--button-radius)] border border-transparent font-mono",
                                        isSelected
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-secondary/50 text-foreground/80"
                                    )}
                                    onClick={() => handleSelect(folder.id)}
                                >
                                    {/* Icon */}
                                    <Folder className={cn(
                                        "mr-2.5 h-4 w-4 shrink-0 transition-colors",
                                        isSelected ? "text-primary fill-primary/20" : "text-muted-foreground group-hover:text-primary/70"
                                    )} />

                                    <span className="flex-1 truncate">
                                        {folder.title}
                                    </span>

                                    {/* Drill Down Button */}
                                    {hasChildren && (
                                        <div
                                            role="button"
                                            className={cn(
                                                "ml-auto p-1 rounded-md transition-colors",
                                                themeId === 'blueprint' && "rounded-[var(--badge-radius)]",
                                                isSelected ? "hover:bg-primary/20 text-primary" : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                            )}
                                            onClick={(e) => handleDrillDown(e, folder.id)}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </div>
                                    )}
                                    {!hasChildren && isSelected && (
                                        <Check className="ml-auto h-4 w-4 text-primary" />
                                    )}
                                </div>
                            );
                        })}

                        {subfolders.length === 0 && (
                            <div className="py-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <Folder className="h-8 w-8 opacity-20" />
                                <span className="text-xs">Empty Folder</span>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
