export interface ImageUpload {
  blob: Blob;
  filename: string;
  contentType: string;
}

export interface ImageHost {
  upload(image: ImageUpload, signal?: AbortSignal): Promise<string>;
}

export class ImageHostUploadError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'ImageHostUploadError';
    this.retryable = retryable;
  }
}

export type ImageHostFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
