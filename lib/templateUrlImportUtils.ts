import { isValidTemplatePlaceholderName, validateTemplateUrl } from '@/lib/templateUrlUtils';

export interface ImportedBookmarkItem {
    id: string;
    title: string;
    url: string;
}

export interface ImportedTemplateCandidate {
    id: string;
    name: string;
    domain: string;
    sampleCount: number;
    urlTemplate: string;
    placeholders: string[];
    sampleUrls: string[];
    sourceBookmarkIds: string[];
}

interface ParsedBookmarkImportItem extends ImportedBookmarkItem {
    sanitizedUrl: string;
    urlObject: URL;
}

interface ReplacementDescriptor {
    key: string;
    kind: 'dsl' | 'query';
    order: number;
}

const ANSI_ESCAPE_PATTERN = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\)|[@-Z\\-_])/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/g;
const DSL_QUOTED_PATTERN = /([?(,])([A-Za-z][A-Za-z0-9_]*:)'([^']*)'/g;
const DSL_UNQUOTED_PATTERN = /([?(,])([A-Za-z][A-Za-z0-9_]*:)([^,)!&'(][^,)!&']*)/g;

const sanitizePlaceholderKey = (key: string): string => {
    if (key === 'from') {
        return 'timeFrom';
    }

    if (key === 'to') {
        return 'timeTo';
    }

    if (key === 'q') {
        return 'query';
    }

    return key;
};

const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildEntryBucketKey = (urlObject: URL): string => {
    const hash = urlObject.hash.startsWith('#') ? urlObject.hash.slice(1) : urlObject.hash;
    const hashPath = hash ? hash.split('?')[0] : '';

    return `${urlObject.protocol}//${urlObject.host}${urlObject.pathname}#${hashPath}`;
};

const buildStructureSignature = (url: string): string => {
    let signature = url;

    signature = signature.replace(
        /([?&][A-Za-z0-9_.-]+=)([^&#()]+)/g,
        '$1{}'
    );
    signature = signature.replace(DSL_QUOTED_PATTERN, '$1$2{}');
    signature = signature.replace(DSL_UNQUOTED_PATTERN, '$1$2{}');

    return signature;
};

const extractDslEntries = (url: string): ReplacementDescriptor[] => {
    const entries: ReplacementDescriptor[] = [];

    for (const pattern of [DSL_QUOTED_PATTERN, DSL_UNQUOTED_PATTERN]) {
        const regex = new RegExp(pattern);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(url)) !== null) {
            entries.push({
                key: match[2].slice(0, -1),
                kind: 'dsl',
                order: match.index
            });
        }
    }

    return entries;
};

const extractSimpleQueryEntries = (urlObject: URL, offset: number): ReplacementDescriptor[] => {
    const entries: ReplacementDescriptor[] = [];

    const searchParams = Array.from(urlObject.searchParams.entries());
    let currentOffset = offset;

    for (const [key, value] of searchParams) {
        if (!value || value.includes('(') || value.includes(')')) {
            currentOffset += key.length + value.length + 2;
            continue;
        }

        entries.push({
            key,
            kind: 'query',
            order: currentOffset
        });
        currentOffset += key.length + value.length + 2;
    }

    return entries;
};

const collectVaryingKeys = (
    items: ParsedBookmarkImportItem[],
    descriptors: ReplacementDescriptor[]
): ReplacementDescriptor[] => {
    const results: ReplacementDescriptor[] = [];
    const seen = new Set<string>();

    for (const descriptor of descriptors.sort((a, b) => a.order - b.order)) {
        const uniqueKey = `${descriptor.kind}:${descriptor.key}`;
        if (seen.has(uniqueKey)) {
            continue;
        }

        seen.add(uniqueKey);

        const values = new Set<string>();
        let appearsInAll = true;

        for (const item of items) {
            if (descriptor.kind === 'query') {
                const value = item.urlObject.searchParams.get(descriptor.key);
                if (!value || value.includes('(') || value.includes(')')) {
                    appearsInAll = false;
                    break;
                }
                values.add(value);
                continue;
            }

            const quotedRegex = new RegExp(`([?(,])${escapeRegExp(descriptor.key)}:'([^']*)'`);
            const quotedMatch = item.sanitizedUrl.match(quotedRegex);

            if (quotedMatch) {
                values.add(quotedMatch[2]);
                continue;
            }

            const plainRegex = new RegExp(`([?(,])${escapeRegExp(descriptor.key)}:([^,)!&'(][^,)!&']*)`);
            const plainMatch = item.sanitizedUrl.match(plainRegex);

            if (!plainMatch) {
                appearsInAll = false;
                break;
            }

            values.add(plainMatch[2]);
        }

        if (appearsInAll && values.size > 1) {
            results.push(descriptor);
        }
    }

    return results;
};

const createPlaceholderName = (key: string, usedNames: Set<string>, index: number): string => {
    const preferred = sanitizePlaceholderKey(key);

    if (isValidTemplatePlaceholderName(preferred) && !usedNames.has(preferred)) {
        usedNames.add(preferred);
        return preferred;
    }

    const fallback = `var${index}`;
    usedNames.add(fallback);
    return fallback;
};

const applyQueryReplacement = (template: string, key: string, placeholder: string): string => {
    const regex = new RegExp(`([?&]${escapeRegExp(key)}=)([^&#()]+)`, 'g');
    return template.replace(regex, `$1{${placeholder}}`);
};

const applyDslReplacement = (template: string, key: string, placeholder: string): string => {
    const quotedRegex = new RegExp(`([?(,])(${escapeRegExp(key)}:)'([^']*)'`, 'g');
    const withQuoted = template.replace(quotedRegex, `$1$2'{${placeholder}}'`);
    const plainRegex = new RegExp(`([?(,])(${escapeRegExp(key)}:)([^,)!&'(][^,)!&']*)`, 'g');

    return withQuoted.replace(plainRegex, `$1$2{${placeholder}}`);
};

const buildCandidateFromGroup = (
    items: ParsedBookmarkImportItem[],
    folderName: string
): ImportedTemplateCandidate | null => {
    if (items.length < 2) {
        return null;
    }

    const base = items[0];
    const descriptors = [
        ...extractDslEntries(base.sanitizedUrl),
        ...extractSimpleQueryEntries(base.urlObject, base.sanitizedUrl.indexOf('?') >= 0 ? base.sanitizedUrl.indexOf('?') : base.sanitizedUrl.length)
    ];
    const varyingKeys = collectVaryingKeys(items, descriptors);

    if (varyingKeys.length === 0) {
        return null;
    }

    const usedNames = new Set<string>();
    const placeholders: string[] = [];
    let urlTemplate = base.sanitizedUrl;

    varyingKeys.forEach((descriptor, index) => {
        const placeholder = createPlaceholderName(descriptor.key, usedNames, index + 1);
        placeholders.push(placeholder);
        urlTemplate = descriptor.kind === 'query'
            ? applyQueryReplacement(urlTemplate, descriptor.key, placeholder)
            : applyDslReplacement(urlTemplate, descriptor.key, placeholder);
    });

    const validation = validateTemplateUrl(`${folderName} · ${base.urlObject.host}`, urlTemplate);
    if (!validation.isValid) {
        return null;
    }

    return {
        id: `${buildEntryBucketKey(base.urlObject)}:${items.map((item) => item.id).join(',')}`,
        name: `${folderName} · ${base.urlObject.host}`,
        domain: base.urlObject.host,
        sampleCount: items.length,
        urlTemplate,
        placeholders,
        sampleUrls: items.slice(0, 2).map((item) => item.sanitizedUrl),
        sourceBookmarkIds: items.map((item) => item.id)
    };
};

export const sanitizeImportedBookmarkUrl = (url: string): string =>
    url
        .replace(ANSI_ESCAPE_PATTERN, '')
        .replace(CONTROL_CHAR_PATTERN, '')
        .trim();

export const buildImportTemplateCandidates = (
    bookmarks: ImportedBookmarkItem[],
    folderName: string
): ImportedTemplateCandidate[] => {
    const parsedItems: ParsedBookmarkImportItem[] = [];

    for (const bookmark of bookmarks) {
        const sanitizedUrl = sanitizeImportedBookmarkUrl(bookmark.url);

        try {
            parsedItems.push({
                ...bookmark,
                sanitizedUrl,
                urlObject: new URL(sanitizedUrl)
            });
        } catch {
            continue;
        }
    }

    const grouped = new Map<string, ParsedBookmarkImportItem[]>();

    for (const item of parsedItems) {
        const key = `${buildEntryBucketKey(item.urlObject)}::${buildStructureSignature(item.sanitizedUrl)}`;
        const existing = grouped.get(key) || [];
        existing.push(item);
        grouped.set(key, existing);
    }

    const candidates: ImportedTemplateCandidate[] = [];

    for (const group of grouped.values()) {
        const candidate = buildCandidateFromGroup(group, folderName);

        if (candidate) {
            candidates.push(candidate);
        }
    }

    return candidates;
};
