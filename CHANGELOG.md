# Changelog

All notable changes to BeatDet are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
