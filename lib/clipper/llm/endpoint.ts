export type ModelProtocol = 'chat-completions' | 'responses';

const ENDPOINT_SUFFIXES = ['/v1/chat/completions', '/v1/responses'] as const;

function assertSafeBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TypeError('Model base URL must be a valid HTTP(S) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('Model base URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new TypeError('Model base URL must not contain credentials');
  }
  if (url.search || url.hash) {
    throw new TypeError('Model base URL must not contain a query or fragment');
  }
  return url;
}

export function composeEndpoint(baseUrl: string, protocol: ModelProtocol): string {
  const url = assertSafeBaseUrl(baseUrl);
  let path = url.pathname.replace(/\/+$/, '') || '';
  const target = protocol === 'chat-completions' ? ENDPOINT_SUFFIXES[0] : ENDPOINT_SUFFIXES[1];

  for (const suffix of ENDPOINT_SUFFIXES) {
    if (path.endsWith(suffix)) {
      path = path.slice(0, -suffix.length);
      break;
    }
  }
  path = path.replace(/(?:\/v1)+$/, '');
  url.pathname = `${path}/v1/${protocol === 'chat-completions' ? 'chat/completions' : 'responses'}`;
  return url.href;
}
