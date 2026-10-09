import { describe, it, expect, vi, beforeEach } from 'vitest';

const request = vi.fn();
// vi.fn 会额外跟踪返回的 Promise，被拒绝的 Promise 会被误判为未处理的错误，所以拒绝的场景改用普通函数
let rejectWith: Error | undefined;
vi.mock('wxt/browser', () => ({
  browser: {
    permissions: {
      request: (...args: unknown[]) => (rejectWith ? Promise.reject(rejectWith) : request(...args)),
    },
  },
}));

import { ALL_SITES_PATTERNS, hostPatternFor, requestHostAccess } from '../hostAccess';

beforeEach(() => {
  request.mockReset();
  rejectWith = undefined;
});

describe('hostPatternFor', () => {
  it('builds an origin pattern without the port', () => {
    expect(hostPatternFor('https://api.example.com/v1/chat/completions')).toBe('https://api.example.com/*');
    expect(hostPatternFor('http://127.0.0.1:36677/upload')).toBe('http://127.0.0.1/*');
    expect(hostPatternFor('http://localhost:11434/v1')).toBe('http://localhost/*');
  });

  it('rejects anything that is not a plain http(s) URL', () => {
    expect(hostPatternFor('not a url')).toBeUndefined();
    expect(hostPatternFor('ftp://example.com')).toBeUndefined();
    expect(hostPatternFor('chrome://extensions')).toBeUndefined();
    expect(hostPatternFor('')).toBeUndefined();
  });
});

describe('requestHostAccess', () => {
  it('requests each distinct origin once and returns the browser answer', async () => {
    request.mockResolvedValue(true);

    await expect(requestHostAccess(['https://a.example/*', 'https://a.example/*', 'https://b.example/*'])).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: ['https://a.example/*', 'https://b.example/*'] });

    request.mockResolvedValue(false);
    await expect(requestHostAccess(['https://a.example/*'])).resolves.toBe(false);
  });

  it('does not ask the browser when there is nothing valid to request', async () => {
    await expect(requestHostAccess([undefined])).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('treats a rejected request (for example a lost user gesture) as denied', async () => {
    rejectWith = new Error('This function must be called during a user gesture');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(requestHostAccess(['https://a.example/*'])).resolves.toBe(false);
  });

  it('exposes the wildcard patterns declared as optional permissions', () => {
    expect(ALL_SITES_PATTERNS).toEqual(['https://*/*', 'http://*/*']);
  });
});
