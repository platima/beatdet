# BeatDet TODO

## v0.2.0 — Public Launch Polish

### A. Quick Wins

- [x] **A1** Inject version from `VERSION` file via `next.config.ts` `env.NEXT_PUBLIC_APP_VERSION`; remove hardcoded version strings from `NavBar.tsx` and `settings/page.tsx`; sync `package.json` version field.
- [x] **A2** Favicon: create `src/app/icon.svg` (Solarised blue Activity waveform icon).
- [x] **A3** Open Graph / Twitter meta: extend `layout.tsx` metadata with `openGraph` + `twitter` fields; change `lang="en"` → `lang="en-AU"`.
- [x] **A4** Fix BpmDisplay duration rounding: `Math.round(duration % 60)` → `Math.floor(duration % 60)`.
- [x] **A5** Fix lone histogram layout: chart grid `lg:grid-cols-2` only when `showOnsetCurve` is true.
- [x] **A6** Fix AAC label: update AudioUploader "Supports" text + useAudioAnalysis error message to include AAC.
- [x] **A7** Remove unused `next-themes` dependency (`npm uninstall next-themes`).

### B. Polish & Feedback

- [x] **B1** ExportPanel: show export errors in UI (not just `console.error`).
- [x] **B2** ExportPanel: show "Will download N files" badge for `cut-at-beats` mode.
- [x] **B3** Auto-scroll to results when analysis completes (smooth scroll to `id="results"`).
- [x] **B4** WaveformPlayer: add `theme` to WaveSurfer recreation deps so colours update on theme toggle.
- [x] **B5** Indeterminate progress during file load: sentinel value from hook, pulsing shimmer in ProgressBar with no percentage label.
- [x] **B6** Session restore banner: explain why waveform is unavailable and prompt re-upload.

### C. Interaction Improvements

- [x] **C1** Space bar global shortcut to play/pause waveform (with `preventDefault` to block page scroll).
- [x] **C2** Click beat row in BeatList to seek waveform: `onBeatClick` prop + `seekTo` prop on WaveformPlayer.
- [x] **C3** BPM ×2 / ÷2 display-only correction buttons on BpmDisplay; show badge when active; reset on new analysis.
- [x] **C4** Re-analyse button: store last `File` in a `useRef`; expose `reanalyse()` from hook; show button in results footer.

### D. Accessibility

- [x] **D1** Error banner in `page.tsx`: add `role="alert"` and `aria-live="assertive"`.
- [x] **D2** Add visually-hidden `aria-live="polite"` region announcing analysis start/complete/BPM.
- [x] **D3** WaveformPlayer buttons: add `aria-label` to Play, Pause, Restart, Mute, Unmute; add `aria-label="Volume"` to slider.
- [x] **D4** NavBar: add `aria-label="Cycle theme"` to theme toggle; `aria-label="Settings"` to settings link.
- [x] **D5** Charts: add visually-hidden `<p>` summary after BpmHistogram and OnsetChart.

### E. Mobile Responsiveness

- [x] **E1** BpmDisplay stats grid: `grid-cols-1 sm:grid-cols-3` (stacks on small screens).
- [x] **E2** BeatList: wrap table in `overflow-x-auto`; set `min-width` on columns.
- [x] **E3** ExportPanel mode cards: already `grid-cols-1 sm:grid-cols-2` — verified.

---

## v0.3.0 — Extended Features

### Export

- [x] **MP3 export**: browser-side MP3 encoding via `@breezystack/lamejs`; format selector (WAV / MP3) and bitrate control (128 / 192 / 256 / 320 kbps) in ExportPanel and settings.
- [x] **ZIP bundle** for `cut-at-beats` mode (`fflate` — pure JS, no WASM); replaces sequential browser downloads.
- [x] **CSV / JSON beat list export**: download from BeatList header.

### Changelog & What's New

- [x] **In-app changelog**: `/changelog` route displaying `CHANGELOG.md`; version badge in NavBar links to it.
- [x] **"What's New" banner**: compares `lastSeenVersion` in `localStorage` with `NEXT_PUBLIC_APP_VERSION`; dismissible per-version; skipped for first-time visitors.
- [x] **`CHANGELOG.md`**: created at repo root in Keep a Changelog format.

### Stability & Performance

- [x] Analysis cancellation via `AbortController` — allow user to stop mid-flight.
- [x] File size limit guard: validate before decoding; friendly error for files over 100 MB (Cloudflare limit).
- [x] Virtual scrolling in BeatList for tracks with 500+ beats (`@tanstack/react-virtual`).
- [x] Error boundary: wrap result components to prevent full-page crash on render error.
- [x] Settings page: add Zustand persist migration strategy for future schema changes.

---

## v0.4.x — Polish

- [x] **Tempo confidence hints** (v0.4.0): dismissible toast showing contextual tips when the BPM result may be unreliable. Detects octave (2:1), sesquialtera (3:2), 4:3, and triple-tempo (3:1) inter-candidate ratios, low confidence (<35%), and short clips (<30 beats). Suppressed when the algorithm already auto-corrected the same ratio (`correctionRatio` field on `BpmEstimate`).
- [x] Waveform zoom slider wired to `waveformZoom` store setting (v0.4.1).
- [ ] Further bug fixes and UI polish as needed.

---

## v0.5.0 — Progressive Web App

- [x] PWA manifest: `site.webmanifest`, `apple-touch-icon`, offline support via service worker.

---

## v0.7.0 — Key Detection

- [ ] **Key detection and relative key hints**: detect the musical key of the uploaded track and display it alongside the BPM.

  | Sub-feature | Notes |
  |---|---|
  | **Primary key display** | Show detected key (e.g. "C Major", "A Minor") on the BPM card next to BPM. |
  | **Relative key hint** | Always show the relative major/minor counterpart (e.g. "Relative minor: A Minor"). |
  | **Camelot / Open Key wheel** | Show the Camelot notation (e.g. "8B") for DJ-friendly harmonic mixing; compatible-neighbour keys highlighted. |
  | **Alternate key candidates** | List top key candidates with confidence, similar to tempo candidates. |
  | **Mixed/ambiguous key hint** | Show a hint when no key dominates (modal, chromatic, or atonal material). |

  Implementation notes:
  - Use a **Krumhansl-Schmuckler key-finding algorithm** or a simplified chroma profile correlation against major/minor templates. Both run purely in JavaScript with no external dependencies.
  - Compute a **12-bin chroma vector** (pitch-class energy sums) from the decoded mono PCM using the FFT already available in `beatDetection.ts`.
  - Correlate the chroma vector against Krumhansl-Kessler major and minor key profiles for all 24 keys; rank by correlation coefficient.
  - Expose `key`, `keyConfidence`, and `keyCandidates` from `analyseAudio` / `AnalysisResult`.
  - Camelot mapping is a static 24-entry lookup table (no extra dependency needed).
  - Key display should be suppressible (settings toggle `showKey`) for users who do not need it.

---

## v0.6.0 — UI and UX Polish

- [x] **Modern UI**: elevated panels, box shadows, BPM hero card gradient, upload zone glow, accent-dot section headings, button hover lift, navbar drop shadow, and results fade-in animation. CSS-driven via `ui-*` hook classes gated on `html:not([data-ui="classic"])`.
- [x] **Classic UI toggle**: `classicUi` setting in Appearance reverts to the pre-v0.5.2 flat look.
- [x] **Settings nav toggle**: clicking the Settings icon when already on the Settings page returns to the home page (same toggle behaviour as the Changelog icon).
- [x] **Settings Saved indicator**: brief "Saved" toast appears after any setting is changed.

- [ ] **Tap tempo tool**: a tap button on the BPM card that measures inter-tap interval to let the user manually verify or override the detected BPM.
- [ ] **Playback speed control**: expose WaveSurfer's `playbackRate` (0.5x, 0.75x, 1x) for slowed-down beat verification.
- [ ] **Loop region**: allow marking a time range on the waveform and looping playback within it.
- [ ] **Waveform region selection for export**: wire the waveform region to the custom time-range export mode, replacing manual input.
- [ ] **Keyboard shortcuts reference**: small help popover listing all keyboard shortcuts (Space, etc.).
- [ ] **Improved mobile layout**: review ExportPanel and BeatList on narrow viewports; ensure no horizontal scroll on 360px screen width.
- [ ] **Accessibility audit**: verify WCAG 2.1 AA colour contrast for all Solarised semantic tokens; fix any failures; add missing `aria-live` regions.

---

## v0.8.0 — Library Release

- [ ] **Expose beat detection engine as a standalone npm package** (`beatdet-core` or similar), so developers can `import { analyseAudio, estimateBpm } from 'beatdet-core'` in their own projects.

  | Sub-feature | Notes |
  |---|---|
  | **Package scaffold** | Separate `packages/beatdet-core/` workspace; build to ESM + CJS dual-package. |
  | **Public API** | Export `analyseAudio`, `estimateBpm`, `buildHints`, `isCloseRatio`, and all associated TypeScript types. |
  | **Tree-shaking** | Pure functions only — no React, no browser-only APIs in the core package. |
  | **Docs** | Dedicated `README` for the package with minimal usage example and type reference. |
  | **CI publish** | GitHub Actions workflow to publish to npm on tag push. |
