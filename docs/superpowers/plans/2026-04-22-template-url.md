# Template URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-version Template URL top-level page in the new tab sidebar with template CRUD, validation, and search execution.

**Architecture:** Keep business rules in `lib/templateUrlUtils.ts` and `lib/templateUrlStorage.ts`, then build the UI as a list page plus two dialogs that reuse the existing card, button, dialog, input, label, select, and theme patterns. Route the page through the existing `SidebarType` switch so desktop and mobile navigation stay aligned with the current theme system.

**Tech Stack:** React 18, TypeScript, WXT browser APIs, `wxt/storage`, Tailwind utilities, shadcn-style UI primitives, Vitest

---

## File Map

### Create

- `lib/templateUrlUtils.ts`
- `lib/templateUrlStorage.ts`
- `lib/__tests__/templateUrlUtils.test.ts`
- `lib/__tests__/templateUrlStorage.test.ts`
- `components/template-urls/template-url-card.tsx`
- `components/template-urls/template-url-list.tsx`
- `components/template-urls/template-url-form-dialog.tsx`
- `components/template-urls/template-url-run-dialog.tsx`
- `entrypoints/newtab/template-urls.tsx`

### Modify

- `entrypoints/sidebar.tsx`
- `entrypoints/newtab/App.tsx`
- `locales/zh_CN/common.json`
- `locales/en/common.json`

## Task 1: Template URL Pure Logic

**Files:**
- Create: `lib/templateUrlUtils.ts`
- Test: `lib/__tests__/templateUrlUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
    TEMPLATE_URL_PLACEHOLDER_PATTERN,
    buildTemplateUrl,
    extractTemplatePlaceholders,
    isValidTemplatePlaceholderName,
    validateTemplateUrl
} from '../templateUrlUtils';

describe('templateUrlUtils', () => {
    it('extracts unique placeholders while preserving order', () => {
        expect(
            extractTemplatePlaceholders('https://example.com?q={keyword}&source={keyword}&city={city}')
        ).toEqual(['keyword', 'city']);
    });

    it('rejects invalid placeholder names', () => {
        expect(isValidTemplatePlaceholderName('keyword')).toBe(true);
        expect(isValidTemplatePlaceholderName('1keyword')).toBe(false);
        expect(isValidTemplatePlaceholderName('keyword-name')).toBe(false);
    });

    it('validates template urls with placeholders', () => {
        expect(
            validateTemplateUrl('Search', 'https://example.com/search?q={keyword}')
        ).toEqual({ isValid: true, errors: [], placeholders: ['keyword'] });
    });

    it('returns validation errors for malformed placeholders', () => {
        const result = validateTemplateUrl('Search', 'https://example.com/search?q={keyword-name}');
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('placeholder');
    });

    it('builds the final encoded url from inputs', () => {
        expect(
            buildTemplateUrl('https://example.com/search?q={keyword}&city={city}', {
                keyword: 'hello world',
                city: 'shanghai/浦东'
            })
        ).toBe('https://example.com/search?q=hello%20world&city=shanghai%2F%E6%B5%A6%E4%B8%9C');
    });

    it('supports templates without placeholders', () => {
        expect(buildTemplateUrl('https://example.com/docs', {})).toBe('https://example.com/docs');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/__tests__/templateUrlUtils.test.ts`
Expected: FAIL because `lib/templateUrlUtils.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export const TEMPLATE_URL_PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

export interface TemplateUrlValidationResult {
    isValid: boolean;
    errors: string[];
    placeholders: string[];
}

export const isValidTemplatePlaceholderName = (name: string): boolean =>
    /^[A-Za-z][A-Za-z0-9_]*$/.test(name);

export const extractTemplatePlaceholders = (template: string): string[] => {
    const seen = new Set<string>();
    const placeholders: string[] = [];
    let match: RegExpExecArray | null;
    const regex = new RegExp(TEMPLATE_URL_PLACEHOLDER_PATTERN);

    while ((match = regex.exec(template)) !== null) {
        const placeholder = match[1];
        if (!seen.has(placeholder)) {
            seen.add(placeholder);
            placeholders.push(placeholder);
        }
    }

    return placeholders;
};

export const validateTemplateUrl = (name: string, template: string): TemplateUrlValidationResult => {
    const errors: string[] = [];

    if (!name.trim()) {
        errors.push('Template name is required');
    }

    if (!template.trim()) {
        errors.push('Template URL is required');
        return { isValid: false, errors, placeholders: [] };
    }

    const invalidMatches = template.match(/\{[^}]*\}/g) || [];
    const invalidPlaceholder = invalidMatches.find((match) => {
        const placeholderName = match.slice(1, -1);
        return !isValidTemplatePlaceholderName(placeholderName);
    });

    if (invalidPlaceholder) {
        errors.push(`Invalid placeholder: ${invalidPlaceholder}`);
    }

    const sanitized = template.replace(/\{[^}]+\}/g, 'example');

    try {
        new URL(sanitized);
    } catch {
        errors.push('Template URL is invalid');
    }

    return {
        isValid: errors.length === 0,
        errors,
        placeholders: extractTemplatePlaceholders(template)
    };
};

export const buildTemplateUrl = (template: string, values: Record<string, string>): string =>
    template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, key: string) =>
        encodeURIComponent(values[key] ?? '')
    );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/__tests__/templateUrlUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/templateUrlUtils.ts lib/__tests__/templateUrlUtils.test.ts
git commit -m "feat: add template url utils"
```

## Task 2: Template URL Storage

**Files:**
- Create: `lib/templateUrlStorage.ts`
- Test: `lib/__tests__/templateUrlStorage.test.ts`
- Depends on: `lib/templateUrlUtils.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageState = new Map<string, any>();

vi.mock('wxt/storage', () => ({
    storage: {
        getItem: vi.fn(async (key: string) => storageState.get(key)),
        setItem: vi.fn(async (key: string, value: unknown) => {
            storageState.set(key, value);
        })
    }
}));

import {
    deleteTemplateUrl,
    getTemplateUrlById,
    getTemplateUrls,
    saveTemplateUrl
} from '../templateUrlStorage';

describe('templateUrlStorage', () => {
    beforeEach(() => {
        storageState.clear();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-22T10:00:00Z'));
    });

    it('returns an empty list by default', async () => {
        expect(await getTemplateUrls()).toEqual([]);
    });

    it('creates and reads a template', async () => {
        const template = await saveTemplateUrl({
            name: 'Google Search',
            description: 'Search the web',
            urlTemplate: 'https://google.com/search?q={keyword}',
            openMode: 'new-tab'
        });

        expect(template.placeholders).toEqual(['keyword']);
        expect((await getTemplateUrls())[0].name).toBe('Google Search');
    });

    it('updates an existing template while preserving createdAt', async () => {
        const created = await saveTemplateUrl({
            name: 'Docs',
            description: '',
            urlTemplate: 'https://example.com/docs?q={keyword}',
            openMode: 'new-tab'
        });

        vi.setSystemTime(new Date('2026-04-22T11:00:00Z'));

        const updated = await saveTemplateUrl({
            id: created.id,
            name: 'Docs Search',
            description: 'Updated',
            urlTemplate: 'https://example.com/docs?q={keyword}&lang={lang}',
            openMode: 'current-tab'
        });

        expect(updated.createdAt).toBe(created.createdAt);
        expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
        expect(updated.placeholders).toEqual(['keyword', 'lang']);
    });

    it('deletes templates by id', async () => {
        const created = await saveTemplateUrl({
            name: 'Docs',
            description: '',
            urlTemplate: 'https://example.com/docs',
            openMode: 'new-tab'
        });

        await deleteTemplateUrl(created.id);

        expect(await getTemplateUrlById(created.id)).toBeNull();
        expect(await getTemplateUrls()).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/__tests__/templateUrlStorage.test.ts`
Expected: FAIL because `lib/templateUrlStorage.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
import { storage } from 'wxt/storage';
import { extractTemplatePlaceholders } from './templateUrlUtils';

export type TemplateUrlOpenMode = 'new-tab' | 'current-tab';

export interface TemplateUrlItem {
    id: string;
    name: string;
    description?: string;
    urlTemplate: string;
    placeholders: string[];
    openMode: TemplateUrlOpenMode;
    createdAt: number;
    updatedAt: number;
}

export interface SaveTemplateUrlInput {
    id?: string;
    name: string;
    description?: string;
    urlTemplate: string;
    openMode: TemplateUrlOpenMode;
}

export const TEMPLATE_URL_STORAGE_KEY = 'local:templateUrls';

export const getTemplateUrls = async (): Promise<TemplateUrlItem[]> => {
    const items = await storage.getItem<TemplateUrlItem[]>(TEMPLATE_URL_STORAGE_KEY);
    return (items || []).sort((a, b) => b.updatedAt - a.updatedAt);
};

export const getTemplateUrlById = async (id: string): Promise<TemplateUrlItem | null> => {
    const items = await getTemplateUrls();
    return items.find((item) => item.id === id) || null;
};

export const saveTemplateUrl = async (input: SaveTemplateUrlInput): Promise<TemplateUrlItem> => {
    const items = await getTemplateUrls();
    const now = Date.now();
    const existing = input.id ? items.find((item) => item.id === input.id) : undefined;

    const nextItem: TemplateUrlItem = {
        id: existing?.id || crypto.randomUUID(),
        name: input.name.trim(),
        description: input.description?.trim() || '',
        urlTemplate: input.urlTemplate.trim(),
        placeholders: extractTemplatePlaceholders(input.urlTemplate),
        openMode: input.openMode,
        createdAt: existing?.createdAt || now,
        updatedAt: now
    };

    const nextItems = existing
        ? items.map((item) => item.id === existing.id ? nextItem : item)
        : [nextItem, ...items];

    await storage.setItem(TEMPLATE_URL_STORAGE_KEY, nextItems);
    return nextItem;
};

export const deleteTemplateUrl = async (id: string): Promise<void> => {
    const items = await getTemplateUrls();
    await storage.setItem(
        TEMPLATE_URL_STORAGE_KEY,
        items.filter((item) => item.id !== id)
    );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/__tests__/templateUrlStorage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/templateUrlStorage.ts lib/__tests__/templateUrlStorage.test.ts
git commit -m "feat: add template url storage"
```

## Task 3: Navigation, Locale, and Page Shell

**Files:**
- Modify: `entrypoints/sidebar.tsx`
- Modify: `entrypoints/newtab/App.tsx`
- Modify: `locales/zh_CN/common.json`
- Modify: `locales/en/common.json`
- Create: `entrypoints/newtab/template-urls.tsx`

- [ ] **Step 1: Write the failing tests or compile check**

There is no existing UI test harness for these entrypoints. Use TypeScript compile as the red/green gate for structural changes after the `lib` tests are already in place.

- [ ] **Step 2: Implement the page shell and routing**

Create `entrypoints/newtab/template-urls.tsx` with a themed page header, empty state card, and list area that reads templates from storage. Add `SidebarType.templateUrls`, route rendering, and localized labels in both locale files.

- [ ] **Step 3: Run compile to verify the shell builds**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add entrypoints/sidebar.tsx entrypoints/newtab/App.tsx entrypoints/newtab/template-urls.tsx locales/zh_CN/common.json locales/en/common.json
git commit -m "feat: add template url page shell"
```

## Task 4: Template Cards and Form Dialog

**Files:**
- Create: `components/template-urls/template-url-card.tsx`
- Create: `components/template-urls/template-url-list.tsx`
- Create: `components/template-urls/template-url-form-dialog.tsx`
- Modify: `entrypoints/newtab/template-urls.tsx`

- [ ] **Step 1: Implement the list and card components**

Build themed cards using the existing `Card`, `Button`, `Badge`, and `useTheme` patterns from `statistics.tsx` and `tools.tsx`. Keep desktop and mobile layouts responsive and consistent with current rounded, bordered surfaces.

- [ ] **Step 2: Implement the create/edit dialog**

Build a shared dialog form with inline validation, live placeholder badges, default open-mode selection, and save handling through `saveTemplateUrl`.

- [ ] **Step 3: Run compile to verify the UI builds**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/template-urls/template-url-card.tsx components/template-urls/template-url-list.tsx components/template-urls/template-url-form-dialog.tsx entrypoints/newtab/template-urls.tsx
git commit -m "feat: add template url management ui"
```

## Task 5: Run Dialog and Browser Execution

**Files:**
- Create: `components/template-urls/template-url-run-dialog.tsx`
- Modify: `entrypoints/newtab/template-urls.tsx`

- [ ] **Step 1: Implement the run dialog**

Render dynamic inputs from `template.placeholders`, show the generated URL preview, expose temporary open-mode override, and disable submit until required values exist.

- [ ] **Step 2: Implement browser tab opening**

Use `browser.tabs.query` and `browser.tabs.update` for current-tab mode with a fallback to `browser.tabs.create` when the active tab is unavailable or unsuitable.

- [ ] **Step 3: Run compile to verify the execution flow builds**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/template-urls/template-url-run-dialog.tsx entrypoints/newtab/template-urls.tsx
git commit -m "feat: add template url execution flow"
```

## Task 6: Final Verification

**Files:**
- Verify all modified files above

- [ ] **Step 1: Run targeted tests**

Run: `npm run test -- lib/__tests__/templateUrlUtils.test.ts lib/__tests__/templateUrlStorage.test.ts`
Expected: PASS

- [ ] **Step 2: Run TypeScript compile**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 3: Review against the spec**

Confirm the implementation covers:
- top-level sidebar entry
- template CRUD
- inline validation
- execution dialog
- final URL preview
- theme-compatible surfaces and controls

- [ ] **Step 4: Commit**

```bash
git add lib/templateUrlUtils.ts lib/templateUrlStorage.ts lib/__tests__/templateUrlUtils.test.ts lib/__tests__/templateUrlStorage.test.ts components/template-urls entrypoints/sidebar.tsx entrypoints/newtab/App.tsx entrypoints/newtab/template-urls.tsx locales/zh_CN/common.json locales/en/common.json
git commit -m "feat: add template url workspace"
```
