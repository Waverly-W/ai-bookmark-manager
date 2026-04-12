import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      sync: {
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

vi.mock('wxt/storage', () => ({
  storage: {
    getItem: vi.fn().mockResolvedValue(undefined),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// 简单的并发控制器测试
class ConcurrencyController {
  private running = 0;
  private queue: Array<() => Promise<any>> = [];

  constructor(private maxConcurrency: number = 1) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrency) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
    }
  }
}

describe('ConcurrencyController', () => {
  it('should limit concurrent executions to maxConcurrency', async () => {
    const controller = new ConcurrencyController(2);
    let maxRunning = 0;
    let currentRunning = 0;

    const task = async () => {
      currentRunning++;
      maxRunning = Math.max(maxRunning, currentRunning);
      await new Promise(resolve => setTimeout(resolve, 10));
      currentRunning--;
    };

    const tasks = Array(5).fill(null).map(() => controller.run(task));
    await Promise.all(tasks);

    expect(maxRunning).toBeLessThanOrEqual(2);
  });

  it('should execute all tasks', async () => {
    const controller = new ConcurrencyController(2);
    let completed = 0;

    const task = async () => {
      completed++;
    };

    const tasks = Array(10).fill(null).map(() => controller.run(task));
    await Promise.all(tasks);

    expect(completed).toBe(10);
  });

  it('should handle single concurrency', async () => {
    const controller = new ConcurrencyController(1);
    let maxRunning = 0;
    let currentRunning = 0;

    const task = async () => {
      currentRunning++;
      maxRunning = Math.max(maxRunning, currentRunning);
      await new Promise(resolve => setTimeout(resolve, 5));
      currentRunning--;
    };

    const tasks = Array(5).fill(null).map(() => controller.run(task));
    await Promise.all(tasks);

    expect(maxRunning).toBe(1);
  });
});

describe('buildEndpoint', () => {
  const buildEndpoint = (apiUrl: string, path: string = 'chat/completions'): string => {
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    return `${baseUrl}/${path}`;
  };

  it('should handle URL without trailing slash', () => {
    const result = buildEndpoint('https://api.openai.com/v1');
    expect(result).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('should handle URL with trailing slash', () => {
    const result = buildEndpoint('https://api.openai.com/v1/');
    expect(result).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('should support custom path', () => {
    const result = buildEndpoint('https://api.openai.com/v1', 'custom/endpoint');
    expect(result).toBe('https://api.openai.com/v1/custom/endpoint');
  });
});

describe('AbortSignal handling', () => {
  it('should detect aborted signal', () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
    
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('should throw error when signal is aborted', async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    const task = async () => {
      if (signal.aborted) {
        throw new Error('Batch rename cancelled');
      }
      return 'success';
    };

    controller.abort();
    
    await expect(task()).rejects.toThrow('Batch rename cancelled');
  });
});

describe('AI connection response handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract reasoning_content when content is empty', async () => {
    const { extractResponseText } = await import('@/lib/aiService');

    const result = extractResponseText({
      content: '',
      reasoning_content: 'The user is asking me to say "Hello"',
      tool_calls: null,
    });

    expect(result).toBe('The user is asking me to say "Hello"');
  });

  it('should treat a completion with reasoning_content as a successful test connection', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [
          {
            finish_reason: 'length',
            message: {
              content: '',
              reasoning_content: 'The user is asking me to say "Hello"',
              tool_calls: null,
            },
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { testAIConnection } = await import('@/lib/aiService');
    const result = await testAIConnection({
      apiUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      modelId: 'mimo-v2-omni',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.message).toContain('Connection successful.');
  });

  it('should keep detailed API errors for the UI', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream proxy rejected request', {
        status: 400,
        statusText: 'Bad Request',
      })
    );

    const { testAIConnection } = await import('@/lib/aiService');
    const result = await testAIConnection({
      apiUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      modelId: 'mimo-v2-omni',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Connection failed');
    expect(result.error).toContain('400 Bad Request');
    expect(result.error).toContain('upstream proxy rejected request');
  });
});
