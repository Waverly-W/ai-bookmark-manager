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

  it('should return an actionable message for network DOMExceptions', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('', 'NetworkError')
    );

    const { testAIConnection } = await import('@/lib/aiService');
    const result = await testAIConnection({
      apiUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      modelId: 'mimo-v2-omni',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('network request failed');
    expect(result.error).not.toContain('[object DOMException]');
  });
});

describe('Responses API compatibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should test connections through the Responses API endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        output_text: 'Hello',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { testAIConnection } = await import('@/lib/aiService');
    const result = await testAIConnection({
      apiUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      modelId: 'gpt-5.1-mini',
      apiType: 'responses',
    } as any);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/v1/responses');
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(requestBody).toMatchObject({
      model: 'gpt-5.1-mini',
      input: 'Reply with exactly "Hello".',
      temperature: 0,
      max_output_tokens: 32,
      store: false,
    });
    expect(result.success).toBe(true);
  });

  it('should execute JSON scenarios through Responses API response text', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        output_text: JSON.stringify({
          recommendations: [
            { folderId: '3', folderPath: '技术/前端' },
          ],
        }),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { recommendFolderWithAI } = await import('@/lib/aiService');
    const result = await recommendFolderWithAI(
      {
        apiUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        modelId: 'gpt-5.1-mini',
        apiType: 'responses',
      } as any,
      'https://react.dev',
      'React',
      ['[ID: 1] 书签栏', '[ID: 2] 技术', '[ID: 3] 技术/前端'],
      'zh_CN',
      { forceRemote: true }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/v1/responses');
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(requestBody.input).toEqual(expect.any(String));
    expect(requestBody.instructions).toEqual(expect.any(String));
    expect(requestBody.text).toEqual({
      format: { type: 'json_object' },
    });
    expect(result.success).toBe(true);
    expect(result.recommendations?.[0].folderId).toBe('3');
  });

  it('should not treat reasoning_text as the final Responses API answer', async () => {
    const { extractAIResponseContent } = await import('@/lib/aiService');

    const result = extractAIResponseContent({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [{
        type: 'reasoning',
        content: [{ type: 'reasoning_text', text: '分析书签命名模式……' }],
      }],
    }, {
      apiUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      modelId: 'deepseek-v4-flash',
      apiType: 'responses',
    } as any);

    expect(result).toBe('');
  });

  it('should report max output token exhaustion instead of a JSON parse error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [{
          type: 'reasoning',
          content: [{ type: 'reasoning_text', text: '分析书签命名模式……' }],
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { renameBookmarkContextuallyWithAI } = await import('@/lib/aiService');
    const result = await renameBookmarkContextuallyWithAI({
      apiUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      modelId: 'deepseek-v4-flash',
      apiType: 'responses',
    } as any, 'https://example.com', 'Example', '工具', [], 'zh_CN');

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(requestBody.max_output_tokens).toBe(256);
    expect(result.success).toBe(false);
    expect(result.error).toContain('max_output_tokens');
    expect(result.error).not.toContain('not valid JSON');
  });
});

describe('AI folder recommendation normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should skip invalid recommendations and return the first valid folder id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  { folderId: 'missing-folder', folderPath: '不存在' },
                  { folderId: '3', folderPath: '技术/前端' },
                ],
              }),
            },
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { recommendFolderWithAI } = await import('@/lib/aiService');
    const result = await recommendFolderWithAI(
      {
        apiUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        modelId: 'mimo-v2-omni',
      },
      'https://react.dev',
      'React',
      ['[ID: 1] 书签栏', '[ID: 2] 技术', '[ID: 3] 技术/前端'],
      'zh_CN',
      { forceRemote: true }
    );

    expect(result.success).toBe(true);
    expect(result.recommendations?.[0].folderId).toBe('3');
  });

  it('should resolve a missing folder id from a matching folder path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  { folderPath: '技术/前端', reason: '内容关于前端开发' },
                ],
              }),
            },
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { recommendFolderWithAI } = await import('@/lib/aiService');
    const result = await recommendFolderWithAI(
      {
        apiUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        modelId: 'mimo-v2-omni',
      },
      'https://react.dev',
      'React',
      ['[ID: 1] 书签栏', '[ID: 2] 技术', '[ID: 3] 技术/前端'],
      'zh_CN',
      { forceRemote: true }
    );

    expect(result.success).toBe(true);
    expect(result.recommendations?.[0]).toMatchObject({
      folderId: '3',
      folderPath: '技术/前端',
      reason: '内容关于前端开发',
    });
  });

  it('should retry with an explicit json instruction when provider rejects json_object requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          error: {
            message: "Response input messages must contain the word 'json' in some form to use '***.format' of type 'json_object'.",
            type: 'invalid_request_error',
          },
        }), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  recommendations: [
                    { folderId: '3', folderPath: '技术/前端' },
                  ],
                }),
              },
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const { recommendFolderWithAI } = await import('@/lib/aiService');
    const result = await recommendFolderWithAI(
      {
        apiUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        modelId: 'mimo-v2-omni',
      },
      'https://react.dev',
      'React',
      ['[ID: 1] 书签栏', '[ID: 2] 技术', '[ID: 3] 技术/前端'],
      'zh_CN',
      { forceRemote: true }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1]!.body as string);
    expect(retryBody.messages[1].content.toLowerCase()).toContain('json');
    expect(result.success).toBe(true);
    expect(result.recommendations?.[0].folderId).toBe('3');
  });

  it('should reject concatenated JSON responses with a useful format error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: '{"commentary":"x"}{"recommendations":[]}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const { recommendFolderWithAI } = await import('@/lib/aiService');
    const result = await recommendFolderWithAI(
      {
        apiUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        modelId: 'mimo-v2-omni',
      },
      'https://react.dev',
      'React',
      ['[ID: 1] 书签栏'],
      'zh_CN',
      { forceRemote: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('exactly one JSON value');
  });

  it('should reject a valid JSON object with an unexpected command field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: '{"cmd":"pwd"}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const { recommendFolderWithAI } = await import('@/lib/aiService');
    const result = await recommendFolderWithAI(
      {
        apiUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        modelId: 'mimo-v2-omni',
      },
      'https://react.dev',
      'React',
      ['[ID: 1] 书签栏'],
      'zh_CN',
      { forceRemote: true }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not match schema');
  });
});

describe('SSE streaming response compatibility', () => {
  const chatConfig = {
    apiUrl: 'https://example.com/v1',
    apiKey: 'test-key',
    modelId: 'gemini-3.8-flash',
  };

  const toEventStream = (events: unknown[], withDone = true) => [
    ...events.map((event) => `data: ${JSON.stringify(event)}\n\n`),
    withDone ? 'data: [DONE]\n\n' : '',
  ].join('');

  const chatChunk = (delta: Record<string, unknown>, finishReason: string | null = null) => ({
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should treat an SSE chat completion stream as a successful test connection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(toEventStream([
        chatChunk({ role: 'assistant' }),
        chatChunk({ content: 'Hello' }),
        chatChunk({}, 'stop'),
      ]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const { testAIConnection } = await import('@/lib/aiService');
    const result = await testAIConnection(chatConfig);

    expect(result.success).toBe(true);
  });

  it('should detect SSE bodies even when the proxy labels them as JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(toEventStream([
        chatChunk({ content: 'Hel' }),
        chatChunk({ content: 'lo' }, 'stop'),
      ]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { testAIConnection } = await import('@/lib/aiService');
    const result = await testAIConnection(chatConfig);

    expect(result.success).toBe(true);
  });

  it('should concatenate streamed JSON deltas for scenarios', async () => {
    const content = JSON.stringify({
      recommendations: [{ folderId: '3', folderPath: '技术/前端' }],
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(toEventStream([
        chatChunk({ content: content.slice(0, 10) }),
        chatChunk({ content: content.slice(10, 30) }),
        chatChunk({ content: content.slice(30) }, 'stop'),
      ]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const { recommendFolderWithAI } = await import('@/lib/aiService');
    const result = await recommendFolderWithAI(
      chatConfig,
      'https://react.dev',
      'React',
      ['[ID: 1] 书签栏', '[ID: 2] 技术', '[ID: 3] 技术/前端'],
      'zh_CN',
      { forceRemote: true }
    );

    expect(result.success).toBe(true);
    expect(result.recommendations?.[0].folderId).toBe('3');
  });

  it('should aggregate Responses API stream events', async () => {
    const { readAIResponseData, extractAIResponseContent } = await import('@/lib/aiApiCompat');
    const config = { ...chatConfig, apiType: 'responses' } as any;
    const body = [
      'event: response.created\ndata: {"type":"response.created","response":{"status":"in_progress","output":[]}}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hel"}\n\n',
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"lo"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed","response":{"status":"completed","output":[]}}\n\n',
    ].join('');

    const data = await readAIResponseData(
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      config
    );

    expect(data).toMatchObject({ status: 'completed' });
    expect(extractAIResponseContent(data, config)).toBe('Hello');
  });

  it('should surface error events inside an SSE stream', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(toEventStream([
        { error: { message: 'model gemini-3.8-flash is overloaded' } },
      ], false), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const { testAIConnection } = await import('@/lib/aiService');
    const result = await testAIConnection(chatConfig);

    expect(result.success).toBe(false);
    expect(result.error).toContain('model gemini-3.8-flash is overloaded');
    expect(result.errorKey).toBeUndefined();
  });

  it('should report a non-JSON body instead of an unknown error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const { testAIConnection } = await import('@/lib/aiService');
    const result = await testAIConnection(chatConfig);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not valid JSON');
    expect(result.error).toContain('502 Bad Gateway');
    expect(result.errorKey).toBeUndefined();
  });
});

describe('Clipper markdown formatting through the unified AI exit', () => {
  const config = {
    apiUrl: 'https://example.com/v1',
    apiKey: 'test-key',
    modelId: 'gemini-3.8-flash',
  };

  const sseCompletion = (content: string, finishReason = 'stop') => new Response([
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: 'assistant', content } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })}\n\n`,
    'data: [DONE]\n\n',
  ].join(''), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });

  const requestInput = (init?: RequestInit): string => {
    const body = JSON.parse(init!.body as string);
    return body.messages[body.messages.length - 1].content;
  };

  // Returns the user input unchanged, so any structural damage comes from our own plumbing.
  const echoModel = () => vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (_url, init) => sseCompletion(requestInput(init))
  );

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should send the clipper prompt through the configured AI endpoint and accept SSE output', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseCompletion('# Title\n\nBody text.'));

    const { formatArticleMarkdownWithAI } = await import('@/lib/aiService');
    const { buildMarkdownFormatInstructions } = await import('@/lib/ai/scenarios/markdownFormat');
    const { getDefaultMarkdownFormatPrompt } = await import('@/lib/aiPromptUtils');
    const result = await formatArticleMarkdownWithAI(config, '# Title\nBody text.');

    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/v1/chat/completions');
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(requestBody.messages[0]).toEqual({
      role: 'system',
      content: buildMarkdownFormatInstructions(getDefaultMarkdownFormatPrompt('zh_CN'), 'zh_CN'),
    });
    expect(requestBody.messages[1]).toEqual({ role: 'user', content: '# Title\nBody text.' });
    expect(requestBody).not.toHaveProperty('max_tokens');
    expect(requestBody).not.toHaveProperty('response_format');
    expect(result).toEqual({ success: true, formattedMarkdown: '# Title\n\nBody text.', warning: null });
  });

  it('should combine the custom clip format prompt with the fixed safety rules', async () => {
    const { browser } = await import('wxt/browser');
    vi.mocked(browser.storage.local.get).mockResolvedValueOnce({
      aiUseCustomMarkdownFormatPrompt: true,
      aiMarkdownFormatPrompt: 'Use sentence case for every heading.',
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseCompletion('# Title'));

    const { formatArticleMarkdownWithAI } = await import('@/lib/aiService');
    await formatArticleMarkdownWithAI(config, '# TITLE', undefined, 'en');

    const systemPrompt = JSON.parse(fetchMock.mock.calls[0][1]!.body as string).messages[0].content;
    expect(systemPrompt).toContain('Use sentence case for every heading.');
    expect(systemPrompt).toContain('Preserve every __W2O_PROTECTED_<index>__ placeholder');
    expect(systemPrompt.indexOf('Preserve every')).toBeLessThan(systemPrompt.indexOf('Use sentence case'));
  });

  it('should fall back to the locale default when no custom clip format prompt is saved', async () => {
    const { getCurrentMarkdownFormatPrompt, DEFAULT_MARKDOWN_FORMAT_PROMPT_EN, DEFAULT_MARKDOWN_FORMAT_PROMPT_ZH } = await import('@/lib/aiPromptUtils');

    await expect(getCurrentMarkdownFormatPrompt('en')).resolves.toBe(DEFAULT_MARKDOWN_FORMAT_PROMPT_EN);
    await expect(getCurrentMarkdownFormatPrompt('zh_CN')).resolves.toBe(DEFAULT_MARKDOWN_FORMAT_PROMPT_ZH);
  });

  it('should keep the original markdown when the model output is truncated', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseCompletion('# Title\n\nBody', 'length'));

    const { formatArticleMarkdownWithAI } = await import('@/lib/aiService');
    const { zhCN } = await import('@/lib/clipper/ui/zh-cn');
    const result = await formatArticleMarkdownWithAI(config, '# Title\nBody text that is long.');

    expect(result.formattedMarkdown).toBe('# Title\nBody text that is long.');
    expect(result.warning).toBe(zhCN.model.unavailable('INCOMPLETE_RESPONSE'));
  });

  it('should split the document into chunks when the provider reports a context length error', async () => {
    const section = (title: string) => `# ${title}\n\n${'Lorem ipsum dolor sit amet. '.repeat(40)}\n\n`;
    const markdown = `${section('First')}${section('Second')}`;
    let calls = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({
          error: { code: 'context_length_exceeded', message: "This model's maximum context length is 128 tokens." },
        }), { status: 400, statusText: 'Bad Request' });
      }
      return sseCompletion(requestInput(init));
    });

    const { formatArticleMarkdownWithAI } = await import('@/lib/aiService');
    const result = await formatArticleMarkdownWithAI(config, markdown);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ success: true, formattedMarkdown: markdown, warning: null });
  });

  it('should keep blank lines around protected blocks when formatting segment by segment', async () => {
    const markdown = 'Intro paragraph.\n\n```ts\nconst x = 1;\n```\n\nOutro paragraph.\n';
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      calls += 1;
      // The first whole-document answer drops the placeholder, forcing the segment fallback.
      return sseCompletion(calls === 1 ? 'Intro paragraph.' : requestInput(init));
    });

    const { formatArticleMarkdownWithAI } = await import('@/lib/aiService');
    const result = await formatArticleMarkdownWithAI(config, markdown);

    expect(calls).toBe(3);
    expect(result).toEqual({ success: true, formattedMarkdown: markdown, warning: null });
  });

  it('should trust the not-configured warning shown by the side panel', async () => {
    const { normalizeModelWarning, zhCN } = await import('@/lib/clipper/ui/zh-cn');

    expect(normalizeModelWarning(zhCN.model.notConfigured)).toBe(zhCN.model.notConfigured);
  });

  it('should echo whole documents without changing them', async () => {
    echoModel();
    const markdown = '---\ntitle: Test\n---\n\n# Heading\n\nText with ![img](__W2O_IMG_0__).\n';

    const { formatArticleMarkdownWithAI } = await import('@/lib/aiService');
    const result = await formatArticleMarkdownWithAI(config, markdown);

    expect(result).toEqual({ success: true, formattedMarkdown: markdown, warning: null });
  });
});
