# CLAUDE.md: AI Assistant Context

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
| `src/components/KeyDisplay.tsx` | Key detection card (Camelot, candidates, relative key) |
| `src/hooks/useAudioAnalysis.ts` | File upload + analysis lifecycle hook             |
| `src/hooks/useTheme.ts`         | Theme preference hook                             |
| `src/lib/beatDetection.ts`      | Beat detection engine (spectral flux, peak pick)  |
| `src/lib/hintUtils.ts`          | `buildHints` / `isCloseRatio`: hint logic extracted for testability |
| `src/lib/keyDetection.ts`       | Key detection engine (Bellman-Budge chroma correlation) |
| `src/lib/audioExport.ts`        | WAV/MP3 encoding, ZIP bundling, and audio slicing |
| `src/lib/sessionStorage.ts`     | Session persistence helpers                       |
| `src/store/settingsStore.ts`    | Zustand settings store (localStorage backed)      |
| `src/types/index.ts`            | Shared TypeScript type definitions                |
| `src/lib/__tests__/`            | Unit + integration tests                          |
| `testfiles/`                    | Kevin MacLeod + Classicals.de MP3 benchmark tracks |
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

1. Make changes directly on `main` (this is a solo project with no PR workflow).
2. Commit with a **Conventional Commits** message (`feat:`, `fix:`, `chore:`, `docs:`).
3. **Bump the PATCH** version in `VERSION` with each commit.
4. When a milestone is complete: bump **MINOR**, update `README.md`, commit, and push.

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

Test suites live in `src/lib/__tests__/`. Real-audio tests require the `testfiles/`
directory (local only, excluded from Git) containing the Kevin MacLeod benchmark MP3s.

## Current State

- **Milestone:** v0.5.x = PWA; v0.6.x = UI/UX Polish; v0.7.x = Key Detection; v0.8.x = Library Release
- **Current version:** v0.7.3
- **Settings store:** schema v5 (`settingsVersion: '5.0.0'`); migrates v1 -> v2 -> v3 -> v4 -> v5 automatically.
- **Tests:** run `npm test` for current counts.
- **MP3 export** via `@breezystack/lamejs`; ZIP bundling via `fflate`.
- **BeatList** virtualised via `@tanstack/react-virtual` for long beat lists.
- **Session persistence** restores last analysis on reload; waveform requires re-upload.
- **Analysis cancellation** via `AbortController` passed to `analyseAudio`.
- **FOUC prevention**: plain render-blocking `<script>` in `<head>` in `layout.tsx` (not `next/script`); reads both `theme` and `classicUi` from localStorage and sets `data-theme` and `data-ui` on `<html>` before first paint; `globals.css` also has `@media (prefers-color-scheme: dark) :root:not([data-theme=light])` as a CSS-only fallback for system-dark users.
- **Tempo candidates** in `BpmDisplay` are clickable buttons; selecting one sets `bpmMultiplier` to `candidate.bpm / baseBpm`.
- **Tap tempo** in `BpmDisplay`: timestamps stored in a `useRef` array; inter-tap mean triggers `setTapBpm`; a 3 s timeout (also `useRef`) resets the chain. "Use" button sets multiplier to `tapBpm / bpmEstimate.bpm`.
- **Cancel race guard**: `analyseFile` checks `controller.signal.aborted` after `analyseAudio` returns before calling `setStatus('complete')`.
- **Version string** injected at build time via `NEXT_PUBLIC_APP_VERSION` (source: `VERSION` file).
- **Waveform height** default 120 px, configurable 80/120/160/200 px, applied live via `setOptions`.
- **Detection hints** shown in a toast; `src/lib/hintUtils.ts` is extracted for independent testing.
- **PWA**: manifest via `app/manifest.ts`; icons via `app/apple-icon.tsx` (180x180), `icon1.tsx` (192x192), `icon2.tsx` (512x512) using Next.js `ImageResponse` file convention; all icon/manifest route files export `dynamic = 'force-static'` for `output: "export"` compatibility; service worker at `public/sw.js` uses network-first for navigation and cache-first/stale-while-revalidate for static assets; `CACHE_VERSION` constant in `sw.js` must be bumped manually on significant releases (static file has no access to Next.js build-time env).
- **Modern UI**: CSS-driven visual layer using `ui-*` hook classes in `globals.css`; active by default, disabled when `data-ui="classic"` is set on `<html>`. The `classicUi` boolean in `DisplaySettings` controls the toggle; `useTheme` hook syncs `data-ui` attribute to DOM. Inline head script also reads the setting for FOUC-free first paint.
- **Keyboard shortcuts**: Space = play/pause, R = restart, L = toggle loop region, ? = keyboard shortcuts help (in `NavBar`). The R and L shortcuts are handled in `WaveformPlayer`; ? is handled in `NavBar`.
- **Loop region**: `RegionsPlugin` from `wavesurfer.js/dist/plugins/regions` registered via `WaveSurfer.create({ plugins: [...] })`; loop check runs in the `audioprocess` closure via `loopEnabledRef` (avoids stale-closure race). `onRegionChange` prop threads the region bounds to `page.tsx` → `ExportPanel` for custom-range pre-fill.
- **Playback speed**: `setPlaybackRate()` called on the WaveSurfer instance; speed buttons in the secondary controls row; default 1×.
- **Key detection**: Bellman-Budge corpus-derived profiles in `src/lib/keyDetection.ts`; computes 12-bin chroma vector via FFT (4096-point, 150-2100 Hz; lower cutoff excludes kick drum fundamental range for better EDM accuracy), correlates against 24 Bellman-Budge major/minor profiles (stronger diatonic/non-diatonic separation than the original Krumhansl-Kessler profiles), returns key, Camelot code, relative key, top-5 candidates, and ambiguity flag. Confidence is the raw Pearson correlation coefficient (0–1). Called from `analyseAudio` after beat detection. `KeyDisplay` component renders the results. Toggleable via `showKey` in `DisplaySettings`.
- `testfiles/` excluded from Git (local only); required for real-audio integration tests.
