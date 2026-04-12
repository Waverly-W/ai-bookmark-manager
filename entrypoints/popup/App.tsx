import './App.css';
import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button.tsx";
import { useToast } from "@/hooks/use-toast";
import { browser } from "wxt/browser";
import {
    createChromeBookmark,
    validateBookmarkUrl,
    validateBookmarkTitle,
    BookmarkFolder,
    getBookmarkTitlesInFolder,
    getBookmarkFolderData
} from "@/lib/bookmarkUtils";
import { Loader2, Check } from "lucide-react";
import { addRecentFolder, saveDomainMapping, getFolderForDomain } from "@/lib/recommendationStorage";
import { useTranslation } from 'react-i18next';
import { getAIConfig, AIConfig } from "@/lib/aiConfigUtils";
import { recommendFolderWithAI, renameBookmarkContextuallyWithAI, autoTagBookmark } from "@/lib/aiService";
import { getAllTags, saveTagsForBookmark } from "@/lib/tagStorage";

// New Components
import { PopupLayout } from './components/PopupLayout';
import { SmartInput } from './components/SmartInput';
import { SmartTagInput } from './components/SmartTagInput';
import { SmartLocationSelector } from './components/SmartLocationSelector';
import { useTheme } from "@/components/theme-provider.tsx";
import { cn } from "@/lib/utils";

function App() {
    const { toast } = useToast();
    const { t, i18n } = useTranslation('popup');
    const { themeId } = useTheme();

    // Core Data
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [allFlatFolders, setAllFlatFolders] = useState<BookmarkFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('1'); // Default: Bookmarks Bar
    const [tags, setTags] = useState<string[]>([]);
    const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

    // UI States
    const [isInitializing, setIsInitializing] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // AI & Smart Features States
    const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);

    // Loading States
    const [isRenaming, setIsRenaming] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [isAutoTagging, setIsAutoTagging] = useState(false);

    // Automation Ref
    const hasRanAutomation = useRef(false);

    const logPopupTiming = (label: string, startTime: number, extra?: Record<string, unknown>) => {
        const elapsedMs = Math.round(performance.now() - startTime);
        console.log(`[Popup] ${label} completed in ${elapsedMs}ms`, extra || {});
    };

    // Initialization & Automation Orchestrator
    useEffect(() => {
        const initializeAndAutomate = async () => {
            const initStart = performance.now();
            try {
                // 1. Get Current Tab
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                let currentUrl = '';
                let currentTitle = '';

                if (tabs && tabs.length > 0 && tabs[0].url && tabs[0].title) {
                    currentUrl = tabs[0].url;
                    currentTitle = tabs[0].title;
                    setUrl(tabs[0].url);
                    setTitle(tabs[0].title);
                } else {
                    // If no valid tab, stop
                    setIsInitializing(false);
                    return;
                }

                // 2. Load Data
                const dataLoadStart = performance.now();
                const [
                    folderData,
                    config,
                    knownTags
                ] = await Promise.all([
                    getBookmarkFolderData(),
                    getAIConfig(),
                    getAllTags()
                ]);
                logPopupTiming('initial data load', dataLoadStart, {
                    folderCount: folderData.flat.length,
                    tagCount: knownTags.length
                });

                const folderTree = folderData.tree;
                setFolders(folderTree.filter(f => f.id !== 'all'));
                const flatFolders = folderData.flat;
                setAllFlatFolders(flatFolders);
                setAiConfig(config);
                setSuggestedTags(knownTags);

                setIsInitializing(false);
                logPopupTiming('popup initialization', initStart);

                // --- AI Automation Workflow ---
                if (config && config.apiKey && !hasRanAutomation.current) {
                    hasRanAutomation.current = true;
                    runAIWorkflow(config, currentUrl, currentTitle, flatFolders);
                }

            } catch (error) {
                console.error('Popup init failed:', error);
                setIsInitializing(false);
            }
        };

        initializeAndAutomate();
    }, []);

    const handleAIRename = async () => {
        if (!aiConfig?.apiKey) return showConfigError();
        setIsRenaming(true);
        try {
            const otherTitles = await getBookmarkTitlesInFolder(selectedFolder);
            const currentFolderName = allFlatFolders.find(f => f.id === selectedFolder)?.title || 'Unknown';

            const result = await renameBookmarkContextuallyWithAI(
                aiConfig, url, title, currentFolderName, otherTitles, i18n.language
            );

            if (result.success && result.newTitle) {
                setTitle(result.newTitle);
                toast({ title: t('aiRenameSuccess'), duration: 1500 });
            } else {
                toast({ title: t('aiRenameFailed'), description: result.error, variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRenaming(false);
        }
    };

    const runAIWorkflow = async (
        config: AIConfig,
        currentUrl: string,
        initialTitle: string,
        flatFolders: BookmarkFolder[]
    ) => {
        const workflowStart = performance.now();
        // 自动选文件夹
        let targetFolderId = '1'; // Default to Bookmarks Bar
        setIsRecommending(true);

        try {
            const recommendationStart = performance.now();
            const boundFolderId = await getFolderForDomain(currentUrl);
            if (boundFolderId && flatFolders.some(f => f.id === boundFolderId)) {
                targetFolderId = boundFolderId;
                setSelectedFolder(targetFolderId);
            } else {
                const folderList = flatFolders
                    .filter(f => f.id !== 'all')
                    .map(f => `[ID: ${f.id}] ${f.path}`);

                const recResult = await recommendFolderWithAI(
                    config, currentUrl, initialTitle, folderList, i18n.language
                );

                if (recResult.success && recResult.recommendations && recResult.recommendations.length > 0) {
                    const bestRec = recResult.recommendations[0];
                    if (flatFolders.some(f => f.id === bestRec.folderId)) {
                        targetFolderId = bestRec.folderId;
                        setSelectedFolder(targetFolderId);
                    }
                }
            }
            logPopupTiming('folder recommendation workflow', recommendationStart, {
                targetFolderId
            });
        } catch (e) {
            console.error('[AI Workflow] Recommendation failed', e);
        } finally {
            setIsRecommending(false);
        }

        const targetFolderName = flatFolders.find(f => f.id === targetFolderId)?.title || 'Unknown';
        const renameStart = performance.now();
        const tagStart = performance.now();
        setIsRenaming(true);
        setIsAutoTagging(true);
        const otherTitlesPromise = getBookmarkTitlesInFolder(targetFolderId);

        const renamePromise = (async () => {
            try {
                const otherTitles = await otherTitlesPromise;
                const renameResult = await renameBookmarkContextuallyWithAI(
                    config, currentUrl, initialTitle, targetFolderName, otherTitles, i18n.language
                );

                if (renameResult.success && renameResult.newTitle) {
                    setTitle(renameResult.newTitle);
                }
                logPopupTiming('contextual rename workflow', renameStart, {
                    siblingTitleCount: otherTitles.length,
                    targetFolderId
                });
            } catch (e) {
                console.error('[AI Workflow] Rename failed', e);
            } finally {
                setIsRenaming(false);
            }
        })();

        const tagPromise = (async () => {
            try {
                const tagResult = await autoTagBookmark(config, currentUrl, initialTitle, i18n.language);

                if (tagResult.success && tagResult.tags) {
                    setTags(tagResult.tags);
                    setSuggestedTags((prev) => [...new Set([...prev, ...tagResult.tags!])]);
                }
                logPopupTiming('auto tagging workflow', tagStart, {
                    targetFolderId
                });
            } catch (e) {
                console.error('[AI Workflow] Tagging failed', e);
            } finally {
                setIsAutoTagging(false);
            }
        })();

        await Promise.allSettled([renamePromise, tagPromise]);
        logPopupTiming('full AI workflow', workflowStart, {
            targetFolderId
        });
    };

    const handleAIRecommend = async () => {
        if (!aiConfig?.apiKey) return showConfigError();
        setIsRecommending(true);
        try {
            const folderList = allFlatFolders.filter(f => f.id !== 'all').map(f => `[ID: ${f.id}] ${f.path}`);
            const result = await recommendFolderWithAI(
                aiConfig,
                url,
                title,
                folderList,
                i18n.language,
                { forceRemote: true }
            );

            if (result.success && result.recommendations) {
                if (result.recommendations.length > 0) {
                    const bestId = result.recommendations[0].folderId;
                    if (allFlatFolders.some(f => f.id === bestId)) {
                        setSelectedFolder(bestId);
                        toast({ title: t('aiRecommendSuccess'), duration: 1500 });
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRecommending(false);
        }
    };

    const handleAutoTag = async () => {
        if (!aiConfig?.apiKey) return showConfigError();
        setIsAutoTagging(true);
        try {
            const result = await autoTagBookmark(aiConfig, url, title, i18n.language);
            if (result.success && result.tags) {
                const uniqueTags = [...new Set([...tags, ...result.tags])];
                setTags(uniqueTags);
                setSuggestedTags((prev) => [...new Set([...prev, ...result.tags!])]);
                toast({ title: t('autoTagSuccess'), description: t('autoTagSuccessDesc', { count: result.tags.length }) });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAutoTagging(false);
        }
    };

    const shouldAutoClosePopup = async () => {
        try {
            // If popup is opened as a standalone tab (debug scenario), getCurrent returns a Tab.
            // In action popup context, it returns undefined.
            const currentExtensionTab = await browser.tabs.getCurrent();
            return !currentExtensionTab;
        } catch {
            // Keep current UX as fallback when context detection fails.
            return true;
        }
    };

    const showSaveSuccessToast = (savedTitle: string, folderId: string, autoClose: boolean) => {
        const savedFolder = allFlatFolders.find((folder) => folder.id === folderId);
        const folderName = savedFolder?.title || t('location');
        const folderPath = savedFolder?.path || folderName;
        const displayTitle = savedTitle.trim() || url;

        toast({
            duration: autoClose ? 1200 : 2200,
            className: cn(
                "border-primary/20 bg-gradient-to-br from-primary/12 via-card to-card shadow-panel",
                themeId === 'blueprint' && "rounded-[var(--card-radius)] border-dashed bg-card"
            ),
            title: (
                <span className="flex items-center gap-2 text-primary">
                    <span className={cn(
                        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15",
                        themeId === 'blueprint' && "rounded-[var(--badge-radius)] border border-primary/30"
                    )}>
                        <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className={cn("tracking-tight", themeId === 'blueprint' && "font-mono uppercase tracking-[0.16em]")}>{t('success')}</span>
                </span>
            ),
            description: (
                <div className="space-y-1 text-xs">
                    <p className="text-foreground/80">
                        {t('bookmarkAdded', { folderName })}
                    </p>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                        <span className="max-w-[170px] truncate">{displayTitle}</span>
                        <span className="opacity-60">-&gt;</span>
                        <span className="max-w-[120px] truncate text-primary/85">
                            {folderPath}
                        </span>
                    </p>
                </div>
            )
        });
    };

    const handleSave = async () => {
        if (!validateBookmarkTitle(title) || !validateBookmarkUrl(url)) {
            toast({ title: t('validationError'), variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const bookmark = await createChromeBookmark(title, url, selectedFolder);
            await saveTagsForBookmark(bookmark.id, tags);
            // Hybrid Learning
            Promise.all([
                saveDomainMapping(url, selectedFolder),
                addRecentFolder(selectedFolder)
            ]).catch(console.error);

            // Success & Close
            const autoClose = await shouldAutoClosePopup();
            showSaveSuccessToast(title, selectedFolder, autoClose);
            if (autoClose) {
                setTimeout(() => window.close(), 950);
            }
        } catch (error) {
            toast({ title: t('addFailed'), description: String(error), variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const showConfigError = () => {
        toast({
            title: t('aiNotConfigured'),
            description: t('pleaseConfigureAI'),
            variant: "destructive"
        });
    };

    if (isInitializing) {
        return (
            <PopupLayout>
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center text-muted-foreground">
                    <div className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-full border border-primary/15 bg-primary/10",
                        themeId === 'blueprint' && "rounded-[var(--card-radius)] border-primary/35"
                    )}>
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                    <p className={cn(
                        "font-display text-base font-semibold text-foreground",
                        themeId === 'blueprint' && "font-mono uppercase tracking-[0.16em]"
                    )}>{t('initializing')}</p>
                </div>
            </PopupLayout>
        );
    }

    return (
        <PopupLayout>
            <h1 className={cn(
                "font-display text-lg font-semibold tracking-tight text-foreground",
                themeId === 'blueprint' && "font-mono uppercase tracking-[0.16em]"
            )}>
                {t('saveToLibrary')}
            </h1>
            <div className="space-y-3">
                <section className={cn(
                    "rounded-[1.25rem] border border-border/70 bg-background/80 p-3.5 shadow-sm",
                    themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed bg-background/72"
                )}>
                    <SmartInput
                        id="title"
                        label={t('title')}
                        value={title}
                        onChange={setTitle}
                        onAiRegenerate={handleAIRename}
                        isAiLoading={isRenaming}
                        autoFocus
                    />
                </section>

                <section className={cn(
                    "rounded-[1.25rem] border border-border/70 bg-background/80 p-3.5 shadow-sm",
                    themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed bg-background/72"
                )}>
                    <SmartLocationSelector
                        folders={folders}
                        selectedFolder={selectedFolder}
                        onSelect={setSelectedFolder}
                        onAiRecommend={handleAIRecommend}
                        isAiLoading={isRecommending}
                    />
                </section>

                <section className={cn(
                    "rounded-[1.25rem] border border-border/70 bg-background/80 p-3.5 shadow-sm",
                    themeId === 'blueprint' && "blueprint-panel rounded-[var(--card-radius)] border-dashed bg-background/72"
                )}>
                    <SmartTagInput
                        tags={tags}
                        onAddTag={(tag) => setTags([...tags, tag])}
                        onRemoveTag={(tag) => setTags(tags.filter(t => t !== tag))}
                        suggestedTags={suggestedTags}
                        onAiGenerate={handleAutoTag}
                        isAiLoading={isAutoTagging}
                    />
                </section>
            </div>

            <Button
                className={cn(
                    "mt-auto h-11 w-full rounded-full text-sm font-semibold shadow-md",
                    themeId === 'blueprint' && "rounded-[var(--button-radius)] border border-primary/35 font-mono uppercase tracking-[0.14em] shadow-sm"
                )}
                onClick={handleSave}
                disabled={isCreating}
            >
                {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Check className="mr-2 h-4 w-4" />
                )}
                {t('addBookmark')}
            </Button>
        </PopupLayout>
    );
}

export default App;
