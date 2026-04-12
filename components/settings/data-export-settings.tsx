import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AlertTriangle,
    CheckCircle2,
    Cloud,
    Database,
    History,
    Loader2,
    RefreshCw,
    Save,
    Sparkles,
    Trash2,
    Upload
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getAIConfig, validateAIConfig } from '@/lib/aiConfigUtils';
import { resolveBackupConflictsWithAI } from '@/lib/aiService';
import {
    AIConflictResolution,
    applyAIConflictResolutions,
    BackupSnapshot,
    BackupVersionSummary,
    collectLocalBackupSnapshot,
    createWebDAVBackup,
    DEFAULT_WEBDAV_BACKUP_CONFIG,
    deleteWebDAVBackup,
    getWebDAVBackupConfig,
    listWebDAVBackups,
    loadWebDAVBackup,
    MergeConflict,
    mergeBackupSnapshots,
    restoreBackupSnapshot,
    saveWebDAVBackupConfig,
    testWebDAVConnection,
    validateWebDAVBackupConfig,
    type WebDAVBackupConfig
} from '@/lib/webdavSync';

interface ConflictDialogState {
    version: BackupVersionSummary;
    baseMergedSnapshot: BackupSnapshot;
    conflicts: MergeConflict[];
}

interface AIPreviewState {
    version: BackupVersionSummary;
    mergedSnapshot: BackupSnapshot;
    conflicts: MergeConflict[];
    resolutions: AIConflictResolution[];
}

const summarizeSnapshot = (snapshot: BackupSnapshot) => {
    let folderCount = 0;
    let bookmarkCount = 0;
    let tagCount = 0;

    const walk = (nodes: BackupSnapshot['bookmarks']['roots'][number]['children']) => {
        nodes.forEach((node) => {
            if (node.type === 'folder') {
                folderCount += 1;
                walk(node.children);
                return;
            }

            bookmarkCount += 1;
            tagCount += node.tags.length;
        });
    };

    snapshot.bookmarks.roots.forEach((root) => walk(root.children));

    return {
        roots: snapshot.bookmarks.roots.length,
        folders: folderCount,
        bookmarks: bookmarkCount,
        tags: tagCount
    };
};

const formatConflictValue = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    return JSON.stringify(value, null, 2);
};

const VersionCard: React.FC<{
    version: BackupVersionSummary;
    loading: boolean;
    overwriteLabel: string;
    incrementalLabel: string;
    deleteLabel: string;
    bookmarksLabel: string;
    onDelete: () => void;
    onOverwrite: () => void;
    onIncremental: () => void;
}> = ({ version, loading, overwriteLabel, incrementalLabel, deleteLabel, bookmarksLabel, onDelete, onOverwrite, onIncremental }) => (
    <Card className="border-border/70">
        <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle className="text-base">{version.folderName}</CardTitle>
                    <CardDescription>{version.createdAt}</CardDescription>
                </div>
                <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {version.counts.bookmarks} {bookmarksLabel}
                </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{version.counts.folders} folders</span>
                <span>{version.counts.tags} tags</span>
                <span>{version.counts.roots} roots</span>
            </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button
                variant="outline"
                disabled={loading}
                onClick={onDelete}
            >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {deleteLabel}
            </Button>
            <Button
                variant="outline"
                className="flex-1"
                disabled={loading}
                onClick={onOverwrite}
            >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {overwriteLabel}
            </Button>
            <Button
                className="flex-1"
                disabled={loading}
                onClick={onIncremental}
            >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {incrementalLabel}
            </Button>
        </CardContent>
    </Card>
);

export function DataExportSettings() {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();

    const [config, setConfig] = useState<WebDAVBackupConfig>(DEFAULT_WEBDAV_BACKUP_CONFIG);
    const [configLoading, setConfigLoading] = useState(true);
    const [configSaving, setConfigSaving] = useState(false);
    const [connectionTesting, setConnectionTesting] = useState(false);
    const [backupRunning, setBackupRunning] = useState(false);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [restoreVersionId, setRestoreVersionId] = useState<string | null>(null);
    const [deleteVersionId, setDeleteVersionId] = useState<string | null>(null);
    const [versions, setVersions] = useState<BackupVersionSummary[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const [preferredSource, setPreferredSource] = useState<'local' | 'remote'>('local');
    const [conflictDialogState, setConflictDialogState] = useState<ConflictDialogState | null>(null);
    const [aiResolving, setAiResolving] = useState(false);
    const [aiPreviewState, setAiPreviewState] = useState<AIPreviewState | null>(null);
    const [restoreApplying, setRestoreApplying] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const savedConfig = await getWebDAVBackupConfig();
                setConfig(savedConfig);
                if (savedConfig.baseUrl) {
                    await refreshVersions(savedConfig);
                }
            } catch (error) {
                console.error('Failed to load WebDAV config:', error);
            } finally {
                setConfigLoading(false);
            }
        };

        loadConfig();
    }, []);

    const canOperate = useMemo(() => validateWebDAVBackupConfig(config).valid, [config]);

    const refreshVersions = async (nextConfig: WebDAVBackupConfig = config) => {
        const validation = validateWebDAVBackupConfig(nextConfig);
        if (!validation.valid) {
            setVersions([]);
            return;
        }

        setVersionsLoading(true);
        try {
            const list = await listWebDAVBackups(nextConfig);
            setVersions(list);
        } catch (error) {
            console.error('Failed to load WebDAV backups:', error);
            toast({
                title: t('webdavVersionsLoadFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: 'destructive'
            });
        } finally {
            setVersionsLoading(false);
        }
    };

    const persistConfig = async (): Promise<WebDAVBackupConfig | null> => {
        const validation = validateWebDAVBackupConfig(config);
        if (!validation.valid) {
            toast({
                title: t('webdavConfigInvalid'),
                description: validation.errors.map((key) => t(key)).join(', '),
                variant: 'destructive'
            });
            return null;
        }

        const nextConfig: WebDAVBackupConfig = {
            ...config,
            baseUrl: config.baseUrl.trim(),
            username: config.username.trim(),
            maxVersions: Math.max(1, Math.min(100, Number(config.maxVersions) || 1))
        };

        await saveWebDAVBackupConfig(nextConfig);
        setConfig(nextConfig);
        return nextConfig;
    };

    const handleSaveConfig = async () => {
        setConfigSaving(true);
        try {
            const savedConfig = await persistConfig();
            if (!savedConfig) {
                return;
            }

            toast({
                title: t('webdavConfigSaved'),
                description: t('webdavConfigSavedDesc')
            });
        } catch (error) {
            console.error('Failed to save WebDAV config:', error);
            toast({
                title: t('webdavConfigSaveFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: 'destructive'
            });
        } finally {
            setConfigSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setConnectionTesting(true);
        try {
            const savedConfig = await persistConfig();
            if (!savedConfig) {
                return;
            }

            const result = await testWebDAVConnection(savedConfig);
            setConnectionStatus(result);

            toast({
                title: result.success ? t('webdavConnectionSuccess') : t('webdavConnectionFailed'),
                description: result.message,
                variant: result.success ? 'default' : 'destructive'
            });

            if (result.success) {
                await refreshVersions(savedConfig);
            }
        } catch (error) {
            console.error('Failed to test WebDAV connection:', error);
            toast({
                title: t('webdavConnectionFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: 'destructive'
            });
        } finally {
            setConnectionTesting(false);
        }
    };

    const handleCreateBackup = async () => {
        setBackupRunning(true);
        try {
            const savedConfig = await persistConfig();
            if (!savedConfig) {
                return;
            }

            const version = await createWebDAVBackup(savedConfig);
            await refreshVersions(savedConfig);

            toast({
                title: t('webdavBackupSuccess'),
                description: t('webdavBackupSuccessDesc', { version: version.folderName })
            });
        } catch (error) {
            console.error('Failed to create WebDAV backup:', error);
            toast({
                title: t('webdavBackupFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: 'destructive'
            });
        } finally {
            setBackupRunning(false);
        }
    };

    const applySnapshot = async (snapshot: BackupSnapshot, successTitle: string, successDescription: string) => {
        setRestoreApplying(true);
        try {
            await restoreBackupSnapshot(snapshot, 'overwrite');
            toast({
                title: successTitle,
                description: successDescription
            });
        } catch (error) {
            console.error('Failed to apply backup snapshot:', error);
            toast({
                title: t('webdavRestoreFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: 'destructive'
            });
        } finally {
            setRestoreApplying(false);
        }
    };

    const handleOverwriteRestore = async (version: BackupVersionSummary) => {
        if (!window.confirm(t('webdavOverwriteConfirm', { version: version.folderName }))) {
            return;
        }

        setRestoreVersionId(version.folderName);
        try {
            const bundle = await loadWebDAVBackup(config, version.folderName);
            await applySnapshot(
                bundle.snapshot,
                t('webdavRestoreSuccess'),
                t('webdavRestoreSuccessDesc', { version: version.folderName })
            );
        } finally {
            setRestoreVersionId(null);
        }
    };

    const handleDeleteVersion = async (version: BackupVersionSummary) => {
        if (!window.confirm(t('webdavDeleteConfirm', { version: version.folderName }))) {
            return;
        }

        setDeleteVersionId(version.folderName);
        try {
            await deleteWebDAVBackup(config, version.folderName);
            await refreshVersions(config);
            toast({
                title: t('webdavDeleteSuccess'),
                description: t('webdavDeleteSuccessDesc', { version: version.folderName })
            });
        } catch (error) {
            console.error('Failed to delete backup version:', error);
            toast({
                title: t('webdavDeleteFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: 'destructive'
            });
        } finally {
            setDeleteVersionId(null);
        }
    };

    const handleIncrementalRestore = async (version: BackupVersionSummary) => {
        setRestoreVersionId(version.folderName);
        try {
            const [bundle, localSnapshot] = await Promise.all([
                loadWebDAVBackup(config, version.folderName),
                collectLocalBackupSnapshot()
            ]);
            const mergeResult = mergeBackupSnapshots(localSnapshot, bundle.snapshot);

            if (mergeResult.conflicts.length === 0) {
                if (!window.confirm(t('webdavIncrementalNoConflictConfirm', { version: version.folderName }))) {
                    return;
                }

                await applySnapshot(
                    mergeResult.mergedSnapshot,
                    t('webdavIncrementalRestoreSuccess'),
                    t('webdavIncrementalRestoreSuccessDesc', { version: version.folderName })
                );
                return;
            }

            setPreferredSource('local');
            setConflictDialogState({
                version,
                baseMergedSnapshot: mergeResult.mergedSnapshot,
                conflicts: mergeResult.conflicts
            });
        } catch (error) {
            console.error('Failed to run incremental restore:', error);
            toast({
                title: t('webdavIncrementalRestoreFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: 'destructive'
            });
        } finally {
            setRestoreVersionId(null);
        }
    };

    const handleResolveWithAI = async () => {
        if (!conflictDialogState) {
            return;
        }

        const aiConfig = await getAIConfig();
        const validation = validateAIConfig(aiConfig);
        if (!validation.valid) {
            toast({
                title: t('backupConflictAIUnavailable'),
                description: t('backupConflictAIUnavailableDesc'),
                variant: 'destructive'
            });
            return;
        }

        setAiResolving(true);
        try {
            const result = await resolveBackupConflictsWithAI(
                aiConfig,
                conflictDialogState.conflicts,
                preferredSource,
                i18n.language
            );

            if (!result.success || !result.resolutions) {
                throw new Error(result.error || t('backupConflictAIResolveFailed'));
            }

            const resolutionMap = new Map(result.resolutions.map((resolution) => [resolution.conflictId, resolution]));
            const completedResolutions: AIConflictResolution[] = conflictDialogState.conflicts.map((conflict) => {
                const existing = resolutionMap.get(conflict.id);
                if (existing) {
                    return existing;
                }

                return {
                    conflictId: conflict.id,
                    chosenSource: preferredSource,
                    mergedValue: preferredSource === 'local' ? conflict.localValue : conflict.remoteValue,
                    reason: t('backupConflictFallbackReason', { source: preferredSource === 'local' ? t('localPreferred') : t('remotePreferred') })
                };
            });

            const mergedSnapshot = applyAIConflictResolutions(
                conflictDialogState.baseMergedSnapshot,
                conflictDialogState.conflicts,
                completedResolutions
            );

            setAiPreviewState({
                version: conflictDialogState.version,
                mergedSnapshot,
                conflicts: conflictDialogState.conflicts,
                resolutions: completedResolutions
            });
            setConflictDialogState(null);
        } catch (error) {
            console.error('Failed to resolve conflicts with AI:', error);
            toast({
                title: t('backupConflictAIResolveFailed'),
                description: error instanceof Error ? error.message : t('unknownError'),
                variant: 'destructive'
            });
        } finally {
            setAiResolving(false);
        }
    };

    const aiPreviewSummary = aiPreviewState ? summarizeSnapshot(aiPreviewState.mergedSnapshot) : null;

    if (configLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="space-y-8">
                <div className="space-y-6">
                    <div className="space-y-2 border-b border-border/50 pb-4">
                        <h3 className="font-semibold text-lg">{t('webdavBackupTitle')}</h3>
                        <p className="text-sm text-muted-foreground">{t('webdavBackupDescription')}</p>
                    </div>

                    <Card className="border-border/70">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Cloud className="h-4 w-4 text-primary" />
                                <CardTitle className="text-base">{t('webdavConfigTitle')}</CardTitle>
                            </div>
                            <CardDescription>{t('webdavConfigDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="webdav-url">{t('webdavUrl')}</Label>
                                <Input
                                    id="webdav-url"
                                    value={config.baseUrl}
                                    placeholder={t('webdavUrlPlaceholder')}
                                    onChange={(event) => {
                                        setConfig((current) => ({
                                            ...current,
                                            baseUrl: event.target.value
                                        }));
                                        setConnectionStatus(null);
                                    }}
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="webdav-username">{t('webdavUsername')}</Label>
                                    <Input
                                        id="webdav-username"
                                        value={config.username}
                                        placeholder={t('webdavUsernamePlaceholder')}
                                        onChange={(event) => {
                                            setConfig((current) => ({
                                                ...current,
                                                username: event.target.value
                                            }));
                                            setConnectionStatus(null);
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="webdav-password">{t('webdavPassword')}</Label>
                                    <Input
                                        id="webdav-password"
                                        type="password"
                                        value={config.password}
                                        placeholder={t('webdavPasswordPlaceholder')}
                                        onChange={(event) => {
                                            setConfig((current) => ({
                                                ...current,
                                                password: event.target.value
                                            }));
                                            setConnectionStatus(null);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="webdav-max-versions">{t('webdavMaxVersions')}</Label>
                                <Input
                                    id="webdav-max-versions"
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={config.maxVersions}
                                    onChange={(event) => {
                                        setConfig((current) => ({
                                            ...current,
                                            maxVersions: Number(event.target.value) || 1
                                        }));
                                    }}
                                />
                                <p className="text-xs text-muted-foreground">{t('webdavMaxVersionsHint')}</p>
                            </div>

                            {connectionStatus && (
                                <div className={cn(
                                    "flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm",
                                    connectionStatus.success
                                        ? "border-primary/20 bg-primary/5 text-foreground"
                                        : "border-destructive/20 bg-destructive/10 text-destructive"
                                )}>
                                    {connectionStatus.success ? (
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                    ) : (
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    )}
                                    <span>{connectionStatus.message}</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    disabled={configSaving || connectionTesting}
                                    onClick={handleSaveConfig}
                                >
                                    {configSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {t('save')}
                                </Button>
                                <Button
                                    className="flex-1"
                                    disabled={configSaving || connectionTesting}
                                    onClick={handleTestConnection}
                                >
                                    {connectionTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
                                    {t('webdavTestConnection')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2 border-b border-border/50 pb-4">
                        <h3 className="font-semibold text-lg">{t('webdavVersionCenter')}</h3>
                        <p className="text-sm text-muted-foreground">{t('webdavVersionCenterDescription')}</p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                            className="flex-1"
                            disabled={!canOperate || backupRunning}
                            onClick={handleCreateBackup}
                        >
                            {backupRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                            {t('webdavCreateBackup')}
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1"
                            disabled={!canOperate || versionsLoading}
                            onClick={() => refreshVersions()}
                        >
                            {versionsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {t('refresh')}
                        </Button>
                    </div>

                    <Card className="border-border/70">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <History className="h-4 w-4 text-primary" />
                                <CardTitle className="text-base">{t('webdavVersionList')}</CardTitle>
                            </div>
                            <CardDescription>{t('webdavVersionListDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {versionsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : versions.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                                    {t('webdavVersionEmpty')}
                                </div>
                            ) : (
                                versions.map((version) => (
                                    <VersionCard
                                        key={version.folderName}
                                        version={version}
                                        loading={
                                            restoreVersionId === version.folderName ||
                                            deleteVersionId === version.folderName ||
                                            restoreApplying
                                        }
                                        overwriteLabel={t('overwriteRestore')}
                                        incrementalLabel={t('incrementalRestore')}
                                        deleteLabel={t('delete')}
                                        bookmarksLabel={t('bookmarks')}
                                        onDelete={() => handleDeleteVersion(version)}
                                        onOverwrite={() => handleOverwriteRestore(version)}
                                        onIncremental={() => handleIncrementalRestore(version)}
                                    />
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog
                open={Boolean(conflictDialogState)}
                onOpenChange={(open) => {
                    if (!open) {
                        setConflictDialogState(null);
                    }
                }}
            >
                <DialogContent size="2xl">
                    <DialogHeader>
                        <DialogTitle>{t('backupConflictDialogTitle')}</DialogTitle>
                        <DialogDescription>
                            {conflictDialogState
                                ? t('backupConflictDialogDescription', {
                                    version: conflictDialogState.version.folderName,
                                    count: conflictDialogState.conflicts.length
                                })
                                : ''}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="space-y-3">
                            <Label>{t('backupConflictPreference')}</Label>
                            <RadioGroup
                                value={preferredSource}
                                onValueChange={(value) => setPreferredSource(value as 'local' | 'remote')}
                                className="grid gap-3 md:grid-cols-2"
                            >
                                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
                                    <RadioGroupItem value="local" className="mt-1" />
                                    <div className="space-y-1">
                                        <div className="font-medium">{t('localPreferred')}</div>
                                        <p className="text-sm text-muted-foreground">{t('localPreferredDesc')}</p>
                                    </div>
                                </label>
                                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
                                    <RadioGroupItem value="remote" className="mt-1" />
                                    <div className="space-y-1">
                                        <div className="font-medium">{t('remotePreferred')}</div>
                                        <p className="text-sm text-muted-foreground">{t('remotePreferredDesc')}</p>
                                    </div>
                                </label>
                            </RadioGroup>
                        </div>

                        <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-2xl border border-border/70 p-4">
                            {conflictDialogState?.conflicts.map((conflict) => (
                                <div key={conflict.id} className="space-y-2 rounded-xl bg-muted/40 p-3">
                                    <div className="text-sm font-medium">
                                        [{conflict.section}] {conflict.entityKey} / {conflict.field}
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="rounded-lg border border-border/70 bg-background p-3">
                                            <div className="mb-2 text-xs font-medium text-muted-foreground">{t('localValue')}</div>
                                            <pre className="whitespace-pre-wrap break-all text-xs">{formatConflictValue(conflict.localValue)}</pre>
                                        </div>
                                        <div className="rounded-lg border border-border/70 bg-background p-3">
                                            <div className="mb-2 text-xs font-medium text-muted-foreground">{t('remoteValue')}</div>
                                            <pre className="whitespace-pre-wrap break-all text-xs">{formatConflictValue(conflict.remoteValue)}</pre>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConflictDialogState(null)}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            disabled={aiResolving}
                            onClick={handleResolveWithAI}
                        >
                            {aiResolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            {t('backupConflictUseAI')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(aiPreviewState)}
                onOpenChange={(open) => {
                    if (!open) {
                        setAiPreviewState(null);
                    }
                }}
            >
                <DialogContent size="2xl">
                    <DialogHeader>
                        <DialogTitle>{t('backupConflictPreviewTitle')}</DialogTitle>
                        <DialogDescription>
                            {aiPreviewState ? t('backupConflictPreviewDescription', { version: aiPreviewState.version.folderName }) : ''}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        {aiPreviewSummary && (
                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="rounded-2xl border border-border/70 p-4">
                                    <div className="text-xs text-muted-foreground">Roots</div>
                                    <div className="mt-1 text-xl font-semibold">{aiPreviewSummary.roots}</div>
                                </div>
                                <div className="rounded-2xl border border-border/70 p-4">
                                    <div className="text-xs text-muted-foreground">Folders</div>
                                    <div className="mt-1 text-xl font-semibold">{aiPreviewSummary.folders}</div>
                                </div>
                                <div className="rounded-2xl border border-border/70 p-4">
                                    <div className="text-xs text-muted-foreground">Bookmarks</div>
                                    <div className="mt-1 text-xl font-semibold">{aiPreviewSummary.bookmarks}</div>
                                </div>
                                <div className="rounded-2xl border border-border/70 p-4">
                                    <div className="text-xs text-muted-foreground">Tags</div>
                                    <div className="mt-1 text-xl font-semibold">{aiPreviewSummary.tags}</div>
                                </div>
                            </div>
                        )}

                        <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-2xl border border-border/70 p-4">
                            {aiPreviewState?.resolutions.map((resolution) => {
                                const conflict = aiPreviewState.conflicts.find((item) => item.id === resolution.conflictId);

                                return (
                                    <div key={resolution.conflictId} className="space-y-2 rounded-xl bg-muted/40 p-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {conflict ? `[${conflict.section}] ${conflict.entityKey} / ${conflict.field}` : resolution.conflictId}
                                            </span>
                                            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                                {resolution.chosenSource}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{resolution.reason}</p>
                                        <div className="rounded-lg border border-border/70 bg-background p-3">
                                            <div className="mb-2 text-xs font-medium text-muted-foreground">{t('mergedValue')}</div>
                                            <pre className="whitespace-pre-wrap break-all text-xs">{formatConflictValue(resolution.mergedValue)}</pre>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAiPreviewState(null)}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            disabled={restoreApplying}
                            onClick={async () => {
                                if (!aiPreviewState) {
                                    return;
                                }

                                await applySnapshot(
                                    aiPreviewState.mergedSnapshot,
                                    t('webdavIncrementalRestoreSuccess'),
                                    t('webdavIncrementalRestoreSuccessDesc', { version: aiPreviewState.version.folderName })
                                );
                                setAiPreviewState(null);
                            }}
                        >
                            {restoreApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            {t('confirmRestore')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
