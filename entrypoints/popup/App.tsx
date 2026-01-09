import './App.css';
import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button.tsx";
import { useToast } from "@/hooks/use-toast";
import { browser } from "wxt/browser";
import {
    createChromeBookmark,
    validateBookmarkUrl,
    validateBookmarkTitle,
    getBookmarkFolderTree,
    BookmarkFolder,
    getBookmarkTitlesInFolder,
    getBookmarkFolders
} from "@/lib/bookmarkUtils";
import { Loader2, Check } from "lucide-react";
import { getRecentFolders, addRecentFolder, saveDomainMapping, getFolderForDomain } from "@/lib/recommendationStorage";
import { useTranslation } from 'react-i18next';
import { getAIConfig, AIConfig } from "@/lib/aiConfigUtils";
import { recommendFolderWithAI, renameBookmarkContextuallyWithAI, autoTagBookmark } from "@/lib/aiService";

// New Components
import { PopupLayout } from './components/PopupLayout';
// import { PopupHeader } from './components/PopupHeader'; // Removed
import { UrlPreviewCard } from './components/UrlPreviewCard';
import { SmartInput } from './components/SmartInput';
import { SmartTagInput } from './components/SmartTagInput';
import { SmartLocationSelector } from './components/SmartLocationSelector';

function App() {
    const { toast } = useToast();
    const { t, i18n } = useTranslation('popup');

    // Core Data
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [allFlatFolders, setAllFlatFolders] = useState<BookmarkFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState('1'); // Default: Bookmarks Bar
    const [tags, setTags] = useState<string[]>([]);

    // UI States
    const [isInitializing, setIsInitializing] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // AI & Smart Features States
    const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
    const [recentFolders, setRecentFolders] = useState<BookmarkFolder[]>([]);
    const [aiRecommendations, setAiRecommendations] = useState<Array<{ folderId: string; folderPath: string; reason?: string }>>([]);

    // Loading States
    const [isRenaming, setIsRenaming] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [isAutoTagging, setIsAutoTagging] = useState(false);

    // Automation Ref
    const hasRanAutomation = useRef(false);

    // Initialization & Automation Orchestrator
    useEffect(() => {
        const initializeAndAutomate = async () => {
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

                // 2. Load Folder Data
                const folderTree = await getBookmarkFolderTree();
                setFolders(folderTree.filter(f => f.id !== 'all'));

                const flatFolders = await getBookmarkFolders();
                setAllFlatFolders(flatFolders);

                // 3. Load AI Config
                const config = await getAIConfig();
                setAiConfig(config);

                // 4. Load Recents
                const recentIds = await getRecentFolders(3);
                const recents = recentIds.map(id => flatFolders.find(f => f.id === id)).filter((f): f is BookmarkFolder => !!f);
                setRecentFolders(recents);

                setIsInitializing(false);

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

    const runAIWorkflow = async (
        config: AIConfig,
        currentUrl: string,
        initialTitle: string,
        flatFolders: BookmarkFolder[]
    ) => {
        console.log('[AI Workflow] Starting...');

        // --- Step 1: Smart Location (Recommendation) ---
        let targetFolderId = '1'; // Default to Bookmarks Bar
        setIsRecommending(true);

        try {
            // A. Check Domain Rule first (Fastest)
            const boundFolderId = await getFolderForDomain(currentUrl);
            if (boundFolderId && flatFolders.some(f => f.id === boundFolderId)) {
                console.log('[AI Workflow] Matched Domain Rule');
                targetFolderId = boundFolderId;
                setSelectedFolder(targetFolderId);
            } else {
                // B. Ask AI for Recommendation
                console.log('[AI Workflow] Requesting Recommendation...');
                // Limited context for speed
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
                        setAiRecommendations(recResult.recommendations);
                        console.log('[AI Workflow] AI Recommended:', bestRec.folderPath);
                    }
                }
            }
        } catch (e) {
            console.error('[AI Workflow] Recommendation Step failed', e);
        } finally {
            setIsRecommending(false);
        }

        // --- Step 2: Contextual Rename ---
        let optimizedTitle = initialTitle;
        setIsRenaming(true);

        try {
            console.log('[AI Workflow] Renaming in context of folder:', targetFolderId);
            const otherTitles = await getBookmarkTitlesInFolder(targetFolderId);
            const targetFolderName = flatFolders.find(f => f.id === targetFolderId)?.title || 'Unknown';

            const renameResult = await renameBookmarkContextuallyWithAI(
                config, currentUrl, initialTitle, targetFolderName, otherTitles, i18n.language
            );

            if (renameResult.success && renameResult.newTitle) {
                optimizedTitle = renameResult.newTitle;
                setTitle(optimizedTitle);
                console.log('[AI Workflow] Renamed to:', optimizedTitle);
            }
        } catch (e) {
            console.error('[AI Workflow] Rename Step failed', e);
        } finally {
            setIsRenaming(false);
        }

        // --- Step 3: Auto Tagging ---
        setIsAutoTagging(true);
        try {
            console.log('[AI Workflow] Auto Tagging...');
            const tagResult = await autoTagBookmark(config, currentUrl, optimizedTitle, i18n.language);

            if (tagResult.success && tagResult.tags) {
                setTags(tagResult.tags);
                console.log('[AI Workflow] Tags generated:', tagResult.tags);
            }
        } catch (e) {
            console.error('[AI Workflow] Tagging Step failed', e);
        } finally {
            setIsAutoTagging(false);
        }
    };

    // --- Manual Actions (kept for user overrides) ---

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
                toast({ title: t('aiRenameSuccess', "Renamed by AI"), duration: 1500 });
            } else {
                toast({ title: t('aiRenameFailed'), description: result.error, variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRenaming(false);
        }
    };

    const handleAIRecommend = async () => {
        if (!aiConfig?.apiKey) return showConfigError();
        setIsRecommending(true);
        try {
            const folderList = allFlatFolders.filter(f => f.id !== 'all').map(f => `[ID: ${f.id}] ${f.path}`);
            const result = await recommendFolderWithAI(
                aiConfig, url, title, folderList, i18n.language
            );

            if (result.success && result.recommendations) {
                setAiRecommendations(result.recommendations);
                if (result.recommendations.length > 0) {
                    const bestId = result.recommendations[0].folderId;
                    if (allFlatFolders.some(f => f.id === bestId)) {
                        setSelectedFolder(bestId);
                        toast({ title: t('aiRecommendSuccess', "Folder suggested"), duration: 1500 });
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
                toast({ title: t('autoTagSuccess'), description: `Added ${result.tags.length} tags` });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAutoTagging(false);
        }
    };

    const handleSave = async () => {
        if (!validateBookmarkTitle(title) || !validateBookmarkUrl(url)) {
            toast({ title: t('validationError'), variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            await createChromeBookmark(title, url, selectedFolder);
            // Hybrid Learning
            Promise.all([
                saveDomainMapping(url, selectedFolder),
                addRecentFolder(selectedFolder)
            ]).catch(console.error);

            // Success & Close
            toast({ title: t('success'), description: t('bookmarkAdded') });
            setTimeout(() => window.close(), 600);
        } catch (error) {
            toast({ title: t('addFailed'), description: String(error), variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const showConfigError = () => {
        toast({
            title: "AI Not Configured",
            description: "Please set API Key in Options page.",
            variant: "destructive"
        });
    };

    if (isInitializing) {
        return (
            <PopupLayout>
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                    <p className="text-sm">Initializing Smart Manager...</p>
                </div>
            </PopupLayout>
        );
    }

    return (
        <PopupLayout>
            {/* Header Removed */}

            <UrlPreviewCard url={url} title={title} />

            <div className="space-y-2.5">
                <SmartInput
                    id="title"
                    label={t('title')}
                    value={title}
                    onChange={setTitle}
                    onAiRegenerate={handleAIRename}
                    isAiLoading={isRenaming}
                    autoFocus
                />

                <SmartLocationSelector
                    folders={folders}
                    recentFolders={recentFolders}
                    selectedFolder={selectedFolder}
                    onSelect={setSelectedFolder}
                    aiRecommendations={aiRecommendations}
                    onAiRecommend={handleAIRecommend}
                    isAiLoading={isRecommending}
                />

                <SmartTagInput
                    tags={tags}
                    onAddTag={(tag) => setTags([...tags, tag])}
                    onRemoveTag={(tag) => setTags(tags.filter(t => t !== tag))}
                    onAiGenerate={handleAutoTag}
                    isAiLoading={isAutoTagging}
                />
            </div>

            <div className="mt-auto pt-1.5">
                <Button
                    className="w-full h-8 rounded-full text-xs font-medium shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                    onClick={handleSave}
                    disabled={isCreating}
                >
                    {isCreating ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {t('addBookmark')}
                </Button>
            </div>
        </PopupLayout>
    );
}

export default App;
