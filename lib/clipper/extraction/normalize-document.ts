const REMOVABLE_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'button',
  'select',
  'textarea',
].join(',');

const DRAWIO_MACRO_SELECTOR = [
  '[data-macro-name="drawio" i]',
  '[data-macro-name="draw.io" i]',
  '.drawio-embedded-diagram',
].join(',');

const LAZY_IMAGE_ATTRIBUTES = [
  'data-src',
  'data-original',
  'data-lazy-src',
  'data-url',
  'src',
] as const;

const LAZY_SRCSET_ATTRIBUTES = [
  'data-srcset',
  'data-lazy-srcset',
  'srcset',
] as const;

const IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:']);
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const NAVIGATION_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SVG_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type SrcsetCandidate = {
  url: string;
  descriptor: string;
  kind: 'width' | 'density';
  value: number;
};

function isHttpUrl(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function resolveUrl(
  value: string,
  baseUrl: URL,
  allowedProtocols: ReadonlySet<string>,
): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const resolved = new URL(trimmedValue, baseUrl);
    return allowedProtocols.has(resolved.protocol) ? resolved.href : null;
  } catch {
    return null;
  }
}

function parseSrcset(srcset: string): SrcsetCandidate[] {
  const candidates: SrcsetCandidate[] = [];
  let position = 0;

  while (position < srcset.length) {
    while (/[\s,]/.test(srcset[position] ?? '')) {
      position += 1;
    }
    if (position >= srcset.length) {
      break;
    }

    const urlStart = position;
    while (position < srcset.length && !/\s/.test(srcset[position])) {
      position += 1;
    }
    let url = srcset.slice(urlStart, position);

    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
      if (url) {
        candidates.push({
          url,
          descriptor: '',
          kind: 'density',
          value: 1,
        });
      }
      continue;
    }

    while (/\s/.test(srcset[position] ?? '')) {
      position += 1;
    }
    const descriptorStart = position;
    while (position < srcset.length && srcset[position] !== ',') {
      position += 1;
    }
    const descriptor = srcset.slice(descriptorStart, position).trim();
    if (srcset[position] === ',') {
      position += 1;
    }

    const widthMatch = descriptor.match(/^(\d+)w$/);
    const densityMatch = descriptor.match(
      /^((?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)x$/,
    );
    const kind = widthMatch ? 'width' : 'density';
    const value = Number(widthMatch?.[1] ?? densityMatch?.[1] ?? 1);
    const validDescriptor =
      !descriptor ||
      (Boolean(widthMatch || densityMatch) && Number.isFinite(value) && value > 0);

    if (validDescriptor) {
      candidates.push({
        url,
        descriptor,
        kind,
        value,
      });
    }
  }

  const kinds = new Set(candidates.map((candidate) => candidate.kind));
  return kinds.size <= 1 ? candidates : [];
}

function normalizeSrcset(srcset: string, baseUrl: URL): SrcsetCandidate[] {
  return parseSrcset(srcset).flatMap((candidate) => {
    const resolved = resolveUrl(candidate.url, baseUrl, IMAGE_PROTOCOLS);
    return resolved ? [{ ...candidate, url: resolved }] : [];
  });
}

function serializeSrcset(candidates: SrcsetCandidate[]): string {
  return candidates
    .map(({ url, descriptor }) =>
      descriptor.length > 0 ? `${url} ${descriptor}` : url,
    )
    .join(', ');
}

function bestSrcsetCandidate(
  candidates: SrcsetCandidate[],
): SrcsetCandidate | null {
  return candidates.reduce<SrcsetCandidate | null>(
    (best, candidate) =>
      best === null || candidate.value > best.value ? candidate : best,
    null,
  );
}

function firstValidSrcset(
  element: Element,
  attributes: readonly string[],
  baseUrl: URL,
): SrcsetCandidate[] {
  for (const attribute of attributes) {
    const value = element.getAttribute(attribute)?.trim();
    if (!value) {
      continue;
    }

    const candidates = normalizeSrcset(value, baseUrl);
    if (candidates.length > 0) {
      return candidates;
    }
  }

  return [];
}

function selectImageSource(
  element: Element,
  srcsetCandidates: SrcsetCandidate[],
  baseUrl: URL,
): string | null {
  for (const attribute of LAZY_IMAGE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value) {
      continue;
    }

    const resolved = resolveUrl(value, baseUrl, IMAGE_PROTOCOLS);
    if (resolved) {
      return resolved;
    }
  }

  return bestSrcsetCandidate(srcsetCandidates)?.url ?? null;
}

function normalizeHtmlNavigation(element: Element, baseUrl: URL): void {
  const href = element.getAttribute('href');
  if (!href) {
    element.removeAttribute('href');
    return;
  }

  const resolved = resolveUrl(href, baseUrl, NAVIGATION_PROTOCOLS);
  if (resolved) {
    element.setAttribute('href', resolved);
  } else {
    element.removeAttribute('href');
  }
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  element.remove();
}

function replaceDrawioMacroWithPreview(container: Element, baseUrl: URL): void {
  for (const preview of container.querySelectorAll<HTMLImageElement>('img')) {
    const normalizedPreview = preview.cloneNode(true) as HTMLImageElement;
    normalizeImage(normalizedPreview, baseUrl);
    if (normalizedPreview.getAttribute('src')) {
      container.replaceWith(normalizedPreview);
      return;
    }
  }

  container.remove();
}

function normalizeSvgReference(element: Element, baseUrl: URL): void {
  for (const attribute of ['href', 'xlink:href']) {
    const value = element.getAttribute(attribute)?.trim();
    if (!value) {
      element.removeAttribute(attribute);
      continue;
    }
    if (value.startsWith('#')) {
      element.setAttribute(attribute, value);
      continue;
    }

    let resolved: string | null;
    if (element.localName === 'a') {
      resolved = resolveUrl(value, baseUrl, NAVIGATION_PROTOCOLS);
    } else if (element.localName === 'image') {
      resolved = value.toLowerCase().startsWith('data:image/')
        ? resolveUrl(value, baseUrl, new Set(['data:']))
        : resolveUrl(value, baseUrl, SVG_IMAGE_PROTOCOLS);
    } else {
      resolved = resolveUrl(value, baseUrl, HTTP_PROTOCOLS);
    }
    if (resolved) {
      element.setAttribute(attribute, resolved);
    } else {
      element.removeAttribute(attribute);
    }
  }
}

function normalizeImage(image: HTMLImageElement, baseUrl: URL): void {
  const normalizedSrcset = firstValidSrcset(
    image,
    LAZY_SRCSET_ATTRIBUTES,
    baseUrl,
  );

  if (normalizedSrcset.length > 0) {
    image.setAttribute('srcset', serializeSrcset(normalizedSrcset));
  } else {
    image.removeAttribute('srcset');
  }

  const selectedSource = selectImageSource(image, normalizedSrcset, baseUrl);
  if (selectedSource) {
    image.setAttribute('src', selectedSource);
  } else {
    image.removeAttribute('src');
  }
}

function normalizeSource(source: HTMLSourceElement, baseUrl: URL): void {
  const candidates = firstValidSrcset(
    source,
    LAZY_SRCSET_ATTRIBUTES,
    baseUrl,
  );

  if (candidates.length > 0) {
    source.setAttribute('srcset', serializeSrcset(candidates));
  } else {
    source.removeAttribute('srcset');
  }

  const resolved = selectImageSource(source, candidates, baseUrl);
  if (resolved) {
    source.setAttribute('src', resolved);
  } else {
    source.removeAttribute('src');
  }
}

function documentBaseUrl(document: Document, pageUrl: string): URL {
  const fallback = new URL(pageUrl);
  const baseHref = document
    .querySelector('base[href]')
    ?.getAttribute('href')
    ?.trim();
  if (!baseHref) {
    return fallback;
  }

  try {
    const resolved = new URL(baseHref, fallback);
    return isHttpUrl(resolved) ? resolved : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeDocument(document: Document, pageUrl: string): Document {
  const clone = document.cloneNode(true) as Document;
  const baseUrl = documentBaseUrl(clone, pageUrl);

  clone.querySelectorAll(REMOVABLE_SELECTOR).forEach((node) => node.remove());
  clone.querySelectorAll('input').forEach((input) => {
    if (input.getAttribute('type')?.toLowerCase() !== 'checkbox') {
      input.remove();
      return;
    }
    input.disabled = true;
    for (const attribute of Array.from(input.attributes)) {
      if (!['type', 'checked', 'disabled'].includes(attribute.name.toLowerCase())) {
        input.removeAttribute(attribute.name);
      }
    }
  });
  clone.querySelectorAll('form').forEach(unwrapElement);
  clone
    .querySelectorAll('video[autoplay], audio[autoplay]')
    .forEach((media) => media.removeAttribute('autoplay'));
  clone.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  clone
    .querySelectorAll(DRAWIO_MACRO_SELECTOR)
    .forEach((container) => replaceDrawioMacroWithPreview(container, baseUrl));
  clone.querySelectorAll('a, area').forEach((element) => {
    if (element.namespaceURI !== SVG_NAMESPACE) {
      normalizeHtmlNavigation(element, baseUrl);
    }
  });
  clone
    .querySelectorAll('[href], [xlink\\:href]')
    .forEach((element) => {
      if (element.namespaceURI === SVG_NAMESPACE) {
        normalizeSvgReference(element, baseUrl);
      }
    });
  clone.querySelectorAll('img').forEach((image) => normalizeImage(image, baseUrl));
  clone
    .querySelectorAll('source')
    .forEach((source) => normalizeSource(source, baseUrl));

  return clone;
}
