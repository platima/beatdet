<img align="right" src="https://visitor-badge.laobi.icu/badge?page_id=platima.beatdet" height="20" />

# BeatDet _(Beat Detector)_

**v0.1.6** - Browser-based audio beat detection with interactive waveform visualisation.

100% "Vibe Coded" because I have NFI what I'm doing with waveform analysis at all!

No login required. No data leaves your browser; all processing uses the
[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) locally.

---

## Features

- **Upload** WAV, MP3, or M4A audio files via drag-and-drop or file picker.
- **Beat detection**: spectral-flux onset detection with adaptive peak picking.
- **BPM estimation**: multi-lag IOI accumulation with Gaussian histogram smoothing
  and harmonic octave correction.
- **Waveform player**: interactive playback with beat markers overlaid.
- **Onset strength chart**: onset curve with beat positions highlighted.
- **BPM histogram**: inter-beat interval distribution chart.
- **Beat timeline**: scrollable table of all detected beats with timestamps
  and confidence bars.
- **Export**: four export modes:
  - Full track (lossless WAV)
  - Isolate beats (merge beat regions into one file)
  - Cut at beats (one file per slice)
  - Custom time range
- **Session persistence**: last analysis is restored automatically on reload.
- **Settings page**: all parameters configurable without restarting.
- **Light / Dark / System theme** with Solarised colour palette throughout.
- **Semantic Versioning** tracked in `VERSION`.

---

## Tech Stack

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Framework    | Next.js 16 (App Router)           |
| Language     | TypeScript                        |
| Styling      | Tailwind CSS + Solarised palette  |
| State        | Zustand (with localStorage persist) |
| Audio engine | Web Audio API (native browser)    |
| Waveform     | wavesurfer.js                     |
| Charts       | Chart.js / react-chartjs-2        |
| Icons        | lucide-react                      |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:3000

# Production build
npm run build
npm start

# Run unit tests
npm test

# Test coverage report
npm run test:coverage

# Lint
npm run lint
```

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout (NavBar, ThemeInitialiser)
│   ├── page.tsx            # Main beat detection page
│   ├── globals.css         # Solarised CSS variables + Tailwind
│   └── settings/
│       └── page.tsx        # Settings page
├── components/
│   ├── AudioUploader.tsx   # Drag-and-drop file input
│   ├── BeatList.tsx        # Scrollable beat timeline table
│   ├── BpmDisplay.tsx      # BPM card with confidence meter
│   ├── BpmHistogram.tsx    # Bar chart of BPM distribution
│   ├── Button.tsx          # Reusable button component
│   ├── ExportPanel.tsx     # Export mode and download controls
│   ├── NavBar.tsx          # Top navigation with theme toggle
│   ├── OnsetChart.tsx      # Onset strength line chart
│   ├── ProgressBar.tsx     # Animated analysis progress bar
│   ├── ThemeInitialiser.tsx # FOUC-prevention script tag
│   └── WaveformPlayer.tsx  # wavesurfer.js waveform + controls
├── hooks/
│   ├── useAudioAnalysis.ts # File upload + analysis lifecycle hook
│   └── useTheme.ts         # Theme preference hook
├── lib/
│   ├── audioExport.ts      # WAV encoding and audio slicing
│   ├── beatDetection.ts    # Beat detection engine (Web Audio API)
│   └── sessionStorage.ts   # Session persistence helpers
├── store/
│   └── settingsStore.ts    # Zustand settings store
└── types/
    └── index.ts            # Shared TypeScript types
```

---

## Algorithm

1. **Decode**: `AudioContext.decodeAudioData` handles WAV/MP3/M4A.
2. **Mix down**: multi-channel audio is averaged to mono.
3. **Onset detection**: spectral flux computed over overlapping Hann-windowed
   frames (configurable hop size, default 512 samples). Energy envelope mode
   available as a faster alternative.
4. **Smoothing**: moving-average filter to reduce noise.
5. **Peak picking**: local maxima above a dynamic threshold (multiplicative
   local-median baseline), with minimum inter-beat gap enforcement and an
   absolute minimum height floor (prevents spurious detections in low-energy
   passages).
6. **BPM estimation**: multi-lag inter-onset intervals (lags 1-3, weighted
   1/lag) converted to BPM, accumulated into a Gaussian-smoothed histogram
   (0.5 BPM resolution, σ = 1.5 BPM), then passed through two-phase harmonic
   correction: downward (×0.5, ×1/3 at 40% threshold) to prefer the slower
   fundamental when subdivisions dominate, and upward (×1.5 at 60% threshold)
   to promote the faster tempo when the detector locked onto half-speed
   groupings. Histogram lookups use a ±1-bin maximum search for robustness
   against slight peak offsets. The minimum beat gap is automatically clamped
   to one beat period at the configured maximum BPM so fast tempos are never
   blocked.

---

## Settings

All settings persist across sessions in `localStorage`.

### Beat Detection

| Setting           | Default | Description                                 |
|-------------------|---------|---------------------------------------------|
| Peak threshold    | 0.15    | Fraction above local median required for a beat (0-1). |
| Min beat gap      | 0.3 s   | Minimum seconds between beats.              |
| Hop size          | 512     | Analysis frame hop in samples.              |
| Spectral flux     | on      | Use spectral flux vs energy envelope.       |
| Smoothing window  | 8       | Moving-average window in frames.            |
| BPM range         | 60-200  | Tempo range for BPM estimation.             |

### Display

| Setting            | Default | Description                              |
|--------------------|---------|------------------------------------------|
| Theme              | system  | light / dark / system preference.        |
| Beat marker colour | orange  | Solarised accent colour for beat markers.|
| Show confidence    | on      | Show confidence bars in beat timeline.   |
| Show onset curve   | on      | Show onset strength chart on main page.  |
| Histogram bins     | 40      | Number of bins in BPM histogram.         |

---

## Testing

Two test suites cover the beat detection engine:

- **Unit tests** (`beatDetection.test.ts`): 34 tests covering FFT correctness,
  onset strength functions, peak picking (including absolute height floor), and
  BPM estimation.
- **Real-audio integration tests** (`realAudio.test.ts`): 15 Kevin MacLeod
  tracks spanning 60-204 BPM, decoded via `node-web-audio-api` and run through
  the full spectral-flux -> peak-pick -> BPM-estimate pipeline. 13 pass
  outright (including 3 octave-tolerant), 2 are skipped as known limitations
  (3:2 harmonic ambiguity and missing-candidate detection failures).

```bash
# Run all tests
npm test

# Watch mode during development
npx jest --watch

# Coverage report
npm run test:coverage
```

Tests live in `src/lib/__tests__/`. The test framework is Jest with Next.js'
built-in SWC transformer (no ts-jest required). Real-audio tests require the
`testfiles/` directory containing the Kevin MacLeod MP3 benchmark tracks.

---

## Versioning

[Semantic Versioning](https://semver.org/) - version tracked in `VERSION`.

| Bump  | When                                    |
|-------|-----------------------------------------|
| PATCH | Each individual commit / bug fix.       |
| MINOR | Feature complete milestone.             |
| MAJOR | Breaking API or protocol change.        |

---

## Deployment (Cloudflare Pages)

The app is a fully static Next.js export; no server runtime required.

| Setting          | Value             |
|------------------|-------------------|
| Build command    | `npx next build`  |
| Output directory | `out`             |
| Node.js version  | 20+               |

In the Cloudflare dashboard: **Workers & Pages → Create → Connect to Git →**
select the `beatdet` repo, set the build settings above, and deploy.

---

## Licence

MIT
