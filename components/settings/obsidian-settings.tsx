import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { VaultHandleRepository } from '@/lib/clipper/vault/database';
import { chooseVault } from '@/lib/clipper/vault/permissions';
import { createSettingsRepository } from '@/lib/clipper/settings/repository';
import { imageHostErrorField, type ImageHostField } from '@/lib/clipper/settings/errors';
import type { Settings } from '@/lib/clipper/contracts/settings';
import { browser } from 'wxt/browser';
import { FolderTree, Image, FolderSearch, Sparkles } from 'lucide-react';

const FIELD_ERROR_KEYS: Record<ImageHostField, string> = {
  picgoEndpoint: 'obsidianErrPicgoEndpoint',
  r2AccountId: 'obsidianErrR2AccountId',
  r2Bucket: 'obsidianErrR2Bucket',
  r2AccessKeyId: 'obsidianErrR2AccessKeyId',
  r2SecretAccessKey: 'obsidianErrR2SecretAccessKey',
  r2PublicBaseUrl: 'obsidianErrR2PublicBaseUrl',
};

function hasSavedR2Credentials(imageHost: Settings['imageHost']): boolean {
  return imageHost.kind === 'r2' && Boolean(imageHost.accessKeyId) && Boolean(imageHost.secretAccessKey);
}

export function ObsidianSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [vaultPermission, setVaultPermission] = useState<PermissionState>('prompt');
  const [autoFormat, setAutoFormat] = useState(false);
  const [imageHostKind, setImageHostKind] = useState<'picgo' | 'r2'>('picgo');

  // PicGo fields
  const [picgoEndpoint, setPicgoEndpoint] = useState('http://127.0.0.1:36677/upload');

  // R2 fields. Saved credentials are never read back into the form.
  const [r2AccountId, setR2AccountId] = useState('');
  const [r2Bucket, setR2Bucket] = useState('');
  const [r2AccessKeyId, setR2AccessKeyId] = useState('');
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('');
  const [r2PublicBaseUrl, setR2PublicBaseUrl] = useState('');
  const [r2KeyPrefix, setR2KeyPrefix] = useState('clippings');
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  const [fieldError, setFieldError] = useState<ImageHostField | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const applySaved = (saved: Settings) => {
    setAutoFormat(saved.model.autoFormatWithAI);
    setImageHostKind(saved.imageHost.kind);
    if (saved.imageHost.kind === 'picgo') {
      setPicgoEndpoint(saved.imageHost.endpoint);
    } else {
      setR2AccountId(saved.imageHost.accountId);
      setR2Bucket(saved.imageHost.bucket);
      setR2PublicBaseUrl(saved.imageHost.publicBaseUrl);
      setR2KeyPrefix(saved.imageHost.keyPrefix);
    }
    setCredentialsSaved(hasSavedR2Credentials(saved.imageHost));
  };

  useEffect(() => {
    (async () => {
      try {
        const repo = new VaultHandleRepository();
        const handle = await repo.load();
        if (handle) {
          setVaultName(handle.name);
          try {
            const queryable = handle as unknown as { queryPermission?: (desc: { mode: string }) => Promise<PermissionState> };
            if (typeof queryable.queryPermission === 'function') {
              setVaultPermission(await queryable.queryPermission({ mode: 'readwrite' }));
            }
          } catch {
            setVaultPermission('prompt');
          }
        }

        applySaved(await createSettingsRepository(browser.storage).load());
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    })();
  }, []);

  const handleSelectVault = async () => {
    try {
      const handle = await chooseVault();
      setVaultName(handle.name);
      setVaultPermission('granted');
      toast({ title: t('obsidianVaultBound'), description: handle.name });
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('obsidianVaultBindFailed'), description: err.message });
    }
  };

  const editField = (field: ImageHostField, setter: (value: string) => void) => (value: string) => {
    setter(value);
    if (fieldError === field) setFieldError(null);
  };

  const handleSaveSettings = async () => {
    setFieldError(null);
    setIsSaving(true);
    try {
      const repo = createSettingsRepository(browser.storage);

      // Both calls re-read the latest stored settings under the lock, so nothing
      // else the clipper saved in the meantime is overwritten by stale form state.
      await repo.saveClipping(autoFormat);
      const saved = imageHostKind === 'picgo'
        ? await repo.saveImageHost({ kind: 'picgo', endpoint: picgoEndpoint.trim() })
        : await repo.saveImageHost({
            kind: 'r2',
            accountId: r2AccountId.trim(),
            bucket: r2Bucket.trim(),
            accessKeyId: r2AccessKeyId.trim(),
            secretAccessKey: r2SecretAccessKey,
            publicBaseUrl: r2PublicBaseUrl.trim(),
            keyPrefix: r2KeyPrefix.trim(),
          });

      applySaved(saved);
      setR2AccessKeyId('');
      setR2SecretAccessKey('');
      toast({ title: t('obsidianSaved') });
    } catch (err: any) {
      const field = imageHostErrorField(err);
      setFieldError(field ?? null);
      toast({
        variant: 'destructive',
        title: t('obsidianSaveFailed'),
        description: field ? t(FIELD_ERROR_KEYS[field]) : t('obsidianErrGeneric'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fieldMessage = (field: ImageHostField) => fieldError === field && (
    <p role="alert" className="text-[11px] text-destructive">{t(FIELD_ERROR_KEYS[field])}</p>
  );

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div className="space-y-2 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2">
          <FolderTree className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">{t('obsidianTitle')}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t('obsidianDescription')}</p>
      </div>

      {/* 1. Obsidian Vault 授权 */}
      <div className="space-y-4 rounded-xl border p-5 bg-card/50">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <FolderSearch className="h-4 w-4 text-primary" />
          {t('obsidianVaultTitle')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('obsidianVaultDescription')}</p>

        <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-muted/60 border">
          <div className="min-w-0">
            <div className="text-sm font-medium">
              {t('obsidianVaultCurrent', { name: vaultName ?? t('obsidianVaultUnbound') })}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t('obsidianVaultPermission', {
                status: vaultPermission === 'granted' ? t('obsidianVaultGranted') : t('obsidianVaultNeedsGesture'),
              })}
            </div>
          </div>
          <Button size="sm" onClick={handleSelectVault} className="gap-1.5 shrink-0">
            <FolderSearch className="h-4 w-4" />
            {vaultName ? t('obsidianVaultChange') : t('obsidianVaultChoose')}
          </Button>
        </div>
      </div>

      {/* 2. AI 排版 */}
      <div className="space-y-4 rounded-xl border p-5 bg-card/50">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t('obsidianAiTitle')}
        </h3>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="obsidian-auto-format" className="text-sm">{t('obsidianAutoFormatLabel')}</Label>
            <p className="text-xs text-muted-foreground">{t('obsidianAutoFormatDescription')}</p>
          </div>
          <Switch
            id="obsidian-auto-format"
            checked={autoFormat}
            onCheckedChange={setAutoFormat}
            className="mt-0.5"
          />
        </div>
      </div>

      {/* 3. 剪藏图床配置 */}
      <div className="space-y-4 rounded-xl border p-5 bg-card/50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              {t('obsidianImageHostTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('obsidianImageHostDescription')}</p>
          </div>

          <Select
            value={imageHostKind}
            onValueChange={(value: string) => {
              setImageHostKind(value === 'r2' ? 'r2' : 'picgo');
              setFieldError(null);
            }}
          >
            <SelectTrigger className="w-[180px] h-9 shrink-0" aria-label={t('obsidianImageHostTitle')}>
              <SelectValue placeholder={t('obsidianImageHostTypePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="picgo">{t('obsidianPicgoOption')}</SelectItem>
              <SelectItem value="r2">{t('obsidianR2Option')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {imageHostKind === 'picgo' && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="picgo-endpoint" className="text-xs">{t('obsidianPicgoEndpoint')}</Label>
              <Input
                id="picgo-endpoint"
                value={picgoEndpoint}
                onChange={(e) => editField('picgoEndpoint', setPicgoEndpoint)(e.target.value)}
                aria-invalid={fieldError === 'picgoEndpoint'}
                placeholder="http://127.0.0.1:36677/upload"
                className="font-mono text-xs"
              />
              {fieldMessage('picgoEndpoint') || (
                <p className="text-[11px] text-muted-foreground">{t('obsidianPicgoHint')}</p>
              )}
            </div>
          </div>
        )}

        {imageHostKind === 'r2' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="r2-account-id" className="text-xs">Account ID</Label>
              <Input
                id="r2-account-id"
                value={r2AccountId}
                onChange={(e) => editField('r2AccountId', setR2AccountId)(e.target.value)}
                aria-invalid={fieldError === 'r2AccountId'}
                placeholder="Cloudflare Account ID"
                className="font-mono text-xs"
              />
              {fieldMessage('r2AccountId')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r2-bucket" className="text-xs">{t('obsidianR2Bucket')}</Label>
              <Input
                id="r2-bucket"
                value={r2Bucket}
                onChange={(e) => editField('r2Bucket', setR2Bucket)(e.target.value)}
                aria-invalid={fieldError === 'r2Bucket'}
                placeholder="my-bucket"
                className="font-mono text-xs"
              />
              {fieldMessage('r2Bucket')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r2-access-key-id" className="text-xs">Access Key ID</Label>
              <Input
                id="r2-access-key-id"
                autoComplete="off"
                value={r2AccessKeyId}
                onChange={(e) => editField('r2AccessKeyId', setR2AccessKeyId)(e.target.value)}
                aria-invalid={fieldError === 'r2AccessKeyId'}
                placeholder={credentialsSaved ? t('obsidianCredentialSaved') : 'R2 API Token Access Key'}
                className="font-mono text-xs"
              />
              {fieldMessage('r2AccessKeyId')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r2-secret-access-key" className="text-xs">Secret Access Key</Label>
              <Input
                id="r2-secret-access-key"
                type="password"
                autoComplete="off"
                value={r2SecretAccessKey}
                onChange={(e) => editField('r2SecretAccessKey', setR2SecretAccessKey)(e.target.value)}
                aria-invalid={fieldError === 'r2SecretAccessKey'}
                placeholder={credentialsSaved ? t('obsidianCredentialSaved') : 'R2 API Token Secret'}
                className="font-mono text-xs"
              />
              {fieldMessage('r2SecretAccessKey')}
            </div>
            {credentialsSaved && (
              <p className="text-[11px] text-muted-foreground md:col-span-2">{t('obsidianCredentialSavedHint')}</p>
            )}
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="r2-public-base-url" className="text-xs">{t('obsidianR2PublicBaseUrl')}</Label>
              <Input
                id="r2-public-base-url"
                value={r2PublicBaseUrl}
                onChange={(e) => editField('r2PublicBaseUrl', setR2PublicBaseUrl)(e.target.value)}
                aria-invalid={fieldError === 'r2PublicBaseUrl'}
                placeholder="https://images.example.com"
                className="font-mono text-xs"
              />
              {fieldMessage('r2PublicBaseUrl')}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="r2-key-prefix" className="text-xs">{t('obsidianR2KeyPrefix')}</Label>
              <Input
                id="r2-key-prefix"
                value={r2KeyPrefix}
                onChange={(e) => setR2KeyPrefix(e.target.value)}
                placeholder="clippings"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">{t('obsidianR2KeyPrefixHint')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? t('obsidianSaving') : t('obsidianSave')}
        </Button>
      </div>
    </div>
  );
}
