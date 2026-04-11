/**
 * Musical key detection using the Krumhansl-Kessler algorithm.
 *
 * The algorithm works by:
 * 1. Computing a 12-bin chroma (pitch class) energy vector from the audio.
 * 2. Pearson-correlating that vector against 24 key profiles (12 major,
 *    12 minor) derived from the Krumhansl-Kessler tonal hierarchy study.
 * 3. Ranking the correlations to find the best-fit key and mode.
 *
 * References:
 *   Krumhansl & Kessler (1982) "Tracing the dynamic changes in perceived
 *   tonal organization in a spatial representation of musical keys."
 *   Psychological Review, 89(4), 334ÔÇô368.
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
 * Krumhansl-Kessler major profile (C-rooted, 12 elements).
 * Represents the perceived tonal hierarchy for major keys.
 */
const KK_MAJOR: readonly number[] = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
  2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];

/**
 * Krumhansl-Kessler minor profile (C-rooted, 12 elements).
 * Represents the perceived tonal hierarchy for natural minor keys.
 */
const KK_MINOR: readonly number[] = [
  6.33, 2.68, 3.52, 5.38, 2.60, 3.97,
  2.69, 4.94, 3.04, 3.41, 4.00, 2.62,
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
   Chroma extraction
   ============================================================ */

/**
 * Compute a 12-bin chroma (pitch class energy) vector from mono PCM data.
 *
 * The algorithm processes the signal in overlapping frames. Each frame is
 * Hann-windowed before FFT. Spectral magnitude is accumulated into the
 * chroma bin corresponding to the nearest 12-TET pitch class. Only
 * frequencies in the musically meaningful range [fMin, fMax] are considered.
 *
 * @param mono        Mono PCM samples (Float32Array).
 * @param sampleRate  Sample rate in Hz.
 * @param fftSize     FFT window size in samples (must be power of two, default 4096).
 * @param hopSize     Hop between frames in samples (default fftSize / 2).
 * @param fMin        Minimum frequency to include in Hz (default 65 Hz, ~C2).
 * @param fMax        Maximum frequency to include in Hz (default 2100 Hz, ~C7).
 * @returns           Normalised 12-element chroma vector (values 0ÔÇô1).
 */
export function computeChromaVector(
  mono: Float32Array,
  sampleRate: number,
  fftSize = 4096,
  hopSize = 2048,
  fMin = 65,
  fMax = 2100
): Float64Array {
  const chroma = new Float64Array(12);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const numFrames = Math.floor((mono.length - fftSize) / hopSize) + 1;

  // Pre-compute which FFT bin each pitch class maps to so we can do an O(n)
  // lookup rather than computing log2 for every bin in every frame.
  // Build a binÔåÆpitchClass lookup table (value ÔêÆ1 means "out of range").
  const numBins = fftSize / 2 + 1;
  const binToPitchClass = new Int8Array(numBins).fill(-1);
  const freqPerBin = sampleRate / fftSize;
  for (let b = 1; b < numBins; b++) {
    const freq = b * freqPerBin;
    if (freq < fMin || freq > fMax) continue;
    // MIDI note relative to A4 = 440 Hz; pitch class 9 = A.
    const midiNote = 69 + 12 * Math.log2(freq / 440);
    const pitchClass = ((Math.round(midiNote) % 12) + 12) % 12;
    binToPitchClass[b] = pitchClass;
  }

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;

    // Fill re with samples, im with zeros
    for (let i = 0; i < fftSize; i++) {
      re[i] = mono[offset + i] ?? 0;
      im[i] = 0;
    }

    applyHann(re, fftSize);
    fft(re, im);

    // Accumulate magnitude into chroma bins
    for (let b = 0; b < numBins; b++) {
      const pc = binToPitchClass[b];
      if (pc === -1) continue;
      const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      chroma[pc] += mag;
    }
  }

  // Normalise so the maximum bin equals 1 (avoids scale sensitivity).
  let maxVal = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > maxVal) maxVal = chroma[i];
  if (maxVal > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxVal;

  return chroma;
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
      correlation: pearsonCorrelation(chromaArr, rotateRight(KK_MAJOR, pc)),
    });
    results.push({
      pitchClass: pc,
      mode: 'minor',
      correlation: pearsonCorrelation(chromaArr, rotateRight(KK_MINOR, pc)),
    });
  }

  // Sort by correlation descending; best match is first.
  results.sort((a, b) => b.correlation - a.correlation);

  // Normalise confidences to [0, 1] using the range of the top results.
  // This makes confidence comparable across tracks with varying spectral clarity.
  const best = results[0];
  const worst = results[results.length - 1];
  const corrRange = best.correlation - worst.correlation;

  const normaliseConf = (r: number): number =>
    corrRange > 0 ? (r - worst.correlation) / corrRange : 1;

  // Build the top-5 candidate list.
  const candidates = results.slice(0, 5).map((r) => ({
    key: NOTE_NAMES[r.pitchClass],
    mode: r.mode,
    confidence: normaliseConf(r.correlation),
    camelot: r.mode === 'major'
      ? CAMELOT_MAJOR[r.pitchClass]
      : CAMELOT_MINOR[r.pitchClass],
  }));

  // Primary result from the top-ranked correlation.
  const { pitchClass, mode } = best;
  const key = NOTE_NAMES[pitchClass];
  const camelot = mode === 'major' ? CAMELOT_MAJOR[pitchClass] : CAMELOT_MINOR[pitchClass];
  const confidence = normaliseConf(best.correlation);

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
    // Ambiguous when the raw Pearson correlation is too weak ÔÇö the normalised
    // confidence is relative across candidates and is always 1 for the winner,
    // so the raw value is a better indicator of absolute tonal clarity.
    ambiguous: best.correlation < RAW_AMBIGUITY_THRESHOLD,
  };
}
