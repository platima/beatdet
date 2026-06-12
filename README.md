<img align="right" src="https://visitor-badge.laobi.icu/badge?page_id=platima.beatdet" height="20" />

# BeatDet _(Beat Detector)_

**v0.7.14** - Browser-based audio beat detection with interactive waveform visualisation.

100% "Vibe Coded" because I have NFI what I'm doing with waveform analysis at all!

No login required. No data leaves your browser; all processing uses the
[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) locally.

---

## Try It

**[beatdet.plati.ma](https://beatdet.plati.ma/)** - live on Cloudflare Pages, no install needed.

Drop in any WAV, MP3, M4A, or AAC file and get BPM, key, beat markers, and export options in seconds.

Everything runs **locally in your browser** — no upload, no server, no account needed. Works great on mobile too.

In informal testing across 26 randomly sampled [Kevin MacLeod](https://incompetech.com) tracks (60-204 BPM),
BeatDet was more accurate more often than both [Tunebat](https://tunebat.com/Analyzer) and [AudioAlter](https://audioalter.com/bpm-detector).

---

## Features

- **Upload** WAV, MP3, M4A, or AAC audio files via drag-and-drop or file picker (max 100 MB).
- **Beat detection**: spectral-flux onset detection with adaptive peak picking.
- **BPM estimation**: multi-lag IOI accumulation with Gaussian histogram smoothing
  and harmonic octave correction.
- **Key detection**: chroma-profile correlation (Bellman-Budge profiles) identifies the
  musical key (e.g. "C Major"), Camelot Wheel code for DJ-friendly harmonic mixing,
  relative key, and top-5 candidates with confidence bars. Toggleable in Settings.
- **BPM correction**: clickable tempo candidates and ÷2 / ×2 display-only quick-correct buttons for common octave errors. Clicking a candidate sets that tempo as the displayed BPM.
- **Waveform player**: interactive playback with beat markers overlaid; Space bar toggles play/pause; **R** restarts; **L** toggles the loop region; **X**/**Z** zoom in/out; **]**/**[** volume up/down.
- **Playback speed control**: 0.5×, 0.75×, 1×, and 1.5× speed buttons for slowed-down beat verification.
- **Loop region**: toggle a draggable, resizable region on the waveform; playback loops within the region boundary.
- **Tap tempo**: tap a button to the beat on the BPM card to measure and optionally apply a tempo override.
- **Keyboard shortcuts**: press **?** or click the keyboard icon in the nav to see all shortcuts (Space, R, L, X, Z, ], [, S, ?).
- **Global drag-and-drop**: drag an audio file anywhere on the page (not just over the uploader) to load or replace the current track; a full-page overlay shows the drop affordance.
- **Waveform zoom**: adjustable zoom slider; setting is persisted automatically.
- **Click-to-seek**: click any row in the beat timeline to jump the waveform to that beat.
- **Onset strength chart**: onset curve with beat positions highlighted.
- **BPM histogram**: inter-beat interval distribution chart.
- **Beat timeline**: virtualised table of all detected beats with timestamps
  and confidence bars; handles 500+ beats without DOM bloat; download as CSV or JSON.
- **Cancellable analysis**: cancel button shown during processing; uploading a new file automatically cancels any in-flight analysis.
- **Export**: four export modes with WAV or MP3 output:
  - Full track
  - Isolate beats (merge beat regions into one file)
  - Cut at beats (slices bundled into a single ZIP)
  - Custom time range
- **MP3 export**: 128 / 192 / 256 / 320 kbps selectable via `@breezystack/lamejs`.
- **Re-analyse**: re-run beat detection on the same file after changing settings without re-uploading.
- **Session persistence**: last analysis is restored automatically on reload.
- **Installable PWA**: add to home screen on mobile or install on desktop; offline shell cached by the service worker with network-first navigation.
- **In-app changelog**: `/changelog` page with full release history.
- **What's New banner**: shown to returning users after an upgrade.
- **Error boundaries**: failed panels show a recovery UI without crashing the page.
- **Settings page**: all parameters configurable without restarting.
- **Light / Dark / System theme** with Solarised colour palette throughout; waveform colours update live on theme change.
- **Modern UI**: elevated panels, accent dots, subtle shadows, and animated transitions; revert to the classic flat look via "Use classic UI" in Settings.
- **Accessible**: ARIA labels, live regions, and screen-reader chart summaries throughout.
- **Semantic Versioning** tracked in `VERSION`; version injected at build time from `VERSION` file.

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
| MP3 export   | @breezystack/lamejs               |
| ZIP export   | fflate                            |
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

# Autoresearch combined benchmark
npm run bench:autoresearch

# Autoresearch key-only benchmark
npm run bench:autoresearch:key

# Autoresearch tempo-only benchmark
npm run bench:autoresearch:tempo
```

### Autoresearch Benchmarking

The `autoresearch/` tooling now supports three local benchmark lanes:

- `autoresearch/benchmark.mjs`: combined acceptance benchmark for final keep/discard decisions.
- `autoresearch/benchmark-key.mjs`: key-only benchmark with confusion diagnostics.
- `autoresearch/benchmark-tempo.mjs`: tempo-only benchmark with half/double/wrong breakdowns.

The recommended workflow is to tune key-only or tempo-only changes with the split harnesses,
then confirm any candidate keep with the combined benchmark. Local TSV ledgers such as
`results-combined.tsv`, `results-key.tsv`, and `results-tempo.tsv` are ignored by Git.

To saturate spare CPU, the benchmark wrappers can also load an alternate algorithm file
via `AUTORESEARCH_ALGORITHM` or the first CLI argument. That makes it practical to fan out
several ignored candidate files under `autoresearch/candidates/` and benchmark them in
parallel without mutating the baseline `autoresearch/algorithm.mjs` between runs.

---

## Project Structure

```
public/
└── sw.js               # Service worker (offline cache, network-first navigation)
src/
├── app/
│   ├── layout.tsx          # Root layout (NavBar, viewport, inline theme script)
│   ├── manifest.ts         # PWA web app manifest
│   ├── apple-icon.tsx      # 180x180 apple touch icon (ImageResponse)
│   ├── icon1.tsx           # 192x192 PWA icon (ImageResponse)
│   ├── icon2.tsx           # 512x512 PWA icon (ImageResponse)
│   ├── page.tsx            # Main beat detection page
│   ├── globals.css         # Solarised CSS variables + Tailwind
│   ├── changelog/
│   │   └── page.tsx        # Changelog page (server component, reads CHANGELOG.md)
│   └── settings/
│       └── page.tsx        # Settings page
├── components/
│   ├── AudioUploader.tsx   # Drag-and-drop file input
│   ├── BeatList.tsx        # Virtualised beat timeline table (@tanstack/react-virtual)
│   ├── BpmDisplay.tsx      # BPM card with confidence, candidates, and tap tempo
│   ├── BpmHistogram.tsx    # Bar chart of BPM distribution
│   ├── Button.tsx          # Reusable button component
│   ├── ErrorBoundary.tsx   # React class error boundary for result panels
│   ├── ExportPanel.tsx     # Export mode and download controls
│   ├── KeyDisplay.tsx      # Key detection card (Camelot, candidates)
│   ├── NavBar.tsx          # Top navigation, theme toggle, keyboard shortcuts help
│   ├── OnsetChart.tsx      # Onset strength line chart
│   ├── ProgressBar.tsx             # Animated analysis progress bar
│   ├── ServiceWorkerRegistrar.tsx  # Service worker registration (PWA)
│   ├── ThemeInitialiser.tsx        # (legacy) Theme DOM sync
│   ├── WhatsNewBanner.tsx          # Dismissible upgrade banner (localStorage-based)
│   └── WaveformPlayer.tsx          # wavesurfer.js waveform, loop regions, speed controls
├── hooks/
│   ├── useAudioAnalysis.ts # File upload + analysis lifecycle hook
│   └── useTheme.ts         # Theme preference hook
├── lib/
│   ├── audioExport.ts      # WAV/MP3 encoding, ZIP bundling, and audio slicing
│   ├── beatDetection.ts    # Beat detection engine (Web Audio API)
│   ├── hintUtils.ts        # Detection hint logic (buildHints, isCloseRatio)
│   ├── keyDetection.ts     # Key detection engine (Bellman-Budge chroma correlation)
│   ├── sessionStorage.ts   # Session persistence helpers
│   └── __tests__/          # Unit + integration tests
│       ├── audioExport.test.ts   # WAV encoding, slicing, normalisation, ZIP tests
│       ├── beatDetection.test.ts # FFT, onset, peak picking, BPM estimation tests
│       ├── hintUtils.test.ts     # Hint logic unit tests
│       ├── keyDetection.test.ts  # Key detection unit tests
│       └── realAudio.test.ts     # Kevin MacLeod benchmark integration tests
├── store/
│   └── settingsStore.ts    # Zustand settings store (schema v4, auto-migration)
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
   (0.5 BPM resolution, σ = 2.5 BPM), then passed through two-phase harmonic
   correction: downward (×0.5, ×1/3 at 30% threshold) to prefer the slower
   fundamental when subdivisions dominate, and upward (×1.5 at 45% threshold,
   ×3 at 70% threshold) to promote the faster tempo when the detector locked
   onto half-speed or third-speed groupings. Histogram lookups use a ±1-bin
   maximum search for robustness
   against slight peak offsets. The minimum beat gap is automatically clamped
   to one beat period at the configured maximum BPM so fast tempos are never
   blocked.
7. **Key detection**: a 12-bin chroma (pitch class energy) vector is computed
   from the mono PCM using a separate FFT pass (8192-point, Hann-windowed,
   150-2100 Hz). Before chroma accumulation, Harmonic-Percussive Source
   Separation (HPSS) is applied: horizontal (15-frame) and vertical (35-bin)
   median filters on the spectrogram separate sustained harmonic content
   (synths, pads, bass lines) from transient percussive bursts (kick drums,
   snares). Only the harmonic component contributes to chroma. This suppresses
   kick drum harmonics above 150 Hz that would otherwise bias the chroma
   vector. The 150 Hz lower cutoff is retained to block the kick fundamental
   (~50-130 Hz), which HPSS cannot cleanly separate because the kick repeats
   so frequently in EDM. Minor Pearson correlations are boosted by a 1.28×
   prior factor to correct for the strong minor-key prevalence in electronic
   music datasets.
   The normalised chroma vector is square-root compressed (flattening the
   dynamic range so secondary scale tones carry more weight), then
   Pearson-correlated against all 24
   Bellman-Budge major/minor key profiles (corpus-derived, stronger
   diatonic/non-diatonic separation than the original Krumhansl-Kessler
   profiles). A fifth-confusion resolver then demotes a winning key that is
   merely the dominant (a perfect fifth above) of the runner-up when the
   correlation gap is tiny and the runner-up's tonic triad carries at least
   as much chroma energy. The best-fit key, Camelot Wheel code, relative key,
   and top-5 candidates are returned. An ambiguity flag is set when the raw
   correlation is below 0.40 (flat or chromatic material), and a close-call
   warning names the runner-up key whenever its correlation is within 0.05
   of the winner, so near-tied results are never presented as certain.

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
| BPM range         | 55-200  | Tempo range for BPM estimation.             |

### Display

| Setting            | Default | Description                              |
|--------------------|---------|------------------------------------------|
| Theme              | system  | light / dark / system preference.        |
| Classic UI         | off     | Revert to flat pre-v0.6 visual style.    |
| Show key detection | on      | Display key and Camelot code in results.  |
| Beat marker colour | orange  | Solarised accent colour for beat markers.|
| Waveform height    | 120 px  | Waveform display height (80/120/160/200).|
| Show confidence    | on      | Show confidence bars in beat timeline.   |
| Show onset curve   | on      | Show onset strength chart on main page.  |
| Histogram bins     | 40      | Number of bins in BPM histogram.         |

---

## Testing

Four test suites cover the core libraries:

- **Beat detection unit tests** (`beatDetection.test.ts`): 34 tests covering
  FFT correctness, onset strength functions, peak picking (including absolute
  height floor), and BPM estimation.
- **Key detection unit tests** (`keyDetection.test.ts`): 18 tests covering
  chroma vector computation, Bellman-Budge profile correlation, Camelot codes,
  relative key calculation, candidate ranking, and ambiguity detection.
- **Hint logic unit tests** (`hintUtils.test.ts`): 31 tests for `buildHints`
  and `isCloseRatio`, covering octave errors, 3:2/4:3 ratio hints, low
  confidence warnings, short-clip detection, and suppression when the algorithm
  already corrected a ratio.
- **Audio export unit tests** (`audioExport.test.ts`): 17 tests for WAV
  encoding, peak normalisation, buffer slicing, concatenation, and ZIP
  bundling.
- **Real-audio integration tests** (`realAudio.test.ts`): 26 Kevin MacLeod
  tracks spanning 54–204 BPM, decoded via `node-web-audio-api` and run through
  the full spectral-flux → peak-pick → BPM-estimate pipeline. 20 pass
  outright (including 7 octave-tolerant), 6 are skipped as known limitations
  (3:2 harmonic ambiguity, missing-candidate failures, too-short clips).
  Also includes 3 known-key verification tests (1 passing: Für Elise = A Minor;
  2 skipped as known limitations: Canon In D 8-bit synth timbre, Eine Kleine
  Nachtmusik sonata-form modulation).

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
