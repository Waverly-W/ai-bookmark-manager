# Template URL Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bookmark-folder-based template URL import with candidate generation, single-candidate import, and edit-before-import flow.

**Architecture:** Keep the import algorithm isolated in `lib/templateUrlImportUtils.ts`, where bookmark URLs are cleaned, bucketed by entry skeleton, clustered conservatively, and turned into import candidates. Reuse the existing template URL page and form dialog for UI, adding one import dialog and one candidate card so the new flow inherits the current theme system and save pipeline.

**Tech Stack:** React 18, TypeScript, WXT browser APIs, `wxt/storage`, existing shadcn-style UI primitives, Vitest

---

## File Map

### Create

- `lib/templateUrlImportUtils.ts`
- `lib/__tests__/templateUrlImportUtils.test.ts`
- `components/template-urls/template-url-import-dialog.tsx`
- `components/template-urls/template-url-import-candidate-card.tsx`

### Modify

- `entrypoints/newtab/template-urls.tsx`
- `components/template-urls/template-url-form-dialog.tsx`
- `locales/zh_CN/common.json`
- `locales/en/common.json`

## Task 1: Import Algorithm

**Files:**
- Create: `lib/templateUrlImportUtils.ts`
- Test: `lib/__tests__/templateUrlImportUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
    buildImportTemplateCandidates,
    sanitizeImportedBookmarkUrl
} from '../templateUrlImportUtils';

const kibanaBookmarks = [
    {
        id: '1',
        title: 'wx channel',
        url: "https://shop-elk.tuhuyun.cn/app/kibana#/discover?_g=(time:(from:'2026-02-05T02:30:00.000Z',to:'2026-02-05T03:00:00.000Z'))&_a=(filters:!((query:(match_phrase:(applicationName:int-website-crm-payment-channel-wx)))))"
    },
    {
        id: '2',
        title: 'payment engine',
        url: "https://shop-elk.tuhuyun.cn/app/kibana#/discover?_g=(time:(from:now-1d,to:now))&_a=(filters:!((query:(match_phrase:(applicationName:PaymentEngine)))))"
    },
    {
        id: '3',
        title: 'cashier core',
        url: "https://shop-elk.tuhuyun.cn/app/kibana#/discover?_g=(time:(from:now-1d,to:now))&_a=(filters:!((query:(match_phrase:(applicationName:CashierCore)))))"
    }
];

describe('templateUrlImportUtils', () => {
    it('sanitizes control characters from imported urls', () => {
        expect(
            sanitizeImportedBookmarkUrl('abc\u001b[118;1:3u123\u001b]11;rgb:2885/2a19/353a\u001b\\xyz')
        ).toBe('abc123xyz');
    });

    it('builds a template candidate from structurally similar bookmarks', () => {
        const candidates = buildImportTemplateCandidates(kibanaBookmarks, '支付监控');

        expect(candidates).toHaveLength(1);
        expect(candidates[0].name).toBe('支付监控 · shop-elk.tuhuyun.cn');
        expect(candidates[0].sampleCount).toBe(3);
        expect(candidates[0].placeholders.length).toBeGreaterThanOrEqual(1);
        expect(candidates[0].urlTemplate).toContain('{');
    });

    it('does not create candidates from a single bookmark', () => {
        expect(buildImportTemplateCandidates([kibanaBookmarks[0]], '支付监控')).toEqual([]);
    });

    it('keeps unrelated structures in separate groups', () => {
        const candidates = buildImportTemplateCandidates([
            ...kibanaBookmarks,
            {
                id: '4',
                title: 'google',
                url: 'https://www.google.com/search?q=codex'
            }
        ], '支付监控');

        expect(candidates).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/__tests__/templateUrlImportUtils.test.ts`
Expected: FAIL because `lib/templateUrlImportUtils.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement:

- URL sanitization that removes ANSI/control garbage from pasted bookmarks
- entry bucket key extraction based on protocol + host + pathname + normalized hash path
- conservative token comparison that only yields a candidate when 2+ bookmarks share the same skeleton
- placeholder generation with `var1`, `var2`, ... fallback names
- default candidate naming with `folderName · domain`

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/__tests__/templateUrlImportUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/templateUrlImportUtils.ts lib/__tests__/templateUrlImportUtils.test.ts
git commit -m "feat: add template url import utils"
```

## Task 2: Import Dialog UI

**Files:**
- Create: `components/template-urls/template-url-import-dialog.tsx`
- Create: `components/template-urls/template-url-import-candidate-card.tsx`
- Modify: `locales/zh_CN/common.json`
- Modify: `locales/en/common.json`

- [ ] **Step 1: Implement the import dialog shell**

Build a dialog with three states:

- `select-folder`
- `scanning`
- `candidates`

Use `SearchableFolderSelect`, existing dialog primitives, inline empty/error states, and responsive card layout consistent with current template UI.

- [ ] **Step 2: Implement candidate cards**

Each candidate card must show:

- default name
- domain
- sample count
- generated template URL
- placeholder badges
- one or two sample URL previews
- `导入` and `编辑后导入` actions

- [ ] **Step 3: Add locale strings**

Add copy for:

- import button
- dialog title/description
- folder selection
- scan button
- scanning state
- empty state
- candidate metadata
- import success/failure

- [ ] **Step 4: Run compile to verify the UI builds**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/template-urls/template-url-import-dialog.tsx components/template-urls/template-url-import-candidate-card.tsx locales/zh_CN/common.json locales/en/common.json
git commit -m "feat: add template url import dialog"
```

## Task 3: Integrate with Template URL Page

**Files:**
- Modify: `entrypoints/newtab/template-urls.tsx`

- [ ] **Step 1: Add import button and dialog state**

Extend the header action row with a secondary `从书签导入` button and state for:

- dialog open/close
- import candidate list refresh
- edit-from-import handoff

- [ ] **Step 2: Wire direct import**

Map an import candidate into `SaveTemplateUrlInput`, reuse `persistTemplateUrl`, refresh list, and remove imported candidates from the dialog list.

- [ ] **Step 3: Run compile to verify page integration**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add entrypoints/newtab/template-urls.tsx
git commit -m "feat: integrate template url import flow"
```

## Task 4: Edit-Before-Import Handoff

**Files:**
- Modify: `components/template-urls/template-url-form-dialog.tsx`
- Modify: `entrypoints/newtab/template-urls.tsx`

- [ ] **Step 1: Extend form dialog input model**

Allow the form dialog to accept either a persisted template or an unsaved draft payload for prefill. Keep the existing save path unchanged so manual create/edit still behaves the same.

- [ ] **Step 2: Wire edit-before-import flow**

When a candidate chooses `编辑后导入`, open the shared form dialog prefilled from the candidate and keep the import dialog context available after save/cancel.

- [ ] **Step 3: Run compile to verify the shared dialog still builds**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/template-urls/template-url-form-dialog.tsx entrypoints/newtab/template-urls.tsx
git commit -m "feat: reuse template form for imported candidates"
```

## Task 5: Final Verification

**Files:**
- Verify all modified files above

- [ ] **Step 1: Run targeted tests**

Run: `npm run test -- lib/__tests__/templateUrlUtils.test.ts lib/__tests__/templateUrlStorage.test.ts lib/__tests__/templateUrlImportUtils.test.ts`
Expected: PASS

- [ ] **Step 2: Run compile**

Run: `npm run compile`
Expected: PASS

- [ ] **Step 3: Verify feature checklist**

Confirm the implementation covers:

- import button on template URL page
- folder-based import
- conservative candidate generation
- direct import
- edit-before-import
- theme-compatible dialog and cards

- [ ] **Step 4: Commit**

```bash
git add lib/templateUrlImportUtils.ts lib/__tests__/templateUrlImportUtils.test.ts components/template-urls/template-url-import-dialog.tsx components/template-urls/template-url-import-candidate-card.tsx components/template-urls/template-url-form-dialog.tsx entrypoints/newtab/template-urls.tsx locales/zh_CN/common.json locales/en/common.json
git commit -m "feat: add template url bookmark import"
```
