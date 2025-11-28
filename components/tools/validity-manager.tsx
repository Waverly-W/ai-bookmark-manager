import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { scanBookmarkValidity, ValidityResult, updateChromeBookmark, deleteChromeBookmark, filterBookmarksByFolder } from '@/lib/bookmarkUtils';
import { BookmarkNode } from '@/entrypoints/types';
import { Loader2, AlertTriangle, ArrowLeft, Trash2, ExternalLink, CheckCircle, XCircle, Edit, StopCircle } from 'lucide-react';
import { CascadingFolderSelect } from '@/components/ui/cascading-folder-select';

interface ValidityManagerProps {
    bookmarks: BookmarkNode[];
    onRefresh: () => void;
    onBack: () => void;
}

export const ValidityManager: React.FC<ValidityManagerProps> = ({ bookmarks, onRefresh, onBack }) => {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [isScanning, setIsScanning] = useState(false);
    const [invalidBookmarks, setInvalidBookmarks] = useState<ValidityResult[]>([]);
    const [scanned, setScanned] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editUrl, setEditUrl] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<string>('all');

    // Progress state
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const handleScan = async () => {
        setIsScanning(true);
        setScanned(false);
        setInvalidBookmarks([]);
        setProgress(0);
        setLogs([]);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const targetBookmarks = filterBookmarksByFolder(bookmarks, selectedFolderId);
            const results = await scanBookmarkValidity(
                targetBookmarks,
                (current, total, url, result) => {
                    const percentage = Math.round((current / total) * 100);
                    setProgress(percentage);

                    if (result) {
                        setLogs(prev => [...prev, `[${t('invalid')}] ${url}`]);
                    } else {
                        // Optional: Log every checked URL or just significant events
                        // setLogs(prev => [...prev, `[OK] ${url}`]);
                        // To avoid too many logs, maybe just show current checking in a separate text
                    }
                },
                controller.signal
            );

            if (!controller.signal.aborted) {
                setInvalidBookmarks(results);
                setScanned(true);

                if (results.length > 0) {
                    toast({
                        title: t('scanComplete'),
                        description: t('invalidBookmarksFound', { count: results.length }),
                    });
                } else {
                    toast({
                        title: t('scanComplete'),
                        description: t('noInvalidBookmarksFound'),
                    });
                }
            }
        } catch (error) {
            console.error('Scan failed:', error);
            toast({
                title: t('error'),
                description: t('scanFailed', 'Failed to scan bookmarks.'),
                variant: "destructive"
            });
        } finally {
            setIsScanning(false);
            abortControllerRef.current = null;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLogs(prev => [...prev, t('stopping')]);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteChromeBookmark(id);
            setInvalidBookmarks(prev => prev.filter(b => b.id !== id));
            onRefresh();
            toast({
                title: t('bookmarkDeleted'),
            });
        } catch (error) {
            console.error('Delete failed:', error);
            toast({
                title: t('error'),
                description: t('deleteBookmarkFailed'),
                variant: "destructive"
            });
        }
    };

    const startEdit = (bookmark: ValidityResult) => {
        setEditingId(bookmark.id);
        setEditUrl(bookmark.url);
    };

    const saveEdit = async (id: string, title: string) => {
        try {
            await updateChromeBookmark(id, title, editUrl);
            setInvalidBookmarks(prev => prev.filter(b => b.id !== id)); // Remove from invalid list assuming fixed
            setEditingId(null);
            onRefresh();
            toast({
                title: t('bookmarkUpdatedSuccess'),
            });
        } catch (error) {
            console.error('Update failed:', error);
            toast({
                title: t('error'),
                description: t('saveFailed'),
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t('validityManager')}</h2>
                    <p className="text-muted-foreground">
                        {t('validityManagerDesc')}
                    </p>
                </div>
            </div>

            {isScanning ? (
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>{t('scanProgress')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>{progress}%</span>
                                <span className="text-muted-foreground">{isScanning ? t('scanning') : t('scanComplete')}</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>

                        <div className="border rounded-md bg-muted/50 p-4 font-mono text-xs h-48 overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto space-y-1">
                                {logs.map((log, i) => (
                                    <div key={i} className="text-muted-foreground">{log}</div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <Button variant="destructive" onClick={handleStop}>
                                <StopCircle className="mr-2 h-4 w-4" />
                                {t('stop')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : !scanned ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/10 mt-8">
                    <div className="mb-4 p-4 bg-primary/10 rounded-full">
                        <AlertTriangle className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t('startValidityScan')}</h3>
                    <p className="text-muted-foreground text-center max-w-md mb-6">
                        {t('validityScanDesc')}
                    </p>

                    <div className="w-full max-w-md space-y-4 mb-6">
                        <div className="space-y-2">
                            <Label>{t('scanScope')}</Label>
                            <CascadingFolderSelect
                                folders={bookmarks.map(b => ({
                                    ...b,
                                    path: b.title, // Simple path for now, ideally should be full path
                                    level: 0,
                                    children: b.children?.map(c => ({ ...c, path: c.title, level: 1 })) // Shallow mapping, might need deep recursive mapping if component requires it
                                })) as any} // Temporary cast to bypass strict type check if structures are compatible enough
                                selectedId={selectedFolderId}
                                onSelect={setSelectedFolderId}
                                placeholder={t('allFolders')}
                            />
                        </div>
                    </div>

                    <Button onClick={handleScan} size="lg">
                        {t('startScan')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">
                            {invalidBookmarks.length > 0
                                ? t('invalidBookmarksFound', { count: invalidBookmarks.length })
                                : t('noInvalidBookmarksFound')}
                        </h3>
                        <Button variant="outline" onClick={handleScan}>
                            {t('rescan')}
                        </Button>
                    </div>

                    {invalidBookmarks.length > 0 && (
                        <div className="space-y-4">
                            {invalidBookmarks.map((bookmark) => (
                                <Card key={bookmark.id} className="overflow-hidden">
                                    <CardContent className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium truncate">{bookmark.title}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${bookmark.status === 'timeout' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {t(bookmark.status)}
                                                </span>
                                            </div>
                                            {editingId === bookmark.id ? (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Input
                                                        value={editUrl}
                                                        onChange={(e) => setEditUrl(e.target.value)}
                                                        className="h-8 text-sm"
                                                    />
                                                    <Button size="sm" onClick={() => saveEdit(bookmark.id, bookmark.title)}>
                                                        {t('save')}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                                        {t('cancel')}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground truncate font-mono">
                                                    {bookmark.url}
                                                </p>
                                            )}
                                            {bookmark.error && (
                                                <p className="text-xs text-red-500">{bookmark.error}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => startEdit(bookmark)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(bookmark.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
