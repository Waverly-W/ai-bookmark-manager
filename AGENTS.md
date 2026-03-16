# Repository Guidelines

## Project Structure & Module Organization
This repository is a WXT-based browser extension. Runtime entrypoints live in `entrypoints/`: `popup/` for quick-save UI, `newtab/` for the main dashboard and tools, `sidepanel/` for panel content, and `background.ts` for extension background logic. Shared React UI is in `components/`, with reusable primitives under `components/ui/` and settings screens under `components/settings/`. Business logic and storage helpers live in `lib/`, custom hooks in `hooks/`, translations in `locales/`, and static extension assets in `public/` and `assets/`. Tests currently live in `lib/__tests__/`.

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

## Coding Style & Naming Conventions
TypeScript and React are the default. Follow the existing style in the touched file: many app files use 4-space indentation, while tests and newer utility files often use 2 spaces; avoid reformatting unrelated code. Use `PascalCase` for React components, `camelCase` for functions and hooks, and `kebab-case` for most file names such as `folder-recommendation-settings.tsx`. Prefer the `@/` alias for internal imports. Tailwind utilities and shadcn/ui components are configured through `assets/main.css`, `tailwind.config.js`, and `components.json`.

## Testing Guidelines
Vitest is configured in `vitest.config.ts` with a Node environment and V8 coverage. Add tests alongside the relevant domain under `lib/__tests__/`, using `*.test.ts` naming. Cover pure logic, storage behavior, and edge cases; browser API integrations should be isolated or mocked. Run `npm run test` before opening a PR and `npm run test:coverage` for larger refactors.

## Commit & Pull Request Guidelines
Recent history follows lightweight Conventional Commit prefixes such as `feat:`, `chore:`, and `fix:`. Keep commits focused and write imperative summaries, for example `feat: add folder recommendation fallback`. Pull requests should include a short problem statement, a concise change summary, test evidence, and screenshots or recordings for popup/new tab UI changes. Link related issues when applicable and note any manual extension-loading steps reviewers should use.
