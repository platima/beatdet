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

### Progressive Web App

- [ ] PWA manifest: `site.webmanifest`, `apple-touch-icon`, offline support via service worker.

### Other

- [ ] Waveform zoom: add slider to WaveformPlayer; wire to `waveformZoom` setting (already in store).
- [ ] **Tempo confidence hints**: when detection confidence is low or the top two BPM candidates are in a common harmonic ratio (2:1, 3:1, 4:3), display an inline tip on the BPM card — e.g. "If this feels wrong, try the ÷2 button" or "Common issue with waltz tracks — the true tempo may be 3× this value". Extend the existing ×2 / ÷2 display-correction buttons to include ×3 / ÷3 for slow-waltz and fast-subdivision cases.
