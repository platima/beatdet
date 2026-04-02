# CLAUDE.md: AI Assistant Context

This file provides project context for AI coding assistants (GitHub Copilot,
Claude, etc.). It is read at the start of each session so the assistant
understands the project without re-discovering everything.

## Project Overview

**BeatDet** is a browser-based audio beat detection app with interactive
waveform visualisation. No login required; no data leaves the browser. All
audio processing uses the
[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
locally.

### Architecture

```
Browser (static site)
  └─ Next.js App Router (static export)
       ├─ React components (UI, charts, waveform)
       ├─ Zustand store (settings, persisted to localStorage)
       └─ Web Audio API (decode, analyse, export)
```

- **Fully client-side**: the production build is a static export
  (`output: "export"` in `next.config.ts`), deployable to any static host
  (Cloudflare Pages, GitHub Pages, etc.).
- **No backend or API**: everything runs in the browser tab.

## Dev Environment

- **Dev machine:** Windows 11 with VS Code as the primary IDE
- **Node.js:** 20+ (required for Next.js 16)
- **Package manager:** npm

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Framework    | Next.js 16 (App Router)             |
| Language     | TypeScript                          |
| Styling      | Tailwind CSS + Solarised palette    |
| State        | Zustand (with localStorage persist) |
| Audio engine | Web Audio API (native browser)      |
| Waveform     | wavesurfer.js                       |
| Charts       | Chart.js / react-chartjs-2          |
| Icons        | lucide-react                        |
| Testing      | Jest (with Next.js SWC transformer) |

## Key Files

| File / Directory                | Purpose                                           |
|---------------------------------|---------------------------------------------------|
| `src/app/page.tsx`              | Main beat detection page                          |
| `src/app/settings/page.tsx`     | Settings page                                     |
| `src/app/changelog/page.tsx`    | Changelog page (server component, reads CHANGELOG.md) |
| `src/app/layout.tsx`            | Root layout (NavBar, inline theme script in head)  |
| `src/app/globals.css`           | Solarised CSS variables + Tailwind                |
| `src/components/`               | All React components (UI, charts, waveform, etc.) |
| `src/components/WhatsNewBanner.tsx` | Dismissible upgrade banner (localStorage-based) |
| `src/components/ErrorBoundary.tsx` | React class error boundary for result panels   |
| `src/hooks/useAudioAnalysis.ts` | File upload + analysis lifecycle hook             |
| `src/hooks/useTheme.ts`         | Theme preference hook                             |
| `src/lib/beatDetection.ts`      | Beat detection engine (spectral flux, peak pick)  |
| `src/lib/hintUtils.ts`          | `buildHints` / `isCloseRatio`: hint logic extracted for testability |
| `src/lib/audioExport.ts`        | WAV/MP3 encoding, ZIP bundling, and audio slicing |
| `src/lib/sessionStorage.ts`     | Session persistence helpers                       |
| `src/store/settingsStore.ts`    | Zustand settings store (localStorage backed)      |
| `src/types/index.ts`            | Shared TypeScript type definitions                |
| `src/lib/__tests__/`            | Unit + integration tests                          |
| `testfiles/`                    | Kevin MacLeod MP3 benchmark tracks for tests      |
| `src/app/icon.svg`              | App favicon (Solarised blue waveform icon)        |
| `CHANGELOG.md`                  | Full release history (Keep a Changelog format)    |
| `next.config.ts`                | Next.js config (static export + version injection)|
| `jest.config.js`                | Jest config (SWC transformer, path aliases)       |
| `TODO.md`                       | Planned features and milestone tracking           |
| `CLAUDE.md`                     | AI assistant context (this file)                  |
| `README.md`                     | User-facing documentation                         |
| `VERSION`                       | Semantic version string                           |

## Conventions

### Language

Australian English in **all** comments, log messages, and documentation.
Examples: initialise, behaviour, colour, licence, serialisation, organisation,
optimise, minimise, recognise.

No em-dashes (—) or double-hyphens (--) should be used.

### Versioning (SemVer)

Semantic Versioning tracked in the `VERSION` file at the repo root.

| Bump  | When                                               |
|-------|----------------------------------------------------|
| PATCH | Each individual commit (bug fix, small improvement) |
| MINOR | Phase or milestone complete (push + update README)  |
| MAJOR | Breaking API or protocol change                     |

### Git Workflow

1. Create a **feature or fix branch** off `main` (`feature/<name>`, `fix/<name>`).
2. Make changes, commit with a **Conventional Commits** message
   (`feat:`, `fix:`, `chore:`, `docs:`).
3. **Bump the PATCH** version in `VERSION` with each commit.
4. When the phase/milestone is complete: bump **MINOR**, update `README.md`,
   commit, and push.
5. Merge back to `main`.

### Documentation & Testing

- **Update docs with every change.** If a feature, config, or file changes,
  update `README.md`, `CLAUDE.md`, and inline comments in the same commit.
- **Create documentation if it's missing.** Never leave a new subsystem
  undocumented.

### Standard Task Completion Checklist

Every piece of work (feature, fix, refactor) must complete **all** of these
steps before the task is considered done. Do not skip steps, and do not batch
them silently; each must be visible in the plan.

1. Implement the change.
2. Update or create unit tests to cover the change.
3. Run unit tests; fix and repeat until all pass.
4. Update inline code comments (Australian English).
5. Update `README.md` if the change affects usage, structure, or config.
6. Update architectural facts in `CLAUDE.md` (settings schema version, non-obvious implementation choices). Do not add feature descriptions that belong in `README.md`.
7. Bump version in `VERSION` (PATCH per commit, MINOR per milestone).
8. `git add -A && git commit` with a Conventional Commits message.
9. At milestone completion: bump MINOR, push, update README version.

## Build & Test

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build (static export to out/)
npm run build

# Lint
npm run lint

# Run all tests
npm test

# Watch mode during development
npx jest --watch

# Coverage report
npm run test:coverage
```

### Test Suites

- **Unit tests** (`beatDetection.test.ts`): 34 tests covering FFT correctness,
  onset strength functions, peak picking (including absolute height floor), and
  BPM estimation.
- **Unit tests** (`audioExport.test.ts`): 23 tests covering `encodeWav`,
  `normalisePeak`, `sliceBuffer`, `concatenateBuffers`, `bundleZip`, and the
  `MAX_FILE_BYTES` constant. Uses `node-web-audio-api` for `AudioContext` in Node.
- **Real-audio integration tests** (`realAudio.test.ts`): 16 Kevin MacLeod
  tracks spanning 60-204 BPM, decoded via `node-web-audio-api` and run through
  the full spectral-flux -> peak-pick -> BPM-estimate pipeline. Tests live in
  `src/lib/__tests__/`. Real-audio tests require the `testfiles/` directory
  containing the benchmark MP3 tracks.

## Deployment (Cloudflare Pages)

The app is a fully static Next.js export (no server runtime required).

| Setting          | Value             |
|------------------|-------------------|
| Build command    | `npx next build`  |
| Output directory | `out`             |
| Node.js version  | 20+               |


## Current State

- **Milestone:** v0.5.x = PWA; v0.6.x = UI/UX Polish; v0.7.x = Key Detection; v0.8.x = Library Release
- **Current version:** v0.6.1
- **Settings store:** schema v4 (`settingsVersion: '4.0.0'`); migrates v1 -> v2 -> v3 -> v4 automatically.
- **Tests:** 88 unit + 26 real-audio integration; run `npm test` for current counts.
- **MP3 export** via `@breezystack/lamejs`; ZIP bundling via `fflate`.
- **BeatList** virtualised via `@tanstack/react-virtual` for long beat lists.
- **Session persistence** restores last analysis on reload; waveform requires re-upload.
- **Analysis cancellation** via `AbortController` passed to `analyseAudio`.
- **FOUC prevention**: plain render-blocking `<script>` in `<head>` in `layout.tsx` (not `next/script`); reads both `theme` and `classicUi` from localStorage and sets `data-theme` and `data-ui` on `<html>` before first paint; `globals.css` also has `@media (prefers-color-scheme: dark) :root:not([data-theme=light])` as a CSS-only fallback for system-dark users.
- **Tempo candidates** in `BpmDisplay` are clickable buttons; selecting one sets `bpmMultiplier` to `candidate.bpm / baseBpm`.
- **Cancel race guard**: `analyseFile` checks `controller.signal.aborted` after `analyseAudio` returns before calling `setStatus('complete')`.
- **Version string** injected at build time via `NEXT_PUBLIC_APP_VERSION` (source: `VERSION` file).
- **Waveform height** default 120 px, configurable 80/120/160/200 px, applied live via `setOptions`.
- **Detection hints** shown in a toast; `src/lib/hintUtils.ts` is extracted for independent testing.
- **PWA**: manifest via `app/manifest.ts`; icons via `app/apple-icon.tsx` (180x180), `icon1.tsx` (192x192), `icon2.tsx` (512x512) using Next.js `ImageResponse` file convention; all icon/manifest route files export `dynamic = 'force-static'` for `output: "export"` compatibility; service worker at `public/sw.js` uses network-first for navigation and cache-first/stale-while-revalidate for static assets; `CACHE_VERSION` constant in `sw.js` must be bumped manually on significant releases (static file has no access to Next.js build-time env).
- **Modern UI**: CSS-driven visual layer using `ui-*` hook classes in `globals.css`; active by default, disabled when `data-ui="classic"` is set on `<html>`. The `classicUi` boolean in `DisplaySettings` controls the toggle; `useTheme` hook syncs `data-ui` attribute to DOM. Inline head script also reads the setting for FOUC-free first paint.
- `testfiles/` excluded from Git (local only); required for real-audio integration tests.
