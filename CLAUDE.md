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
| `src/app/layout.tsx`            | Root layout (NavBar, ThemeInitialiser)             |
| `src/app/globals.css`           | Solarised CSS variables + Tailwind                |
| `src/components/`               | All React components (UI, charts, waveform, etc.) |
| `src/components/WhatsNewBanner.tsx` | Dismissible upgrade banner (localStorage-based) |
| `src/components/ErrorBoundary.tsx` | React class error boundary for result panels   |
| `src/hooks/useAudioAnalysis.ts` | File upload + analysis lifecycle hook             |
| `src/hooks/useTheme.ts`         | Theme preference hook                             |
| `src/lib/beatDetection.ts`      | Beat detection engine (spectral flux, peak pick)  |
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
6. Update `CLAUDE.md` if the change affects project context.
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

- **Version:** 0.3.0
- **Status:** Fully functional browser-based beat detection with interactive
  waveform visualisation, BPM estimation, onset charts, beat timeline, and
  four export modes (full track, isolate beats, cut at beats, custom range).
- **MP3 export** via `@breezystack/lamejs` (128/192/256/320 kbps selectable).
- **ZIP bundling** via `fflate` — cut-at-beats downloads as a single `.zip` archive.
- **Beat data export** — CSV and JSON download buttons in the Beat Timeline header.
- **Waveform zoom slider** in WaveformPlayer controls; persisted to settings.
- **In-app changelog** at `/changelog` (server component reads `CHANGELOG.md` at build time).
- **What's New banner** shown to returning users after an upgrade (localStorage-based).
- **Error boundaries** wrap all major result panels; failed panels show a recovery UI.
- **File size guard** blocks uploads over 200 MB with a clear error message.
- Version string injected at build time from `VERSION` file via `next.config.ts`
  `env.NEXT_PUBLIC_APP_VERSION`; no more hardcoded version constants in components.
- Space bar toggles waveform play/pause globally (excludes inputs/buttons).
- Click any beat row to seek the waveform to that beat time.
- BPM ÷2 / ×2 display-only quick-correct buttons on the BPM card for octave error correction.
- Re-analyse button re-runs detection on the last uploaded file with current settings.
- Export panel shows visible error messages (not just `console.error`).
- Cut-at-beats mode shows a ZIP preview badge before downloading.
- Waveform colours update on theme toggle (WaveSurfer re-created with new theme dep).
- Indeterminate progress shimmer during file-load phase (before analysis begins).
- Session restore banner explains why waveform is unavailable and prompts re-upload.
- ARIA labels on all interactive controls; `role="alert"` on error banners;
  `aria-live` region announces analysis start/completion.
- Screen-reader `<p className="sr-only">` summaries added to BpmHistogram and OnsetChart.
- BpmDisplay stats row stacks on mobile (`grid-cols-1 sm:grid-cols-3`).
- BeatList table wrapped in `overflow-x-auto` with `min-width` for mobile.
- Charts grid is single-column when onset curve is hidden (no half-width histogram).
- Open Graph and Twitter Card metadata in `layout.tsx`; `lang="en-AU"`.
- Favicon from `src/app/icon.svg` (Solarised blue waveform/Activity icon).
- `next-themes` dependency removed (app uses its own `useTheme` + `ThemeInitialiser`).
- AAC listed in upload zone label and error messages.
- Duration display uses `Math.floor` (prevents `0:60` rounding edge case).
- Session persistence restores the last analysis on reload.
- All detection and display settings are configurable via the settings page.
- Settings store migrates from v1 to v2 schema without losing existing preferences.
- Light / Dark / System theme with Solarised colour palette.
- 50 tests (34 unit + 16 real-audio integration; 47 pass, 1 fail known, 2 skipped).
