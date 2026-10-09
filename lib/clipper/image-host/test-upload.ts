import type { ImageHost } from './types';

// 1×1 透明 PNG
const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export const TEST_IMAGE_FILENAME = 'mustard-seed-connection-test.png';

function testImageBlob(): Blob {
  const binary = atob(TEST_IMAGE_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'image/png' });
}

/** 向图床上传一张 1×1 的测试图片，返回图片的公开地址；会在图床里留下这张图片。 */
export async function uploadTestImage(host: ImageHost, signal?: AbortSignal): Promise<string> {
  return host.upload(
    { blob: testImageBlob(), filename: TEST_IMAGE_FILENAME, contentType: 'image/png' },
    signal,
  );
}
