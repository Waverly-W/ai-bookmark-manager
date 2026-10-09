import { describe, it, expect, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: { storage: { local: {} } } }));

import { SETTINGS_STORAGE_KEY, SettingsRepository, type StorageAreaLike } from '../clipper/settings/repository';
import { imageHostErrorField } from '../clipper/settings/errors';

const memoryStorage = (initial: Record<string, unknown> = {}): StorageAreaLike & { data: Record<string, unknown> } => {
  const data = { ...initial };
  return {
    data,
    async get(key) {
      return Object.hasOwn(data, key) ? { [key]: data[key] } : {};
    },
    async set(items) {
      Object.assign(data, items);
    },
  };
};

const r2 = (overrides: Record<string, string> = {}) => ({
  kind: 'r2' as const,
  accountId: 'abc123',
  bucket: 'my-bucket',
  accessKeyId: 'AKIA-TEST',
  secretAccessKey: 'secret-test',
  publicBaseUrl: 'https://img.example.com',
  keyPrefix: 'clippings',
  ...overrides,
});

describe('clipper AI formatting setting', () => {
  it('is off by default', async () => {
    const repo = new SettingsRepository(memoryStorage());

    expect((await repo.load()).model.autoFormatWithAI).toBe(false);
    expect((await repo.ensureStoredDefaults()).model.autoFormatWithAI).toBe(false);
  });

  it('ignores the legacy always-on value so existing installs fall back to off', async () => {
    const storage = memoryStorage({
      [SETTINGS_STORAGE_KEY]: {
        version: 1,
        model: {
          protocol: 'chat-completions',
          baseUrl: 'https://api.openai.com',
          apiKey: '',
          model: 'gpt-5-mini',
          timeoutMs: 60000,
          automaticFormatting: true,
        },
        imageHost: { kind: 'picgo', endpoint: 'http://127.0.0.1:36677/upload' },
        vault: { defaultSubdirectory: 'Inbox/Web Clippings' },
      },
    });

    const settings = await new SettingsRepository(storage).load();

    expect(settings.model).toEqual({ autoFormatWithAI: false });
  });

  it('persists an explicit opt-in and keeps it when the image host is saved', async () => {
    const repo = new SettingsRepository(memoryStorage());

    await repo.saveClipping(true);
    await repo.saveImageHost({ kind: 'picgo', endpoint: 'http://127.0.0.1:36677/upload' });

    expect((await repo.load()).model.autoFormatWithAI).toBe(true);
  });
});

describe('image host settings errors', () => {
  const failure = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      return error;
    }
    throw new Error('Expected the action to fail');
  };

  it('points at the PicGo endpoint field', async () => {
    const repo = new SettingsRepository(memoryStorage());
    const error = await failure(() => repo.saveImageHost({ kind: 'picgo', endpoint: 'ftp://localhost/upload' }));

    expect(imageHostErrorField(error)).toBe('picgoEndpoint');
  });

  it.each([
    [{ accountId: 'Bad Account!' }, 'r2AccountId'],
    [{ bucket: 'UPPER' }, 'r2Bucket'],
    [{ accessKeyId: '' }, 'r2AccessKeyId'],
    [{ secretAccessKey: '' }, 'r2SecretAccessKey'],
    [{ publicBaseUrl: 'https://img.example.com?token=1' }, 'r2PublicBaseUrl'],
  ])('points at the R2 field for %j', async (overrides, field) => {
    const repo = new SettingsRepository(memoryStorage());
    const error = await failure(() => repo.saveImageHost(r2(overrides)));

    expect(imageHostErrorField(error)).toBe(field);
  });

  it('returns undefined for errors that are not about a form field', () => {
    expect(imageHostErrorField(new Error('boom'))).toBeUndefined();
    expect(imageHostErrorField(undefined)).toBeUndefined();
  });

  it('keeps saved R2 credentials when they are left blank on a later save', async () => {
    const repo = new SettingsRepository(memoryStorage());
    await repo.saveImageHost(r2());

    const updated = await repo.saveImageHost(r2({ accessKeyId: '', secretAccessKey: '', keyPrefix: 'notes' }));

    expect(updated.imageHost).toMatchObject({
      kind: 'r2',
      accessKeyId: 'AKIA-TEST',
      secretAccessKey: 'secret-test',
      keyPrefix: 'notes',
    });
  });
});
