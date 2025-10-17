import { describe, it, expect, beforeEach, vi } from 'vitest';

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

