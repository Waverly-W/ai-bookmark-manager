import { BookmarkFolder } from "@/lib/bookmarkUtils";
import { DrillDownFolderSelect } from "@/components/ui/drill-down-folder-select";
import { Label } from "@/components/ui/label";
import { Folder as FolderIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SmartLocationSelectorProps {
    folders: BookmarkFolder[]; // Tree for cascading
    recentFolders: BookmarkFolder[]; // Flat list for chips
    selectedFolder: string;
    onSelect: (id: string) => void;
    aiRecommendations?: Array<{ folderId: string; folderPath: string; reason?: string }>;
    onAiRecommend?: () => void;
    isAiLoading?: boolean;
}

export function SmartLocationSelector({
    folders,
    recentFolders,
    selectedFolder,
    onSelect,
    aiRecommendations = [],
    onAiRecommend,
    isAiLoading
}: SmartLocationSelectorProps) {

    // Combine recent and AI folders for "Smart Chips", removing duplicates
    // Priority: AI Recommendations -> Recent

    // Construct Path
    // We need flat folders to do this efficiently, but we only have `folders` (tree) and `recentFolders` (flat-ish).
    // Actually, `recentFolders` is passed from App which DOES have `allFlatFolders`.
    // However, SmartLocationSelector doesn't have `allFlatFolders` prop currently.
    // Optimization: Just traverse the tree to find path? Or modify props?
    // Let's modify props to accept `allFlatFolders` or just a `selectedPath` string if passed from parent.
    // Given the constraints, I'll modify App to pass `allFlatFolders` OR I will just traverse `folders` here.
    // Tree traversal for one path is cheap.

    const getPath = (nodes: BookmarkFolder[], id: string, currentPath: string[] = []): string | null => {
        for (const node of nodes) {
            if (node.id === id) {
                return [...currentPath, node.title].join(' / ');
            }
            if (node.children) {
                const found = getPath(node.children, id, [...currentPath, node.title]);
                if (found) return found;
            }
        }
        return null;
    };

    const selectedPath = getPath(folders, selectedFolder) || "Unknown";

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
                <Label className="text-xs font-medium text-muted-foreground/90">
                    Location
                </Label>
                {onAiRecommend && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAiRecommend}
                        disabled={isAiLoading}
                        className="h-5 px-1.5 text-[10px] text-primary/80 hover:text-primary hover:bg-primary/10 -mr-1.5 gap-1 rounded-full"
                    >
                        <Sparkles className={`w-3 h-3 ${isAiLoading ? 'animate-spin' : ''}`} />
                        <span className="font-medium">AI Suggest</span>
                    </Button>
                )}
            </div>

            {/* Smart Chips Area (Assist Chips) */}
            {(recentFolders.length > 0 || aiRecommendations.length > 0) && (
                <div className="flex flex-wrap gap-2 px-0.5 mb-1">
                    {/* Display AI Recommendations first if any */}
                    {aiRecommendations.slice(0, 2).map((rec, idx) => (
                        <button
                            key={`ai-${idx}`}
                            onClick={() => onSelect(rec.folderId)}
                            className={`
                                flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium border transition-all duration-200
                                ${selectedFolder === rec.folderId
                                    ? 'bg-primary/10 border-primary/20 text-primary shadow-sm ring-1 ring-primary/20'
                                    : 'bg-background border-border/40 text-foreground/80 hover:bg-secondary/50 hover:border-border/60'
                                }
                            `}
                            title={rec.reason || rec.folderPath}
                        >
                            <Sparkles className="w-3 h-3 opacity-70" />
                            <span className="max-w-[100px] truncate">{rec.folderPath.split('/').pop()}</span>
                        </button>
                    ))}

                    {/* Recent Folders */}
                    {recentFolders.map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => onSelect(folder.id)}
                            className={`
                                flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium border transition-all duration-200
                                ${selectedFolder === folder.id
                                    ? 'bg-secondary border-transparent text-foreground shadow-sm'
                                    : 'bg-transparent border-border/40 text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:border-border/60'
                                }
                            `}
                            title={folder.path}
                        >
                            <FolderIcon className="w-3 h-3 opacity-70" />
                            <span className="max-w-[100px] truncate">{folder.title}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Manual Selector */}
            <DrillDownFolderSelect
                folders={folders}
                selectedId={selectedFolder}
                onSelect={onSelect}
                placeholder="Select folder..."
                className="w-full bg-secondary/40 border-transparent hover:bg-secondary/60 focus:ring-2 focus:ring-primary/30 h-9 rounded-lg transition-all text-sm shadow-none justify-between px-3 font-normal"
            />

            {/* Path Display */}
            {selectedPath && (
                <div className="px-1 py-0.5 flex items-center gap-1.5 opacity-70">
                    <div className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                    <p className="text-[10px] text-muted-foreground truncate font-sans tracking-tight">
                        {selectedPath}
                    </p>
                </div>
            )}
        </div>
    );
}
