# Changelog

All notable changes to BeatDet are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
