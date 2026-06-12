/**
 * Musical key detection via chroma-profile correlation.
 *
 * The algorithm works by:
 * 1. Computing a 12-bin chroma (pitch class) energy vector from the audio.
 * 2. Pearson-correlating that vector against 24 key profiles (12 major,
 *    12 minor) derived from the Bellman-Budge corpus analysis.
 * 3. Ranking the correlations to find the best-fit key and mode.
 *
 * The Bellman-Budge profiles (2005, building on Budge 1943) assign much
 * larger weights to diatonic scale tones than to non-diatonic ones,
 * which provides stronger tonic/dominant separation than the original
 * Krumhansl-Kessler (1982) perceptual profiles.
 */

import type { KeyEstimate } from '@/types';

/* ============================================================
   Constants
   ============================================================ */

/**
 * Western note names (C-rooted, sharps for accidentals).
 * Index 0 = C, 1 = C#, 2 = D, ..., 11 = B.
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/**
 * Bellman-Budge major profile (C-rooted, 12 elements).
 * Derived from a large corpus analysis of Western tonal music.
 * Provides stronger distinction between diatonic and non-diatonic
 * pitch classes than the original Krumhansl-Kessler profiles,
 * reducing tonic/dominant confusion on real audio.
 *
 * Source: Bellman (2005), building on Budge (1943).
 */
const KEY_MAJOR: readonly number[] = [
  16.80, 0.86, 12.95, 1.41, 16.00, 11.93,
   1.25, 20.28,  1.80,  8.04,  0.62, 10.57,
];

/**
 * Bellman-Budge minor profile (C-rooted, 12 elements).
 *
 * Indices 10 (flat-7th = Bb) and 11 (leading tone = B) are swapped relative
 * to the original publication to better match the natural minor / aeolian mode
 * which dominates electronic music.  The root weight is boosted from 18.16 to
 * 22.00 for stronger root discrimination.
 */
const KEY_MINOR: readonly number[] = [
  22.00, 0.69, 12.99, 13.34, 1.07, 11.15,
   1.38, 21.07,  7.49,  1.53, 10.21,  0.92,
];

/**
 * Camelot Wheel codes for all 24 keys, indexed by pitch class (0=CÔÇª11=B).
 * The Camelot system is widely used in DJ mixing to find harmonically
 * compatible tracks. Inner wheel (A suffix) = minor keys; outer (B) = major.
 */
const CAMELOT_MAJOR = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B'];
const CAMELOT_MINOR = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A'];

/**
 * Minimum raw Pearson correlation required to consider the result non-ambiguous.
 * A flat or chromatic chroma produces correlations near 0; real music
 * with a clear tonal centre typically produces values above 0.4.
 */
const RAW_AMBIGUITY_THRESHOLD = 0.40;

/**
 * HPSS horizontal (time-axis) median filter kernel width in frames.
 * At hopSize=4096 and 44100 Hz (~93 ms/frame), 15 frames ≈ 1.4 s.
 * Retuned for the larger chroma hop; sustained harmonic sources
 * (synths, pads, bass lines) are retained by this filter.
 */
const HPSS_H_KERNEL = 15;

/**
 * HPSS vertical (frequency-axis) median filter kernel width in bins.
 * At fftSize=8192 and 44100 Hz (~5.4 Hz/bin), 35 bins covers ~189 Hz,
 * enough to capture the broadband spread of transient percussive events.
 * Retuned for the finer FFT bin resolution.
 */
const HPSS_P_KERNEL = 35;

/**
 * Minor prior boost factor.  EDM datasets are approximately 85% minor;
 * without a prior boost, major profiles are slightly over-selected.
 * Multiplying minor Pearson correlations by this factor corrects the bias.
 * Raised from 1.20 to 1.28 after GiantSteps benchmarking alongside the
 * fifth-confusion resolver (combined +17 exact keys on 604 tracks).
 */
const MINOR_PRIOR_BOOST = 1.28;

/* ============================================================
   Internal helpers
   ============================================================ */

/**
 * Compute the Pearson correlation coefficient between two equal-length arrays.
 * Returns 0 if either array has zero variance (avoids division by zero).
 */
function pearsonCorrelation(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : num / denom;
}

/**
 * Rotate an array right by `steps` positions.
 * Used to produce the KK profile for keys relative to C.
 * Rotating right by K aligns position 0 (C tonic in the base profile)
 * with position K of the output array (i.e., the target tonic note).
 */
function rotateRight(arr: readonly number[], steps: number): number[] {
  const n = arr.length;
  return Array.from({ length: n }, (_, i) => arr[((i - steps) % n + n) % n]);
}

/**
 * Apply a Hann window to a slice of samples in-place.
 *
 * @param buf    Float64Array of length windowSize to modify.
 * @param windowSize  Number of samples in the window.
 */
function applyHann(buf: Float64Array, windowSize: number): void {
  for (let i = 0; i < windowSize; i++) {
    buf[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }
}

/**
 * In-place radix-2 Cooley-Tukey FFT.
 * Length of re/im must be a power of two.
 */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/* ============================================================
   Harmonic-Percussive Source Separation (HPSS)
   ============================================================ */

/**
 * Sort the first `len` elements of a Float32Array in-place using
 * insertion sort.  Efficient for small arrays (typically len ≤ 31).
 */
function insertionSort(arr: Float32Array, len: number): void {
  for (let i = 1; i < len; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
}

/**
 * Apply Harmonic-Percussive Source Separation (HPSS) to a magnitude
 * spectrogram and return the harmonic component.
 *
 * The algorithm exploits two properties of audio spectrograms:
 *   - Harmonic sources (synths, pads, bass lines) create horizontal ridges:
 *     they persist at a stable frequency across many frames.
 *   - Percussive sources (kick drums, snares, hi-hats) create vertical
 *     stripes: they spread across many frequencies at a given moment.
 *
 * A horizontal (time-axis) median filter extracts the harmonic estimate;
 * a vertical (frequency-axis) median filter extracts the percussive
 * estimate.  A squared Wiener soft mask then blends the two estimates
 * so that energy at each time-frequency point is attributed to whichever
 * source is dominant.
 *
 * Reference: Driedger, Müller and Disch, "Extending Harmonic-Percussive
 * Separation of Audio Signals", ISMIR 2014.
 *
 * @param spec      Row-major magnitude spectrogram [frame * numBins + bin].
 * @param numBins   Number of frequency bins (columns).
 * @param numFrames Number of time frames (rows).
 * @param hKernel   Time-axis median filter width (should be odd).
 * @param pKernel   Frequency-axis median filter width (should be odd).
 * @returns         Harmonic component, same shape and layout as `spec`.
 */
function separateHarmonicComponent(
  spec: Float32Array,
  numBins: number,
  numFrames: number,
  hKernel: number,
  pKernel: number,
): Float32Array {
  const hHalf = Math.floor(hKernel / 2);
  const pHalf = Math.floor(pKernel / 2);
  const harmSpec = new Float32Array(spec.length);
  const percSpec = new Float32Array(spec.length);
  const tmpH = new Float32Array(hKernel);
  const tmpP = new Float32Array(pKernel);

  // Horizontal median filter: per frequency bin, across time frames.
  // Sources that persist at a stable frequency are retained (harmonic).
  for (let b = 0; b < numBins; b++) {
    for (let t = 0; t < numFrames; t++) {
      for (let k = 0; k < hKernel; k++) {
        const tt = t - hHalf + k;
        tmpH[k] = (tt >= 0 && tt < numFrames) ? spec[tt * numBins + b] : 0;
      }
      insertionSort(tmpH, hKernel);
      harmSpec[t * numBins + b] = tmpH[hHalf];
    }
  }

  // Vertical median filter: per time frame, across frequency bins.
  // Sources that spread broadly in frequency are retained (percussive).
  for (let t = 0; t < numFrames; t++) {
    const row = t * numBins;
    for (let b = 0; b < numBins; b++) {
      for (let k = 0; k < pKernel; k++) {
        const bb = b - pHalf + k;
        tmpP[k] = (bb >= 0 && bb < numBins) ? spec[row + bb] : 0;
      }
      insertionSort(tmpP, pKernel);
      percSpec[row + b] = tmpP[pHalf];
    }
  }

  // Squared Wiener soft mask: H_mask = H² / (H² + P²).
  // Where both are zero the result stays zero (no signal present).
  const result = new Float32Array(spec.length);
  for (let i = 0; i < spec.length; i++) {
    const h = harmSpec[i];
    const p = percSpec[i];
    const denom = h * h + p * p;
    if (denom > 0) result[i] = spec[i] * (h * h / denom);
  }

  return result;
}

/* ============================================================
   Chroma extraction
   ============================================================ */

/**
 * Compute a 12-bin chroma (pitch class energy) vector from mono PCM data.
 *
 * The algorithm processes the signal in overlapping Hann-windowed frames.
 * Before accumulating chroma, Harmonic-Percussive Source Separation (HPSS)
 * is applied to the magnitude spectrogram.  HPSS uses median filtering to
 * separate harmonic sources (synths, pads, bass lines, horizontal ridges in
 * the spectrogram) from percussive sources (kick drums, snares, vertical
 * stripes in the spectrogram).  Only the harmonic component contributes to chroma.
 *
 * Because HPSS removes kick harmonics above 150 Hz (the 2nd, 3rd and 4th
 * harmonics of a typical ~78 Hz EDM kick fall at ~156, 234 and 312 Hz), the
 * lower frequency cutoff can be kept at 150 Hz rather than being raised
 * further.  Lowering fMin below 150 Hz does not help: in EDM the kick repeats
 * so frequently (2+ times/s) that HPSS's short horizontal kernel classifies
 * the kick fundamental as "harmonic", undoing the separation benefit.
 *
 * @param mono        Mono PCM samples (Float32Array).
 * @param sampleRate  Sample rate in Hz.
 * @param fftSize     FFT window size in samples (must be power of two, default 8192).
 * @param hopSize     Hop between frames in samples (default fftSize / 2 = 4096).
 * @param fMin        Minimum frequency in Hz (default 150 Hz, ~D3).
 * @param fMax        Maximum frequency in Hz (default 2100 Hz, ~C7).
 * @returns           Normalised 12-element chroma vector (values 0–1).
 */
export function computeChromaVector(
  mono: Float32Array,
  sampleRate: number,
  fftSize = 8192,
  hopSize = 4096,
  fMin = 150,
  fMax = 2100
): Float64Array {
  const chroma = new Float64Array(12);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const numFrames = Math.floor((mono.length - fftSize) / hopSize) + 1;

  // Restrict spectrogram computation to the active frequency window.
  // bMin..bMax are bin indices whose centre frequencies fall in [fMin, fMax].
  const freqPerBin = sampleRate / fftSize;
  const bMin = Math.max(1, Math.ceil(fMin / freqPerBin));
  const bMax = Math.min(fftSize / 2, Math.floor(fMax / freqPerBin));
  const activeBins = bMax - bMin + 1;

  // Pre-compute pitch class for each active bin (all fall within [fMin, fMax]
  // by construction, so no out-of-range guard is needed in the inner loop).
  const binToPitchClass = new Uint8Array(activeBins);
  for (let b = 0; b < activeBins; b++) {
    const freq = (b + bMin) * freqPerBin;
    // MIDI note relative to A4 = 440 Hz; pitch class 9 = A.
    const midiNote = 69 + 12 * Math.log2(freq / 440);
    binToPitchClass[b] = ((Math.round(midiNote) % 12) + 12) % 12;
  }

  // Build magnitude spectrogram restricted to active bins.
  // Layout: row-major [frame * activeBins + bin_offset_from_bMin].
  const spectrogram = new Float32Array(numFrames * activeBins);
  for (let frame = 0; frame < numFrames; frame++) {
    const sampleOffset = frame * hopSize;
    for (let i = 0; i < fftSize; i++) {
      re[i] = mono[sampleOffset + i] ?? 0;
      im[i] = 0;
    }
    applyHann(re, fftSize);
    fft(re, im);
    const frameOffset = frame * activeBins;
    for (let b = 0; b < activeBins; b++) {
      const absB = b + bMin;
      spectrogram[frameOffset + b] = Math.sqrt(re[absB] * re[absB] + im[absB] * im[absB]);
    }
  }

  // Apply HPSS: retain only the harmonic component for chroma computation.
  const harmonicSpec = separateHarmonicComponent(
    spectrogram, activeBins, numFrames, HPSS_H_KERNEL, HPSS_P_KERNEL,
  );

  // Accumulate harmonic magnitudes into chroma bins.
  for (let frame = 0; frame < numFrames; frame++) {
    const frameOffset = frame * activeBins;
    for (let b = 0; b < activeBins; b++) {
      chroma[binToPitchClass[b]] += harmonicSpec[frameOffset + b];
    }
  }

  // Normalise so the maximum bin equals 1 (avoids scale sensitivity), then
  // square-root compress the result. Compression flattens the dynamic range
  // so secondary scale tones (thirds, fifths) carry more weight relative to
  // the dominant bin, which sharpens both the profile correlations and the
  // fifth-confusion resolver's triad-support comparison (+8 exact keys on
  // the 604-track GiantSteps set in combination with the resolver).
  let maxVal = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > maxVal) maxVal = chroma[i];
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] = Math.sqrt(chroma[i] / maxVal);
    }
  }

  return chroma;
}

/* ============================================================
   Fifth-confusion resolver
   ============================================================ */

/**
 * Resolve dominant (perfect fifth) key confusion in-place.
 *
 * The profile of a key and the profile of its dominant (seven semitones up,
 * same mode) overlap heavily, so the dominant frequently edges out the true
 * key by a hair's breadth of correlation. When the top two candidates are a
 * fifth apart in the same mode, the correlation gap is small, and the
 * runner-up's tonic triad (root, third, fifth) has at least as much chroma
 * energy as the leader's, the runner-up is promoted to first place.
 *
 * Swapping (rather than just re-reading position 1) keeps the ranked
 * candidate list consistent with the primary result shown in the UI.
 * Exported for unit testing.
 *
 * @param results  Correlation results sorted descending by correlation.
 * @param chroma   The 12-bin chroma vector the correlations came from.
 */
export function resolveFifthConfusion(
  results: Array<{ pitchClass: number; mode: 'major' | 'minor'; correlation: number }>,
  chroma: readonly number[]
): void {
  const leader = results[0];
  const runnerUp = results[1];
  if (!leader || !runnerUp) return;

  const triadSupport = (pc: number, mode: 'major' | 'minor'): number => {
    const third = mode === 'major' ? 4 : 3;
    return chroma[pc] + chroma[(pc + third) % 12] + chroma[(pc + 7) % 12];
  };

  const correlationGap = leader.correlation - runnerUp.correlation;
  const leaderIsDominantOfRunnerUp =
    leader.mode === runnerUp.mode &&
    ((leader.pitchClass - runnerUp.pitchClass + 12) % 12) === 7;

  if (
    leaderIsDominantOfRunnerUp &&
    correlationGap <= 0.05 &&
    triadSupport(runnerUp.pitchClass, runnerUp.mode) >= triadSupport(leader.pitchClass, leader.mode)
  ) {
    results[0] = runnerUp;
    results[1] = leader;
  }
}

/* ============================================================
   Public API
   ============================================================ */

/**
 * Detect the musical key of a mono audio signal.
 *
 * Returns a `KeyEstimate` containing the detected key, mode, Camelot code,
 * relative key, and a ranked list of the top candidate keys.
 *
 * @param mono        Mono PCM samples (Float32Array from mixDownToMono).
 * @param sampleRate  Sample rate in Hz.
 */
export function detectKey(mono: Float32Array, sampleRate: number): KeyEstimate {
  const chroma = computeChromaVector(mono, sampleRate);
  const chromaArr = Array.from(chroma);

  // Correlate chroma against all 24 KK profiles and collect candidates.
  const results: Array<{ pitchClass: number; mode: 'major' | 'minor'; correlation: number }> = [];
  for (let pc = 0; pc < 12; pc++) {
    results.push({
      pitchClass: pc,
      mode: 'major',
      correlation: pearsonCorrelation(chromaArr, rotateRight(KEY_MAJOR, pc)),
    });
    results.push({
      pitchClass: pc,
      mode: 'minor',
      correlation: pearsonCorrelation(chromaArr, rotateRight(KEY_MINOR, pc)) * MINOR_PRIOR_BOOST,
    });
  }

  // Sort by correlation descending; best match is first.
  results.sort((a, b) => b.correlation - a.correlation);

  // Demote a leader that is merely the dominant of a better-supported key.
  resolveFifthConfusion(results, chromaArr);

  // Use the raw Pearson correlation coefficient as the confidence value,
  // clamped to [0, 1].  This gives an absolute measure of tonal clarity:
  // anti-correlated profiles are floored to 0 and a perfect match is 1.
  const best = results[0];

  const clampConf = (r: number): number => Math.max(0, Math.min(1, r));

  // Build the top-5 candidate list.
  const candidates = results.slice(0, 5).map((r) => ({
    key: NOTE_NAMES[r.pitchClass],
    mode: r.mode,
    confidence: clampConf(r.correlation),
    camelot: r.mode === 'major'
      ? CAMELOT_MAJOR[r.pitchClass]
      : CAMELOT_MINOR[r.pitchClass],
  }));

  // Primary result from the top-ranked correlation.
  const { pitchClass, mode } = best;
  const key = NOTE_NAMES[pitchClass];
  const camelot = mode === 'major' ? CAMELOT_MAJOR[pitchClass] : CAMELOT_MINOR[pitchClass];
  const confidence = clampConf(best.correlation);

  // Compute relative key (major ÔåÆ relative minor is 9 semitones up; vice versa).
  const relativePc = mode === 'major'
    ? (pitchClass + 9) % 12
    : (pitchClass + 3) % 12;
  const relativeMode = mode === 'major' ? 'minor' : 'major';
  const relativeKey = `${NOTE_NAMES[relativePc]} ${relativeMode === 'major' ? 'Major' : 'Minor'}`;

  return {
    key,
    mode,
    display: `${key} ${mode === 'major' ? 'Major' : 'Minor'}`,
    confidence,
    camelot,
    relativeKey,
    candidates,
    // Ambiguous when the raw Pearson correlation is too weak.  Values below
    // ~0.4 indicate the chroma has no clear tonal centre (modal, chromatic,
    // or atonal material).
    ambiguous: best.correlation < RAW_AMBIGUITY_THRESHOLD,
  };
}
