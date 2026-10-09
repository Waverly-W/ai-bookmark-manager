export interface ModelRequest {
  instructions: string;
  input: string;
  signal?: AbortSignal;
}

export interface ModelResponse {
  text: string;
}

export interface ModelClient {
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export interface ProviderErrorOptions {
  status?: number;
  code: string;
}

export class ProviderError extends Error {
  readonly status?: number;
  readonly code: string;

  constructor(message: string, options: ProviderErrorOptions) {
    super(message);
    this.name = 'ProviderError';
    this.status = options.status;
    this.code = options.code;
  }
}

export function contextLengthExceeded(status: number, code: string, message: string): boolean {
  if (status !== 400) return false;
  if (/context[_-]?length[_-]?exceeded|context[_-]?window[_-]?exceeded/i.test(code)) return true;
  return /maximum context length|context length.{0,40}(?:exceed|too (?:long|large))|too many tokens|reduce (?:the )?(?:length|number) of (?:the )?(?:messages|tokens)/i.test(message);
}
