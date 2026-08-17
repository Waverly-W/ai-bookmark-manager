export interface ImagePermissionReference {
  token: string;
  sourceUrl: string;
}

export interface ImageOriginsPermissionApi {
  contains(details: { origins: string[] }): Promise<boolean>;
  request(details: { origins: string[] }): Promise<boolean>;
}

export function collectImageOriginPatterns(
  references: readonly ImagePermissionReference[],
  markdown: string,
): { origins: string[]; rejectedSourceUrls: string[] } {
  const origins = new Set<string>();
  const rejectedSourceUrls: string[] = [];
  for (const reference of references) {
    if (!markdown.includes(reference.token)) continue;
    let url: URL;
    try {
      url = new URL(reference.sourceUrl);
    } catch {
      rejectedSourceUrls.push(reference.sourceUrl);
      continue;
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') continue;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      rejectedSourceUrls.push(reference.sourceUrl);
      continue;
    }
    origins.add(`${url.origin}/*`);
  }
  return { origins: [...origins], rejectedSourceUrls };
}

export async function findMissingImageOrigins(
  origins: readonly string[],
  permissions: ImageOriginsPermissionApi,
): Promise<string[]> {
  const missing: string[] = [];
  for (const origin of origins) {
    let granted = false;
    try {
      granted = await permissions.contains({ origins: [origin] });
    } catch {
      granted = false;
    }
    if (!granted) missing.push(origin);
  }
  return missing;
}

export async function requestFrozenImageOrigins(
  frozenOrigins: readonly string[],
  permissions: ImageOriginsPermissionApi,
): Promise<{ granted: string[]; denied: string[] }> {
  const origins = [...frozenOrigins];
  if (origins.length === 0) return { granted: [], denied: [] };
  // Keep this as the first asynchronous browser call. Callers invoke this
  // function directly from the confirmation button's click stack.
  const requested = permissions.request({ origins });
  try {
    await requested;
  } catch {
    // A browser-level rejection is treated like denial and verified below.
  }
  const denied = await findMissingImageOrigins(origins, permissions);
  const deniedSet = new Set(denied);
  return { granted: origins.filter((origin) => !deniedSet.has(origin)), denied };
}
