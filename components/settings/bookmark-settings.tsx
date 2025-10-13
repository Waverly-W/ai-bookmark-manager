import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { CascadingFolderSelect } from "@/components/ui/cascading-folder-select";
import { useTranslation } from "react-i18next";
import {
    getBookmarkFolderTree,
    saveBookmarkRootSetting,
    getBookmarkRootSetting,
    BookmarkFolder
} from "@/lib/bookmarkUtils";

export function BookmarkSettings() {
    const { t } = useTranslation();
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadFoldersAndSettings();
    }, []);

    const loadFoldersAndSettings = async () => {
        try {
            setLoading(true);
            setError(null);

            // 并行获取文件夹树和当前设置
            const [folderTree, currentSetting] = await Promise.all([
                getBookmarkFolderTree(),
                getBookmarkRootSetting()
            ]);

            setFolders(folderTree);
            setSelectedFolder(currentSetting);
        } catch (err) {
            console.error('Error loading bookmark settings:', err);
            setError(t('bookmarkSettingsLoadError'));
        } finally {
            setLoading(false);
        }
    };

    const handleFolderChange = async (folderId: string) => {
        try {
            setSelectedFolder(folderId);
            await saveBookmarkRootSetting(folderId);
        } catch (err) {
            console.error('Error saving bookmark setting:', err);
            setError(t('bookmarkSettingsSaveError'));
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <h3 className="font-semibold text-left text-base">{t('bookmarkSettings')}</h3>
                </div>
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm">{t('loading')}</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <h3 className="font-semibold text-left text-base">{t('bookmarkSettings')}</h3>
                </div>
                <div className="text-center py-8">
                    <p className="text-red-500 text-sm mb-2">{error}</p>
                    <button
                        onClick={loadFoldersAndSettings}
                        className="text-sm text-primary hover:underline"
                    >
                        {t('retry')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-1.5">
                <h3 className="font-semibold text-left text-base">{t('bookmarkSettings')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('bookmarkSettingsDescription')}
                </p>
            </div>
            <div className="space-y-3">
                <Label className="text-sm font-medium">
                    {t('bookmarkRootFolder')}
                </Label>

                <CascadingFolderSelect
                    folders={folders}
                    selectedId={selectedFolder}
                    onSelect={handleFolderChange}
                    className="w-full"
                    placeholder={t('bookmarkRootFolder')}
                />

                {selectedFolder !== 'all' && (
                    <div className="text-xs text-muted-foreground">
                        {t('bookmarkRootFolderHint')}
                    </div>
                )}
            </div>
        </div>
    );
}
