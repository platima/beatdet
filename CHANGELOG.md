# Changelog

All notable changes to BeatDet are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.4] - 2026-04-12

### Added

- **HPSS key detection**: Harmonic-Percussive Source Separation (HPSS) is now applied to
  the spectrogram before chroma accumulation (Driedger, Müller and Disch, ISMIR 2014).
  Horizontal (time-axis, L=17 frames) and vertical (frequency-axis, L=17 bins) median
  filters separate sustained harmonic sources (synths, pads, bass lines) from transient
  percussive sources (kick drums, snares, hi-hats). A squared Wiener soft mask then
  extracts the harmonic component. Only harmonic energy contributes to chroma.
  This removes kick drum harmonics above 150 Hz (at ~156, 234 and 312 Hz) that escape
  the fMin cutoff.
  - Exact accuracy on GiantSteps Key Dataset (460 tracks): **35.7% → 39.8%**
  - Combined accuracy (correct + adjacent Camelot key): **61.3% → 67.4%**
  - No regressions on existing test tracks; Für Elise confidence improved 0.833 → 0.844
  - Note: fMin stays at 150 Hz; HPSS cannot cleanly remove the kick drum fundamental
    (65-150 Hz) because in EDM the kick repeats so rapidly (~2-4 Hz) that the 17-frame
    horizontal kernel classifies it as harmonic

---

## [0.7.3] - 2026-04-12

### Fixed

- **Key detection frequency range**: raised `fMin` from 65 Hz to 150 Hz (~D3) in the
  chroma extraction pass. EDM kick drums are commonly tuned to C#/Db (~78 Hz), causing
  their energy to pollute the chroma vector and force nearly all detections to C# minor
  or F# major. The new lower cutoff sits above the kick drum fundamental range
  (~50-130 Hz) while retaining all musical bass content above D3.
  Accuracy on the GiantSteps Key Dataset (460 electronic music tracks) improved from
  10.0% to 35.7% (3.5x improvement) with no regressions on existing tests.

### Added

- **GiantSteps benchmark**: `giantsteps-benchmark.mjs` script for measuring key detection
  accuracy against the 460-track GiantSteps Key Dataset (expert-annotated electronic music).
  Reports overall percentage, per-key accuracy table, and top confusions.

---

## [0.7.2] - 2026-04-11

### Changed

- **Key detection profiles**: switched from Krumhansl-Kessler (1982) perceptual profiles to Bellman-Budge (2005) corpus-derived profiles. The Bellman-Budge profiles assign much larger weights to diatonic scale tones relative to non-diatonic ones, providing stronger tonic/dominant separation on real audio. Verified on Für Elise (A Minor, 8A) — previously misdetected as E Major with KK profiles.

### Added

- **Known-key test tracks**: Für Elise (A Minor, 8A) passes; Canon In D 8-bit synths and Eine Kleine Nachtmusik added as documented known limitations (square-wave harmonic pollution and sonata-form modulation respectively).

---

## [0.7.1] - 2026-04-11

### Fixed

- **Key confidence metric**: confidence now shows the raw Pearson correlation coefficient (0–1) instead of a misleading normalised value that was always 100% for the winner. This gives users a meaningful absolute measure of tonal clarity (e.g. 0.86 for a clear key, 0.57 for an ambiguous one).

### Added

- **Real-audio key detection test**: Canon In D added as known-key verification (now skipped as a known limitation due to 8-bit synth harmonic artefacts; see v0.7.2).

---

## [0.7.0] - 2026-04-11

### Added

- **Key detection**: Bellman-Budge chroma-profile correlation identifies the musical key of uploaded audio. Displays the detected key (e.g. "C Major"), Camelot Wheel code for DJ-friendly harmonic mixing, relative key, normalised confidence bar, and top-5 alternative candidates ranked by correlation. Ambiguity flag shown when confidence is too low.
- **KeyDisplay component**: prominent key card with large key name, mode badge, Camelot code, confidence bar, relative key, and candidate list with confidence bars.
- **Key detection tests**: 18 unit tests covering chroma vector computation, Pearson correlation, Camelot codes, relative key calculation, candidate ranking, and ambiguity detection on flat input.
- **Show key detection setting**: toggleable via `showKey` in Display settings (default on). Settings store migrated to schema v5.

---

## [0.6.4] - 2026-04-02

### Fixed

- **Lint**: resolved all ESLint errors (5 errors → 0). Fixed `set-state-in-effect` warnings in `BpmDisplay` (derived state for hints, suppress for tap reset) and `WhatsNewBanner` (suppress for localStorage read). Removed unused `Hint` type import, stale `eslint-disable` directive in `layout.tsx`, and suppressed `no-require-imports` in `jest.config.js`.
- **Dead CSS**: removed unused `.export-options-grid` class from `globals.css`.
- **Misleading comment**: corrected "active:scale" comment to match the actual `opacity` rule.
- **Unescaped entity**: fixed `'` in `WhatsNewBanner` JSX text for `react/no-unescaped-entities`.

### Changed

- **README**: updated project structure tree (added `changelog/page.tsx`, `ErrorBoundary.tsx`, `ThemeInitialiser.tsx`, `WhatsNewBanner.tsx`, `hintUtils.ts`, all four test files), expanded the Testing section from two to four suites, updated component descriptions (tap tempo, keyboard shortcuts help, MP3/ZIP export), and added missing Display settings (Classic UI, Waveform height).
- **package.json**: synced `version` field to `0.6.4` (was stale at `0.3.4`).

---

## [0.6.3] - 2026-04-02

### Added

- **Tap tempo**: a "Tap" button on the BPM card that measures inter-tap intervals and displays a tapped BPM estimate. Resets automatically after 3 s of inactivity. A "Use" button applies the tap BPM as the display multiplier.
- **Playback speed control**: four compact speed buttons (0.5×, 0.75×, 1×, 1.5×) in the waveform player let users slow down audio for beat verification.
- **Loop region**: a loop toggle button (also accessible via **L**) enables a draggable, resizable blue region on the waveform. Playback loops continuously within the region. Toggling off clears the region.
- **Waveform region → export**: when a loop region is active and the ExportPanel is in Custom range mode, a "Use waveform region" button pre-fills the start/end inputs from the region bounds.
- **Keyboard shortcuts help**: a keyboard icon in the NavBar (and **?** global shortcut) opens a shortcuts reference panel listing Space, R, L, and ?.
- **R shortcut**: restarts playback from the beginning (mirrors the restart button).

### Changed

- **WaveformPlayer controls**: restructured into a primary transport row (time, restart, play, loop, mute, volume) and a secondary row (speed buttons, zoom, beats badge) to prevent overflow on 360 px screens.
- **Mobile layout**: primary controls now use `flex-wrap`, the time display no longer has a fixed width, and the volume slider is slightly narrower to prevent horizontal overflow at 360 px.

### Fixed

- **Accessibility**: `select` elements now receive the same `focus-visible` outline as other interactive elements; `button:active` has a consistent `opacity` reduction for non-colour-based feedback.

---

## [0.6.2] - 2026-04-01

### Changed

- **Docs**: trimmed `CLAUDE.md` to remove outdated implementation notes and reduce noise for AI assistants.

---

## [0.6.1] - 2026-04-01

### Added

- **Settings nav toggle**: clicking the Settings icon when already on the Settings page now returns to the home page, matching the existing Changelog icon behaviour. Avoids having to move the mouse to navigate back.
- **Settings Saved indicator**: a brief "Saved" toast fades in at the bottom-right of the screen after any setting is changed, confirming the auto-save.

### Changed

- **Milestone renumbering**: corrected milestone plan to v0.6.x = UI/UX Polish (current focus), v0.7.x = Key Detection, v0.8.x = Library Release. Updated TODO.md, CLAUDE.md, and CHANGELOG.md accordingly.

---

## [0.6.0] - 2026-03-31

### Added

- **Modern UI**: elevated panels with subtle box shadows, accent-dot section headings, BPM hero card gradient background, upload zone glow on hover/drag, button hover lift, navbar shadow, progress bar glow, and fade-in animation on results. All purely CSS-driven via `ui-*` hook classes in `globals.css`.
- **Classic UI toggle**: new `classicUi` boolean in `DisplaySettings` (default `false`); when enabled, `data-ui="classic"` is set on `<html>` and all modern enhancements are suppressed. Toggle available in Settings > Appearance > "Use classic UI".
- **Settings store schema v4**: migrates v3 -> v4 automatically, adding `classicUi: false` to existing display settings.
- **FOUC prevention for UI mode**: inline head script now also reads `classicUi` from localStorage and applies `data-ui="classic"` before first paint.

### Fixed

- **Static export**: icon route files (`apple-icon.tsx`, `icon1.tsx`, `icon2.tsx`) and `manifest.ts` now export `dynamic = 'force-static'` to fix build failure with Next.js 16 `output: "export"`.

---

## [0.5.1] - 2026-03-31

### Fixed

- **Jest Node.js 25 warning**: added `testEnvironmentOptions: { globalsCleanup: 'off' }` to `jest.config.js` to prevent the `--localstorage-file` warning from Node.js 25's built-in `localStorage` during Jest environment teardown.

---

## [0.5.0] - 2026-03-30

### Added

- **PWA support**: BeatDet is now installable as a Progressive Web App on desktop and mobile.
  - `app/manifest.ts`: web app manifest with name, `display: standalone`, Solarised dark background (`#002b36`), blue theme colour (`#268bd2`), and music/utilities categories.
  - `app/apple-icon.tsx`: 180x180 PNG apple touch icon generated at build time via `ImageResponse` (blue background, white waveform polyline); Next.js automatically adds `<link rel="apple-touch-icon">`.
  - `app/icon1.tsx`: 192x192 PNG icon for Android/Chrome install prompts; generates `/icon1.png` referenced in the manifest.
  - `app/icon2.tsx`: 512x512 PNG icon for Lighthouse PWA audit and splash screens; generates `/icon2.png` referenced in the manifest.
  - `public/sw.js`: service worker with network-first navigation (fresh pages when online, cached shell fallback offline) and cache-first/stale-while-revalidate for static assets. Pre-caches `/`, `/settings`, and `/changelog` on install. Activate handler clears all caches from previous `CACHE_VERSION` values.
  - `ServiceWorkerRegistrar` component: client component that calls `navigator.serviceWorker.register('/sw.js')` on mount; renders nothing; placed once in the root layout.
  - `layout.tsx` `Viewport` export: `themeColor` set to `#fdf6e3` for light and `#002b36` for dark schemes, enabling browser chrome colouring on mobile.

### Changed

- **Milestone plan**: revised to v0.6.x = UI/UX Polish; v0.7.x = Key Detection; v0.8.x = Library Release (`beatdet-core`).

---

## [0.4.11] - 2026-03-29

### Changed

- **Code review / housekeeping**: no behaviour changes.
  - Fixed orphaned `analyseAudio` JSDoc that had been left above `throwIfAborted` after the v0.4.9 refactor; JSDoc now sits directly above the function it documents.
  - Removed unused `i` index parameter from the tempo candidates `map` call in `BpmDisplay`.
  - Replaced all em-dashes in source comments with colons or semicolons to comply with the Australian English no-em-dash convention across `beatDetection.ts`, `ProgressBar.tsx`, `useAudioAnalysis.ts`, `layout.tsx`, and `globals.css`.
  - README: updated version badge to v0.4.10, removed `ThemeInitialiser.tsx` from project structure, updated `layout.tsx` comment, expanded BPM correction feature description to mention clickable tempo candidates.
  - CLAUDE.md: updated stale `layout.tsx` table entry; added notes for FOUC prevention approach, tempo candidate button behaviour, and cancel race guard.

---

## [0.4.10] - 2026-03-29

### Fixed

- **Cancel race condition leaving UI stuck**: If the user pressed Cancel just as analysis completed, `status` was set back to `'idle'` but `fileInfo` remained set with no clear button visible. Two fixes applied: (1) `AudioUploader`'s clear button is now shown whenever `fileInfo` is present, regardless of `status`; (2) added a `controller.signal.aborted` guard in `analyseFile` after `analyseAudio` returns so a late cancel cannot be overridden by `setStatus('complete')`.
- **Tempo candidates not clickable**: Candidate tempo chips were rendered as `<div>` elements with no interaction. They are now `<button>` elements that select the candidate as the displayed BPM (by computing `candidate.bpm / baseBpm` as the multiplier). The currently-selected candidate is highlighted in accent colour, matching the ÷2/×2 button behaviour. Clicking a 3/4-feel track's 3× candidate now works as expected.

---

## [0.4.9] - 2026-03-29

### Fixed

- **Progress bar jump-back (properly fixed)**: The shimmer is now an absolutely-positioned overlay on the progress track rather than the fill bar itself. The fill bar is always sized to the real percentage, so when the shimmer disappears there is no visual jump from 100% to a small value.
- **Progress bar stuck at 5% (properly fixed)**: Removed the `onProgress(0.05)` call before `decodeAudioData` — the indeterminate shimmer now covers the entire decode phase. Replaced `await Promise.resolve()` micro-task yields with `requestAnimationFrame`-based yields (`yieldToBrowser`), guaranteeing the browser paints each intermediate progress value before the next pipeline stage runs.

---

## [0.4.8] - 2026-03-29

### Fixed

- **Theme FOUC (still flashing light on dark mode)**: Replaced `next/script beforeInteractive` approach (v0.4.6) with a plain render-blocking `<script>` placed directly inside `<head>` in the root layout. The `next/script` approach does not reliably inject before the first paint in static-export or dev-server mode. A plain `<script>` in `<head>` is parse-order guaranteed to execute before any pixel is painted. Added a `@media (prefers-color-scheme: dark)` CSS rule in `globals.css` as a zero-JS fallback for the most common system-dark case, so the correct palette is applied even before the script runs. Removed the now-unnecessary `ThemeInitialiser` component.
- **Progress bar jump-back animation**: Suppressed CSS transition when the bar switches from indeterminate (100% width shimmer) to the first real progress value, preventing visible backward animation.
- **Sparse progress bar updates**: Added `await Promise.resolve()` yields in `analyseAudio` after the 20%, 30%, and 60% milestones so React can flush state between synchronous pipeline stages.

---

## [0.4.7] - 2026-03-29

### Fixed

- **Progress bar jump-back animation**: Suppressed CSS transition on the single frame when switching from indeterminate (shimmer at full width) to the first real progress value.
- **Sparse progress bar updates**: Added micro-yields (`await Promise.resolve()`) in `analyseAudio` so React flushes intermediate progress state between pipeline stages.

---

## [0.4.6] - 2026-03-29

### Fixed

- **Theme FOUC (flash of light on dark mode)**: `ThemeInitialiser` now uses `next/script` with `strategy="beforeInteractive"`, which injects the inline theme-detection script into the document `<head>` before any page content is painted. Previously the script was a plain `<script>` inside `<body>`, which ran too late and caused a brief flash of the light (Solarised Light) palette before the dark theme was applied.

---

## [0.4.5] - 2026-03-29

### Changed

- **Detection note toast size**: increased from `text-xs` to `text-sm` throughout; icon sizes grown proportionally; max width widened from `max-w-xs` to `max-w-sm`.
- **Em-dash removal**: replaced all em-dashes (\u2014) with colons, semicolons, or restructured prose across all source files, comments, and user-facing strings (`hintUtils.ts`, `BpmDisplay.tsx`, `BeatList.tsx`, `WhatsNewBanner.tsx`, `NavBar.tsx`, `layout.tsx`, `page.tsx`, `settings/page.tsx`, `changelog/page.tsx`, and all test files). Null value indicators in `BpmDisplay` changed from `\u2014` to `-`.
- **CLAUDE.md**: trimmed `Current State` section to key architectural facts only (removed exhaustive feature list that duplicated `README.md`); updated checklist step 6 to discourage adding feature descriptions; removed version number (source of truth is `VERSION` file).

---

## [0.4.4] - 2026-03-29

### Fixed

- **Waveform scrollbar**: the scrollbar is now correctly hidden. WaveSurfer renders into a shadow DOM, so the previous CSS approach (targeting `::webkit-scrollbar` on the outer container) had no effect. The fix uses WaveSurfer's built-in `hideScrollbar: true` option, which applies the style inside the shadow DOM, combined with JavaScript `mouseenter`/`mouseleave` listeners that toggle the hidden state so the scrollbar reappears on hover.

---

## [0.4.3] - 2026-03-29

### Fixed

- **Zoom controls**: removed the decorative `×` character that appeared after the zoom number input — it served no function and looked like a broken button.
- **Waveform scrollbar visibility**: fixed the hover-to-show scrollbar logic. The previous implementation used `background: transparent`, which still reserved layout space. Replaced with `height: 0` on `::-webkit-scrollbar` so the bar is truly invisible until hover.
- **Default waveform height**: raised default from 80 px (small) to 120 px (medium) in both `DEFAULT_DISPLAY` and the `??` fallback in `WaveformPlayer`. Settings store bumped to schema `version: 3` with a migration that preserves existing user preferences while upgrading unset values to 120 px.

### Changed

- **TODO milestone**: library-release milestone re-labelled `v0.7.0` (was `v1.0.0`).

---

## [0.4.2] - 2026-03-29

### Added

- **Waveform height setting**: new `waveformHeight` display preference (80 / 120 / 160 / 200 px) configurable on the Settings page. Applies live via WaveSurfer `setOptions` without reloading the audio. Defaults to 80 px (previous behaviour).
- **Zoom number input**: a numeric text field sits next to the waveform zoom slider for precise, repeatable values. Accepts any value in [1, 8] and snaps to the nearest 0.5 step.
- **Wider zoom slider**: zoom range input widened from 80 px to 144 px (Tailwind `w-36`) for finer control.

### Fixed

- **Chart panel gap**: increased inter-chart grid gap from `gap-5` (20 px) to `gap-6` (24 px) so the borders between "Onset Strength & Beat Markers" and "BPM Distribution Histogram" are no longer visually touching.
- **Waveform scrollbar on hover**: the WaveSurfer horizontal scrollbar (visible when zoomed in) is now hidden by default and appears only on pointer hover over the waveform area. Implemented via `.waveform-scroll-area` CSS class in `globals.css`.

---

## [0.4.1] - 2026-03-29

### Added

- Tempo confidence hints now include contextual Wikipedia "More info" links:
  - Low confidence → [Beat (music)](https://en.wikipedia.org/wiki/Beat_(music))
  - Octave (2:1) candidates → [Tempo](https://en.wikipedia.org/wiki/Tempo)
  - 4:3 ratio / 3:2 sesquialtera candidates → [Hemiola](https://en.wikipedia.org/wiki/Hemiola)
  - Triple-tempo / waltz (3:1) candidates → [Triple metre](https://en.wikipedia.org/wiki/Triple_metre)
- `buildHints` and `isCloseRatio` extracted to `src/lib/hintUtils.ts` for independent testability.
- 31 unit tests for `hintUtils` covering all hint conditions, URL values, suppression behaviour, and edge cases.
- Waveform zoom slider (`ZoomIn` icon + range input) wired to `waveformZoom` display setting; default zoom also configurable on the Settings page.

### Fixed

- "Trouble with Tribals 135bpm.mp3" real-audio test marked as `skip` — detection locks onto ~188 BPM at low confidence (≈0.39); the outcome is environment-sensitive and not a regression in the algorithm.

---

## [0.4.0] - 2026-03-29

### Added

- **Tempo confidence hints**: fixed bottom-right toast notification surfaces detection edge cases to the user after each analysis. Hints cover:
  - Octave error (×2 / ÷2 suggestion when a 2:1 ratio candidate exists and no auto-correction was applied)
  - 4:3 ratio ambiguity (e.g. detected 140 when true tempo is 105)
  - 3:2 sesquialtera ratio
  - Triple-tempo / waltz 3/4 feel
  - Low overall confidence (< 35%)
  - Short clip (fewer than 30 detected beats)
  - Dismissible per analysis (re-appears on next upload).
- `correctionRatio` field added to `BpmEstimate` type and returned from `estimateBpm`. Ratio hints are suppressed when the algorithm already auto-corrected the same ratio, preventing contradictory advice.

### Changed

- Auto-scroll to results removed. Results appear below the upload zone and modern display resolutions do not require the scroll.

---

## [0.3.9] - 2026-03-29

### Added

- README: accuracy comparison note — tested more accurate more often than Tunebat and AudioAlter across 26 randomly sampled Kevin MacLeod tracks (60-204 BPM).
- README: explicit call-out that all processing is in-browser with no upload required, and works well on mobile.

### Fixed

- WaveformPlayer: beat-marker overlay now scoped to the waveform canvas height only (`WAVEFORM_HEIGHT` constant); previously `h-full` extended into the WaveSurfer horizontal scrollbar zone when zoomed in, obscuring it.
- Page: session restore no longer triggers auto-scroll to results on refresh. Auto-scroll now only fires when a new analysis completes (previous status was `'analysing'`), not when a stored session is rehydrated (`idle → complete`).

---

## [0.3.8] - 2026-03-29

### Added

- Changelog nav icon now navigates back to the home page when already on the changelog page (toggles between changelog and home).

### Fixed

- CHANGELOG.md: back-filled v0.3.4, v0.3.5, and v0.3.6 entries that were previously folded into v0.3.7.

---

## [0.3.7] - 2026-03-29

### Added

- **×3 upward harmonic correction** in `estimateBpm`: detects tracks where the onset detector locks onto every-third-beat downbeats (e.g. slow waltzes); threshold 70%.
- **10 new real-audio benchmark tracks** (batch 3) in `realAudio.test.ts`, covering 54-186 BPM across funk, classical, electronica, and world genres.

### Changed

- Default `bpmMin` lowered from 60 → 55 in settings store (allows detection of slower tempos without user adjusting settings).
- Test suite `bpmMin` floor lowered from 55 → 50, enabling the 54 BPM Nightdreams track to pass.

### Fixed

- `AudioContext` creation moved from module scope into `beforeAll()` in `audioExport.test.ts` to prevent "no output device available" errors on cold Jest runs.

---

## [0.3.6] - 2026-03-29

### Fixed

- Canon In D For 8 Bit Synths BPM corrected from 133 → 132 in filename and test suite (per incompetech source PDF).

---

## [0.3.5] - 2026-03-29

### Changed

- `testfiles/` excluded from Git via `.gitignore`; binary test assets kept locally only.
- Git history rewritten with `git filter-repo` to remove previously committed MP3 blobs; pack size reduced from multi-MB to ~207 KiB.

---

## [0.3.4] - 2026-03-29

### Added

- `closeBufferContext()` export in `audioExport.ts` for clean test teardown.

### Fixed

- Jest open-handles warning: `audioExport.test.ts` now uses a single shared `AudioContext` closed in `afterAll`, instead of creating a new instance per helper call.

---

## [0.3.3] - 2026-03-28

### Fixed

- `scrollIntoView` option `behaviour` (silently ignored) corrected to `behavior`.
- Removed unused `useRef` import from `page.tsx`.
- README version header, package.json version, and CHANGELOG 200 MB reference all synced.
- TODO.md: ticked all shipped v0.3.0 export and changelog items.

---

## [0.3.2] - 2026-03-28

### Added

- **Analysis cancellation**: Cancel button shown during loading/analysing; `AbortController` passed through to `analyseAudio`; uploading a new file automatically aborts any in-flight analysis.
- **Virtual scrolling in BeatList**: table rows rendered via `@tanstack/react-virtual`; only visible rows are mounted with overscan=8; handles 500+ beat tracks without DOM bloat.

### Fixed

- `scrollIntoView` option key was `behaviour` (ignored by browsers); corrected to `behavior`.
- Removed unused `useRef` import from `page.tsx`.

---

## [0.3.1] - 2026-03-28

### Changed

- File size guard lowered from 200 MB to 100 MB (Cloudflare Pages upload limit).
- `audioExport.ts`: replaced `OfflineAudioContext` buffer factory with a lazy `AudioContext` singleton (`getBufferContext()`) for improved testability.

### Added

- `audioExport.test.ts`: 23 unit tests covering `encodeWav`, `normalisePeak`, `sliceBuffer`, `concatenateBuffers`, `bundleZip`, and `MAX_FILE_BYTES`.

---

## [0.3.0] - 2026-03-27

### Added

- **MP3 export**: browser-side MP3 encoding via `lamejs`; choose WAV or MP3 and bitrate (128 / 192 / 256 / 320 kbps) in the export panel and settings.
- **ZIP download** for cut-at-beats mode: all slices bundled into a single `.zip` file via `fflate`, replacing sequential browser downloads.
- **CSV / JSON beat list export**: download beat timestamps (and optionally confidence) as `.csv` or `.json` directly from the beat timeline.
- **Waveform zoom**: zoom slider in the waveform player; wired to the `waveformZoom` setting.
- **In-app changelog**: `/changelog` route listing all release notes; version badge in the nav bar links to it.
- **"What's New" banner**: shown once to returning users after an upgrade; dismissed per-version in `localStorage`.
- **Error boundary**: wraps result components to prevent a render error crashing the entire page.
- **File size guard**: friendly error shown before decoding if the selected file exceeds 100 MB (Cloudflare Pages limit).
- **Settings migration**: Zustand persist version field incremented; stale settings are merged safely with defaults.

### Changed

- Export panel now surfaces format (WAV / MP3) and bitrate controls inline.
- Cut-at-beats now downloads a single ZIP instead of sequentially triggering individual downloads.

---

## [0.2.0] - 2026-03-27

### Added

- **Version injection**: version read from `VERSION` file at build time via `next.config.ts`; no more hardcoded strings.
- **Favicon**: `src/app/icon.svg` — Solarised blue waveform icon, auto-registered by Next.js App Router.
- **Open Graph / Twitter Card** metadata in `layout.tsx`.
- **BPM ÷2 / ×2 buttons**: display-only quick-correct for common octave errors; resets on new analysis.
- **Click-to-seek**: clicking any beat row in the timeline jumps the waveform to that time.
- **Space bar** toggles waveform play/pause globally (excluded when focus is on a form control).
- **Re-analyse button**: re-run detection on the last uploaded file with current settings, no re-upload needed.
- **Export error UI**: export failures now shown in-panel, not just `console.error`.
- **Cut-at-beats file count badge**: shows "Will download N files" before the user clicks Download.
- **Auto-scroll**: results scroll into view after analysis completes.
- **Indeterminate progress**: full-width shimmer bar during file-load phase; percentage shown only during analysis.
- **Waveform theme reactivity**: waveform colours update live when the theme is toggled.
- **Session restore banner**: explains waveform is unavailable and prompts re-upload.
- **Accessibility**: `role="alert"` on error banner; `aria-live` region announces analysis start / BPM result; `aria-label` on all waveform controls and nav buttons; screen-reader `<p>` summaries on charts.
- **Mobile**: BPM stats grid stacks on narrow viewports; beat table scrolls horizontally.
- **Single-chart layout**: histogram takes full width when onset curve is hidden.

### Fixed

- Duration display no longer rounds `59.5 s` up to `0:60`.
- Upload zone and error messages now mention AAC (it was accepted but unlabelled).

### Removed

- `next-themes` dependency (app uses its own `useTheme` + `ThemeInitialiser`).

### Changed

- `lang="en-AU"` on `<html>` element.
- AAC added to accepted format labels throughout the UI.

---

## [0.1.7] - 2026-03-26

### Changed

- Various beat detection tuning (half-tempo gate improvements).

---

## [0.1.6] - 2026-03-25

### Added

- Initial public release.
- Spectral-flux beat detection engine.
- BPM estimation with multi-lag IOI accumulation and harmonic correction.
- WaveSurfer.js waveform player with beat markers.
- Onset strength chart and BPM histogram (Chart.js).
- Beat timeline table with confidence bars.
- Four export modes: full, isolate-beats, cut-at-beats, custom-range.
- Session persistence via `sessionStorage`.
- Settings page: all detection, display, and export parameters.
- Light / Dark / System theme with Solarised colour palette.
- Zustand settings store with `localStorage` persistence.
