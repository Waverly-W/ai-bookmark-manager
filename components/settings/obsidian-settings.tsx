import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { VaultHandleRepository } from '@/lib/clipper/vault/database';
import { chooseVault, requestVaultPermissionFromUserGesture } from '@/lib/clipper/vault/permissions';
import { createSettingsRepository } from '@/lib/clipper/settings/repository';
import { defaultSettings, type Settings, type ImageHostSettings } from '@/lib/clipper/contracts/settings';
import { browser } from 'wxt/browser';
import { FolderTree, Image, CheckCircle, RefreshCw, FolderSearch } from 'lucide-react';

export function ObsidianSettings() {
  const { toast } = useToast();
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [vaultPermission, setVaultPermission] = useState<PermissionState>('prompt');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [imageHostKind, setImageHostKind] = useState<'picgo' | 'r2'>('picgo');

  // PicGo fields
  const [picgoEndpoint, setPicgoEndpoint] = useState('http://127.0.0.1:36677/upload');

  // R2 fields
  const [r2AccountId, setR2AccountId] = useState('');
  const [r2Bucket, setR2Bucket] = useState('');
  const [r2AccessKeyId, setR2AccessKeyId] = useState('');
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('');
  const [r2PublicBaseUrl, setR2PublicBaseUrl] = useState('');
  const [r2KeyPrefix, setR2KeyPrefix] = useState('clippings');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
              const p = await queryable.queryPermission({ mode: 'readwrite' });
              setVaultPermission(p);
            }
          } catch {
            setVaultPermission('prompt');
          }
        }

        const settingsRepo = createSettingsRepository(browser.storage);
        const saved = await settingsRepo.load();
        setSettings(saved);

        if (saved.imageHost) {
          setImageHostKind(saved.imageHost.kind);
          if (saved.imageHost.kind === 'picgo') {
            setPicgoEndpoint(saved.imageHost.endpoint);
          } else if (saved.imageHost.kind === 'r2') {
            setR2AccountId(saved.imageHost.accountId);
            setR2Bucket(saved.imageHost.bucket);
            setR2AccessKeyId(saved.imageHost.accessKeyId);
            setR2SecretAccessKey(saved.imageHost.secretAccessKey);
            setR2PublicBaseUrl(saved.imageHost.publicBaseUrl);
            setR2KeyPrefix(saved.imageHost.keyPrefix);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSelectVault = async () => {
    try {
      const handle = await chooseVault();
      setVaultName(handle.name);
      setVaultPermission('granted');
      toast({ title: '已成功绑定 Obsidian Vault', description: handle.name });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '绑定失败', description: err.message });
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const settingsRepo = createSettingsRepository(browser.storage);

      let imageHostConfig: ImageHostSettings | undefined;
      if (imageHostKind === 'picgo') {
        imageHostConfig = {
          kind: 'picgo',
          endpoint: picgoEndpoint as any,
        };
      } else {
        imageHostConfig = {
          kind: 'r2',
          accountId: r2AccountId,
          bucket: r2Bucket,
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
          publicBaseUrl: r2PublicBaseUrl as any,
          keyPrefix: r2KeyPrefix,
        };
      }

      const updated = {
        ...settings,
        imageHost: imageHostConfig,
      };

      await settingsRepo.save(updated);
      setSettings(updated);
      toast({ title: 'Obsidian 剪藏与图床配置已保存' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '保存配置失败', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div className="space-y-2 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2">
          <FolderTree className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Obsidian 剪藏与图床</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          配置文件系统目录直接写入 Obsidian 笔记库，并管理剪藏时远程图片的自动转存图床。
        </p>
      </div>

      {/* 1. Obsidian Vault 授权 */}
      <div className="space-y-4 rounded-xl border p-5 bg-card/50">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <FolderSearch className="h-4 w-4 text-primary" />
          本地 Obsidian Vault 授权
        </h3>
        <p className="text-xs text-muted-foreground">
          基于 Chrome File System Access API 直接存入你的本地笔记库文件夹，安全且零网络传输。
        </p>

        <div className="flex items-center justify-between p-3.5 rounded-lg bg-muted/60 border">
          <div>
            <div className="text-sm font-medium">
              当前 Vault：{vaultName ? <span className="text-primary font-semibold">{vaultName}</span> : '未绑定'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              权限状态：{vaultPermission === 'granted' ? '已授权读写' : '需用户手势确认授权'}
            </div>
          </div>
          <Button size="sm" onClick={handleSelectVault} className="gap-1.5">
            <FolderSearch className="h-4 w-4" />
            {vaultName ? '更改 Vault 目录' : '选择本地 Vault 目录'}
          </Button>
        </div>
      </div>

      {/* 2. 剪藏图床配置 */}
      <div className="space-y-4 rounded-xl border p-5 bg-card/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              文章图片转存图床
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              剪藏时自动下载文章内防盗链图片并上传到你自己的图床，替换为永久图床链接。
            </p>
          </div>

          <Select value={imageHostKind} onValueChange={(val: any) => setImageHostKind(val)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="选择图床类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="picgo">本地 PicGo Server</SelectItem>
              <SelectItem value="r2">Cloudflare R2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {imageHostKind === 'picgo' && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">PicGo 上传接口 Endpoint</Label>
              <Input
                value={picgoEndpoint}
                onChange={(e) => setPicgoEndpoint(e.target.value)}
                placeholder="http://127.0.0.1:36677/upload"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                PicGo 客户端默认监听 36677 端口（需在 PicGo 设置中开启 Server）。
              </p>
            </div>
          </div>
        )}

        {imageHostKind === 'r2' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Account ID</Label>
              <Input
                value={r2AccountId}
                onChange={(e) => setR2AccountId(e.target.value)}
                placeholder="Cloudflare Account ID"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bucket 存储桶名</Label>
              <Input
                value={r2Bucket}
                onChange={(e) => setR2Bucket(e.target.value)}
                placeholder="my-bucket"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Access Key ID</Label>
              <Input
                value={r2AccessKeyId}
                onChange={(e) => setR2AccessKeyId(e.target.value)}
                placeholder="R2 API Token Access Key"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Secret Access Key</Label>
              <Input
                type="password"
                value={r2SecretAccessKey}
                onChange={(e) => setR2SecretAccessKey(e.target.value)}
                placeholder="R2 API Token Secret"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">公共访问域名 Public Base URL</Label>
              <Input
                value={r2PublicBaseUrl}
                onChange={(e) => setR2PublicBaseUrl(e.target.value)}
                placeholder="https://images.example.com"
                className="font-mono text-xs"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? '保存中…' : '保存图床与剪藏设置'}
          </Button>
        </div>
      </div>
    </div>
  );
}
