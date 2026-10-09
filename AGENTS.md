# Repository Guidelines

## Project Structure & Module Organization
This repository is a WXT-based browser extension (Chrome MV3, Firefox MV2). Runtime entrypoints live in `entrypoints/`: `popup/` for quick-save UI, `newtab/` for the main dashboard and tools, `sidepanel/` for the Obsidian clipper, and `background.ts` for extension background logic. Shared React UI is in `components/`, with reusable primitives under `components/ui/` and settings screens under `components/settings/`. Business logic and storage helpers live in `lib/`, custom hooks in `hooks/`, translations in `locales/`, and static extension assets in `public/` and `assets/`. Tests live in `lib/__tests__/`. User-facing docs live in `README.md`, `docs/`, and the UI rules in `FRONTEND.md` and `DESIGN.md`.

## Architecture Map
Read this before touching a module; it records decisions that are not obvious from the code.

- `lib/aiService.ts`: the single exit for every AI request. `callAIAPI` builds the request, retries, parses the response and normalizes errors. Scenarios in `lib/ai/scenarios/` define prompts and response schemas; `executeScenario` runs them. `lib/aiApiCompat.ts` holds the shared request/response helpers used by `lib/folderRecommendation.ts`.
- `lib/clipper/`: the web clipper (Obsidian). `jobs/` is the job state machine and orchestrator (IndexedDB via Dexie), `extraction/` reads the page, `markdown/` converts to Markdown, `llm/formatter.ts` formats Markdown through the AI exit with placeholder protection, `image-host/` uploads to PicGo or Cloudflare R2, `vault/` writes to the local vault, `settings/` is the zod-validated settings repository, `ui/` holds persisted-string helpers.
- `lib/hostAccess.ts`: runtime host-permission requests (see Permissions).
- `lib/bookmarkTrash.ts`: delete-with-snapshot and restore for undo.
- `lib/i18nLocale.ts`: language resolution shared by every entrypoint.
- Known duplication: `lib/aiService.ts` still carries its own copies of some helpers that also exist in `lib/aiApiCompat.ts`. Keep them in sync or consolidate; do not diverge them silently. Ignore `lib/aiService.ts.bak`.

## Build, Test, and Development Commands
Use `npm install` with Node 18+ to install dependencies. Key scripts:

- `npm run dev`: start the Chrome extension in WXT dev mode.
- `npm run dev:firefox`: run the Firefox variant locally.
- `npm run build`: produce a production build in `dist/`.
- `npm run build:firefox`: build the Firefox package.
- `npm run zip`: create a distributable extension zip.
- `npm run compile`: run TypeScript type-checking with no emit.
- `npm run test`: run Vitest tests.
- `npm run test:coverage`: generate text, JSON, and HTML coverage reports.
- `npm run screenshots`: regenerate `docs/screenshots/*.png` from a fresh `npm run build:chrome` (see Verifying UI in a Real Browser).

## Coding Style & Naming Conventions
TypeScript and React are the default. Follow the existing style in the touched file: many app files use 4-space indentation, while tests and newer utility files often use 2 spaces; avoid reformatting unrelated code. Use `PascalCase` for React components, `camelCase` for functions and hooks, and `kebab-case` for most file names such as `folder-recommendation-settings.tsx`. Prefer the `@/` alias for internal imports. Tailwind utilities and shadcn/ui components are configured through `assets/main.css`, `tailwind.config.js`, and `components.json`. Do not use emoji in documentation, code comments, or UI copy.

## AI Requests
- Send every AI request through `callAIAPI` (directly or via `executeScenario` / `generateAIText`). Do not add a second client with its own `fetch`.
- Never call `response.json()` on an AI response. Some OpenAI-compatible gateways return Server-Sent Events even when `stream` is not requested, which makes `response.json()` throw and surfaces as an "unknown error". Use `readAIResponseData` from `lib/aiApiCompat.ts`; it reads plain JSON, Chat Completions chunks, and Responses API events.
- Errors are `AIRuntimeError` with a `code` (`cancelled`, `timeout`, `network`, `http`, `incomplete`, `response_format`, `unknown`). Show the real message to the user; only fall back to a generic string when the message is empty.
- Plain-text output (for example Markdown formatting) passes `maxTokens: null` (no cap) and `requireComplete: true`, so a truncated answer is rejected instead of being written into a note. JSON scenarios keep an explicit token budget.
- The clipper has no model settings of its own. It reads the AI service configured in AI Settings and only keeps clipper-specific switches.

## Prompts
- A prompt is split into a fixed system part (rules the user cannot break, such as placeholder protection and "output only Markdown") and an editable user part. Combine them in code (`buildMarkdownFormatInstructions`) with the fixed rules first.
- Each editable prompt has default text per locale in `lib/aiPromptUtils.ts`, a storage key pair (`ai<Name>Prompt` and `aiUseCustom<Name>Prompt`), get/save/restore/isUsingCustom helpers, a tab in `components/settings/ai-prompt-settings.tsx`, and an entry in the WebDAV backup map in `lib/webdavSync.ts`. Adding a prompt means touching all of them.

## Settings and Persisted Data
- Validate persisted settings with zod and unknown fields are dropped on load. To retire or reverse a stored default, rename the field and give the new one a safe `.default(...)`; old values are then ignored without a migration. `autoFormatWithAI` replaced `automaticFormatting` this way.
- Anything that sends page content to a third party must be opt-in and default to off, with a visible switch and a description of the cost.
- Persisted strings such as clipper warnings are stored in one language. Localize them at display time through an allow-list mapping (`lib/clipper/ui/warnings.ts`); never render stored model text directly.
- Save through the repository mutators (`saveImageHost`, `saveClipping`), which re-read the latest data under a lock, instead of writing back a whole object held in component state.
- Secrets are write-only in the UI: do not fill saved keys back into inputs; a blank field means "keep the saved value" (`resolveImageHostDraft`).

## Permissions
- Chrome builds declare no install-time host permissions, only `optional_host_permissions`. Firefox declares them in `permissions`. See `wxt.config.ts`.
- A feature that talks to a site requests it from the click that starts the feature with `requestHostAccess(...)` from `lib/hostAccess.ts`. The browser only grants a request made during a user gesture, so it must be the first asynchronous call in the handler: start the request before any `await`, then `await` its result afterwards. Already-granted sites return `true` without prompting, so no pre-check is needed.
- Current request points: AI service (AI Settings and wizard), image host (Obsidian settings save and test), WebDAV (every action that persists the config), link validity scan (all sites), and the side panel ("allow access" when a page cannot be read). A new feature that fetches a new site needs one too.
- Show a clear message when access is denied; do not fail silently.

## Internationalization
- Every user-visible string goes through `t()`. Add keys to both `locales/en/` and `locales/zh_CN/` in the same change and keep the key sets identical (a missing key renders the raw key name). Use a feature prefix for new keys (`clip*`, `obsidian*`, `hostAccess*`).
- Entrypoints resolve the language with `loadInitialLocale()` (saved setting, then browser language, then default) and call `applyDocumentLocale` so `<title>` and `lang` follow it. Do not hard-code the default locale in a `main.tsx`.
- Do not build translated sentences by string replacement (for example replacing a verb in another key); add a dedicated key.

## UI and Interaction Rules
Visual tokens and component rules are in `FRONTEND.md` and `DESIGN.md`. In addition:

- Theme differences are driven by `<html data-theme-id>` through Tailwind variants: write `blueprint:rounded-[var(--card-radius)]` or `classic:surface-subtle`. Do not read `themeId` in components to build class names. Every new surface must be checked in both themes and in dark mode.
- Tailwind 3 only generates opacity steps that exist in the theme. A class such as `bg-card/96` silently does nothing unless `96` is in `tailwind.config.js` (`theme.extend.opacity`). After using a new step, confirm the class appears in the built CSS.
- Minimum font size is 12px (`text-xs`). Do not use `text-[10px]` or `text-[11px]`.
- Icon-only buttons need an `aria-label`. Inputs need a `<label htmlFor>`. Status regions use `role="status"` or `role="alert"`.
- Errors that need action are shown in a persistent banner that wraps text and offers copy and dismiss. Do not truncate them to one line and do not leave failures only in `console`. An AI action that fails or returns nothing must tell the user.
- Destructive actions use `useConfirmDialog` (`components/ui/confirm-dialog.tsx`) and then offer undo: delete through `deleteBookmarkWithSnapshot`, and show `undoToastAction` for `UNDO_TOAST_DURATION_MS`. Never use `window.confirm` or `alert`.
- One primary action per surface. When a prerequisite is missing (for example no vault selected), make the primary button perform that prerequisite step explicitly instead of triggering it implicitly in the middle of another action.
- Layouts must work at narrow widths (settings collapse to a top menu below `lg`); do not use fixed sidebar widths without a breakpoint.

## Testing Guidelines
Vitest is configured in `vitest.config.ts` with a Node environment and V8 coverage. Add tests alongside the relevant domain under `lib/__tests__/`, using `*.test.ts` naming. Cover pure logic, storage behavior, and edge cases; browser API integrations should be isolated or mocked (mock `wxt/browser`). Put logic you want to test in `lib/` as pure functions and keep components thin. Run `npm run test` and `npm run compile` before opening a PR and `npm run test:coverage` for larger refactors.

Pitfalls found while writing tests:
- `vi.fn()` tracks the promise a mock returns, so `mockRejectedValue(...)` is reported as an unhandled rejection even when the code under test catches it. Use a plain function for rejecting mocks.
- A test for a bug fix should fail against the old code. Revert the fix temporarily and confirm the test fails.
- Run with `// @vitest-environment jsdom` only when the code needs a DOM (for example Readability).

## Verifying UI in a Real Browser
Unit tests do not cover layout, theming, i18n, or permissions. Load the built extension into Chrome and look at the real pages.

- Chrome 137+ branded builds ignore `--load-extension`. Launch with `--remote-debugging-pipe --enable-unsafe-extension-debugging` and send the CDP command `Extensions.loadUnpacked`. `scripts/capture-screenshots.mjs` contains a working client.
- The extension ID of an unpacked build is derived from its absolute path (first 32 hex digits of the SHA-256, mapped to `a`-`p`), so it is stable per checkout.
- Open extension pages as tabs (`chrome-extension://<id>/popup.html`, `newtab.html`, `sidepanel.html`). To make the popup or side panel read a real page, keep the article tab in the foreground and open the extension page with `background: true`; use a foreground tab for pages with CSS animations, because background tabs pause them and screenshots come out faded.
- Radix tabs switch on `mousedown`, not `click`.
- To test features that read pages without the optional permission being granted, load a copy of `dist/chrome-mv3` whose manifest adds `host_permissions`; the shipped manifest must stay permission-free.
- `npm run screenshots` regenerates the images used in `README.md`. Update them when the UI changes visibly and commit the new files.

## Commit & Pull Request Guidelines
Recent history follows lightweight Conventional Commit prefixes such as `feat:`, `chore:`, and `fix:`, optionally with a scope such as `fix(clipper):`. Keep commits focused and write imperative summaries, for example `feat: add folder recommendation fallback`. Pull requests should include a short problem statement, a concise change summary, test evidence, and screenshots or recordings for popup/new tab/side panel UI changes (`npm run screenshots` produces them). Link related issues when applicable and note any manual extension-loading steps reviewers should use.
