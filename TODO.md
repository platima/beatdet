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

- [ ] ZIP bundle download for `cut-at-beats` mode (JSZip or fflate; replaces sequential browser downloads).
- [ ] Analysis cancellation via `AbortController` — allow user to stop mid-flight.
- [ ] CSV / JSON beat list export (copy to clipboard or download from BeatList).
- [ ] PWA manifest: `site.webmanifest`, `apple-touch-icon`, offline support.
- [ ] File size limit guard: validate before decoding; show friendly error for files over a configurable threshold (e.g., 200 MB).
- [ ] Virtual scrolling in BeatList for tracks with 500+ beats (react-virtual or similar).
- [ ] MP3 export: surface format selector and bitrate control in ExportPanel / settings.
- [ ] Waveform zoom: add slider to WaveformPlayer; wire to `waveformZoom` setting.
- [ ] Settings page: add Zustand persist migration strategy for future schema changes.
- [ ] Error boundary: wrap result components to prevent full-page crash on render error.
