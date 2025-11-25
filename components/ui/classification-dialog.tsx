import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassificationResult {
    bookmarkId: string;
    bookmarkTitle: string;
    bookmarkUrl: string;
    suggestedFolderId: string;
    reason?: string;
    confidence: number;
}

interface FolderOption {
    id: string;
    title: string;
    path: string;
}

interface ClassificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    results: ClassificationResult[];
    folders: FolderOption[];
    onApply: (selectedResults: ClassificationResult[]) => void;
    isApplying: boolean;
}

export const ClassificationDialog: React.FC<ClassificationDialogProps> = ({
    open,
    onOpenChange,
    results,
    folders,
    onApply,
    isApplying
}) => {
    const { t } = useTranslation();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editedResults, setEditedResults] = useState<ClassificationResult[]>([]);

    useEffect(() => {
        if (open && results.length > 0) {
            // Initialize edited results with props
            setEditedResults([...results]);
            // Default select all high confidence results (> 0.6)
            const initialSelected = new Set(
                results
                    .filter(r => r.confidence > 0.6 && r.suggestedFolderId !== '0')
                    .map(r => r.bookmarkId)
            );
            setSelectedIds(initialSelected);
        }
    }, [open, results]);

    const handleSelectAll = () => {
        if (selectedIds.size === editedResults.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(editedResults.map(r => r.bookmarkId)));
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const handleFolderChange = (bookmarkId: string, newFolderId: string) => {
        setEditedResults(prev => prev.map(item =>
            item.bookmarkId === bookmarkId
                ? { ...item, suggestedFolderId: newFolderId }
                : item
        ));
        // Auto-select when manually changed
        const newSelected = new Set(selectedIds);
        newSelected.add(bookmarkId);
        setSelectedIds(newSelected);
    };

    const handleApply = () => {
        const finalResults = editedResults.filter(r => selectedIds.has(r.bookmarkId));
        onApply(finalResults);
    };

    const getFolderLabel = (folderId: string) => {
        if (folderId === '0') return t('bookmarkRootFolder');
        const folder = folders.find(f => f.id === folderId);
        return folder ? folder.path : folderId;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('aiBatchClassification')}</DialogTitle>
                    <DialogDescription>
                        {t('aiBatchClassificationDesc', { count: results.length })}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            checked={selectedIds.size === editedResults.length && editedResults.length > 0}
                            onCheckedChange={handleSelectAll}
                        />
                        <span className="text-sm text-muted-foreground">
                            {t('selectedCount', { count: selectedIds.size })}
                        </span>
                    </div>
                </div>

                <ScrollArea className="flex-1 min-h-[300px]">
                    <div className="space-y-2 p-1">
                        {editedResults.map((item) => (
                            <div
                                key={item.bookmarkId}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                    selectedIds.has(item.bookmarkId) ? "bg-accent/50 border-accent" : "bg-card hover:bg-accent/10"
                                )}
                            >
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <Checkbox
                                        checked={selectedIds.has(item.bookmarkId)}
                                        onCheckedChange={(checked) => handleSelectOne(item.bookmarkId, checked as boolean)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <span className="font-medium truncate" title={item.bookmarkTitle}>
                                                {item.bookmarkTitle}
                                            </span>
                                            <a href={item.bookmarkUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline truncate max-w-[200px]">
                                                {item.bookmarkUrl}
                                            </a>
                                        </div>
                                        {item.reason && (
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center">
                                                <Badge variant="outline" className="mr-2 text-[10px] h-4 px-1">
                                                    {(item.confidence * 100).toFixed(0)}%
                                                </Badge>
                                                {item.reason}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 ml-4">
                                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                    <div className="w-[200px]">
                                        <Select
                                            value={item.suggestedFolderId}
                                            onValueChange={(val) => handleFolderChange(item.bookmarkId, val)}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue>
                                                    <div className="flex items-center">
                                                        <Folder className="w-3 h-3 mr-2" />
                                                        <span className="truncate">{getFolderLabel(item.suggestedFolderId)}</span>
                                                    </div>
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0">{t('bookmarkRootFolder')}</SelectItem>
                                                {folders.map(f => (
                                                    <SelectItem key={f.id} value={f.id}>
                                                        {f.path}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('cancel')}
                    </Button>
                    <Button onClick={handleApply} disabled={isApplying || selectedIds.size === 0}>
                        {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('applySelected')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
