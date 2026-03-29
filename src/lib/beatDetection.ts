/**
 * Beat detection engine: pure TypeScript implementation using the Web Audio API.
 *
 * Algorithm overview:
 *   1. Decode the audio file into a raw PCM buffer via the Web Audio API.
 *   2. Compute the onset strength signal (energy or spectral flux per hop).
 *   3. Smooth the onset curve to reduce noise.
 *   4. Pick peaks above a dynamic threshold.
 *   5. Convert peaks to beat timestamps and estimate tempo via IOI clustering.
 *
 * All processing is done off the main thread via an AudioContext created
 * specifically for decoding (OfflineAudioContext).
 */

import type { AnalysisResult, Beat, BpmEstimate, DetectionSettings } from '@/types';

/* ============================================================
   Internal helpers
   ============================================================ */

/** Compute the mean of an array slice. */
function mean(arr: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += arr[i];
  return sum / (end - start);
}

/** Mix a multi-channel AudioBuffer down to mono by averaging channels. */
export function mixDownToMono(buffer: AudioBuffer): Float32Array {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i];
    }
  }

  if (numChannels > 1) {
    for (let i = 0; i < length; i++) {
      mono[i] /= numChannels;
    }
  }

  return mono;
}

/* ============================================================
   Fast FFT: Cooley-Tukey radix-2 DIT (in-place, power-of-two)
   ============================================================ */

/** In-place radix-2 FFT. re and im must have length that is a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
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

  // Cooley-Tukey butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);

    for (let i = 0; i < n; i += len) {
      let curRe = 1.0;
      let curIm = 0.0;
      for (let j = 0; j < len >> 1; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + (len >> 1)] * curRe - im[i + j + (len >> 1)] * curIm;
        const vIm = re[i + j + (len >> 1)] * curIm + im[i + j + (len >> 1)] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + (len >> 1)] = uRe - vRe;
        im[i + j + (len >> 1)] = uIm - vIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }
}

/**
 * Compute the onset strength using spectral flux (O(N log N) per hop).
 * Positive flux (increase in spectral magnitude) indicates an onset.
 */
export function computeSpectralFlux(
  mono: Float32Array,
  sampleRate: number,
  hopSize: number
): Float32Array {
  // Use next power-of-two >= hopSize * 2 as our FFT size (powers of 2 required)
  const fftSize = hopSize * 2;
  const halfBins = fftSize >> 1;
  const numHops = Math.floor((mono.length - fftSize) / hopSize);
  if (numHops <= 0) return new Float32Array(0);

  const onsets = new Float32Array(numHops);
  const reBuffer = new Float64Array(fftSize);
  const imBuffer = new Float64Array(fftSize);
  let prevMags = new Float32Array(halfBins);

  for (let hop = 0; hop < numHops; hop++) {
    const start = hop * hopSize;

    // Fill FFT buffers with Hann-windowed samples
    for (let n = 0; n < fftSize; n++) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)));
      reBuffer[n] = mono[start + n] * w;
      imBuffer[n] = 0;
    }

    fft(reBuffer, imBuffer);

    // Compute magnitude spectrum for positive frequencies
    const mags = new Float32Array(halfBins);
    for (let k = 0; k < halfBins; k++) {
      mags[k] = Math.sqrt(reBuffer[k] * reBuffer[k] + imBuffer[k] * imBuffer[k]);
    }

    // Half-wave rectified spectral flux (positive differences only)
    if (hop > 0) {
      let flux = 0;
      for (let k = 0; k < halfBins; k++) {
        const diff = mags[k] - prevMags[k];
        if (diff > 0) flux += diff;
      }
      onsets[hop] = flux;
    }

    prevMags = mags;
  }

  return onsets;
}

/**
 * Compute onset strength using the simple RMS energy envelope.
 * O(N): fastest option, good for percussive material.
 */
export function computeEnergyEnvelope(
  mono: Float32Array,
  hopSize: number
): Float32Array {
  const numHops = Math.floor(mono.length / hopSize);
  const onsets = new Float32Array(numHops);

  let prevEnergy = 0;
  for (let hop = 0; hop < numHops; hop++) {
    const start = hop * hopSize;
    let rms = 0;
    for (let i = start; i < start + hopSize && i < mono.length; i++) {
      rms += mono[i] * mono[i];
    }
    rms = Math.sqrt(rms / hopSize);
    const diff = rms - prevEnergy;
    onsets[hop] = diff > 0 ? diff : 0;
    prevEnergy = rms;
  }

  return onsets;
}

/**
 * Apply a simple moving-average smoother to reduce noise in the onset curve.
 */
export function smoothArray(arr: Float32Array, windowSize: number): Float32Array {
  if (windowSize <= 1) return arr;
  const half = Math.floor(windowSize / 2);
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(arr.length, i + half + 1);
    out[i] = mean(arr, start, end);
  }
  return out;
}

/**
 * Normalise an array to [0, 1] range.
 */
export function normalise(arr: Float32Array): Float32Array {
  let max = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  if (max === 0) return arr;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] / max;
  return out;
}

/**
 * Adaptive peak picking: finds local maxima in the onset curve that
 * exceed a dynamic threshold based on a local median.
 *
 * @param absMinHeight  Absolute minimum normalised height for a peak to be
 *                      considered (0–1). Prevents spurious detections in
 *                      low-energy passages where the local median collapses
 *                      to near-zero. Pass 0 to disable.
 *
 * Returns an array of hop indices where beats occur.
 */
export function pickPeaks(
  onsets: Float32Array,
  peakThreshold: number,
  minGapFrames: number,
  absMinHeight: number = 0
): number[] {
  const peaks: number[] = [];
  const medianWindow = 16; // half-window for local median

  let lastPeakFrame = -minGapFrames;

  for (let i = 1; i < onsets.length - 1; i++) {
    const val = onsets[i];

    // Must be a local maximum
    if (val <= onsets[i - 1] || val <= onsets[i + 1]) continue;

    // Absolute height floor: filters spurious noise peaks
    if (val < absMinHeight) continue;

    // Compute local median baseline
    const wStart = Math.max(0, i - medianWindow);
    const wEnd = Math.min(onsets.length, i + medianWindow);
    const window: number[] = [];
    for (let j = wStart; j < wEnd; j++) window.push(onsets[j]);
    window.sort((a, b) => a - b);
    const localMedian = window[Math.floor(window.length / 2)];

    // Dynamic threshold: peak must be peakThreshold fraction above the local median.
    // Uses a multiplicative relationship so the threshold scales with signal level.
    if (val < localMedian * (1.0 + peakThreshold)) continue;

    // Enforce minimum inter-beat gap
    if (i - lastPeakFrame < minGapFrames) continue;

    peaks.push(i);
    lastPeakFrame = i;
  }

  return peaks;
}

/**
 * Estimate BPM from a list of beat timestamps by analysing inter-onset
 * intervals (IOIs) at multiple lags, with Gaussian histogram smoothing and
 * harmonic octave correction.
 *
 * Multi-lag accumulation: IOIs between beats at lags 1, 2, and 3 are each
 * normalised to a single-beat interval and weighted by 1/lag. This lets the
 * algorithm recover the fundamental period even when subdivisions dominate the
 * detected beat list.
 *
 * Gaussian smoothing: each IOI→BPM value smears weight across neighbouring
 * bins with σ=1.5 BPM, avoiding quantisation gaps at high tempos.
 *
 * Harmonic correction: after finding the best candidate, check downward
 * ratios (x0.5, x1/3) for significant histogram energy; if found, prefer
 * the slower tempo.  x0.5 applies a slow-tempo gate: when the resulting
 * BPM would be below 80 (uncommon musical tempo), a strict 95 % threshold
 * is required to prevent false half-tempo corrections; above 80 the
 * standard 40 % applies.  If no downward correction triggers, check the
 * upward ×1.5 (sesquialtera) ratio with a 60 % threshold to catch
 * half-speed groupings.
 */
export function estimateBpm(
  beatTimes: number[],
  bpmMin: number,
  bpmMax: number
): BpmEstimate {
  if (beatTimes.length < 2) {
    return { bpm: 0, candidates: [], confidence: 0 };
  }

  const minIoi = 60 / bpmMax;
  const maxIoi = 60 / bpmMin;

  // --- Multi-lag weighted IOI accumulation ---
  // Evaluating lags 1, 2, 3 captures subdivisions and lets us vote for the
  // fundamental period even if the beat list is noisy.
  const weightedIois: Array<{ bpm: number; weight: number }> = [];
  for (let lag = 1; lag <= 3; lag++) {
    const lagWeight = 1 / lag;
    for (let i = lag; i < beatTimes.length; i++) {
      const ioi = (beatTimes[i] - beatTimes[i - lag]) / lag; // normalised to 1-beat IOI
      if (ioi < minIoi || ioi > maxIoi) continue;
      weightedIois.push({ bpm: 60 / ioi, weight: lagWeight });
    }
  }

  if (weightedIois.length === 0) return { bpm: 0, candidates: [], confidence: 0 };

  // --- Gaussian-smoothed BPM histogram ---
  // 0.5 BPM resolution with σ=1.5 BPM avoids the quantisation errors that
  // appear at high BPMs with integer binning.
  const bpmRes = 0.5;
  const sigma = 1.5;
  const numBins = Math.round((bpmMax - bpmMin) / bpmRes) + 1;
  const hist = new Float64Array(numBins);
  const sigBins = sigma / bpmRes;
  const spreadRadius = Math.ceil(sigBins * 3);

  for (const { bpm, weight } of weightedIois) {
    const binCenter = (bpm - bpmMin) / bpmRes;
    const lo = Math.max(0, Math.round(binCenter - spreadRadius));
    const hi = Math.min(numBins - 1, Math.round(binCenter + spreadRadius));
    for (let b = lo; b <= hi; b++) {
      const dist = b - binCenter;
      hist[b] += weight * Math.exp(-0.5 * (dist / sigBins) ** 2);
    }
  }

  // --- Collect top candidates from histogram peaks ---
  const candidates: Array<{ bpm: number; score: number }> = [];
  for (let b = 1; b < numBins - 1; b++) {
    if (hist[b] > hist[b - 1] && hist[b] >= hist[b + 1]) {
      candidates.push({ bpm: bpmMin + b * bpmRes, score: hist[b] });
    }
  }
  if (candidates.length === 0) {
    // Fallback: just pick the argmax
    let best = 0;
    for (let b = 1; b < numBins; b++) if (hist[b] > hist[best]) best = b;
    candidates.push({ bpm: bpmMin + best * bpmRes, score: hist[best] });
  }
  candidates.sort((a, b) => b.score - a.score);

  // --- Harmonic correction ---
  // The onset detector can lock onto subdivisions (8th-notes, triplets) or
  // miss every other beat, producing a raw BPM that is a simple harmonic
  // ratio of the true musical tempo.  We correct in two phases:
  //
  // Phase 1 - downward: if a candidate at x0.5 or x1/3 of the leader has
  //   significant histogram energy, prefer the slower (more musical) tempo.
  //   x2/3 is deliberately excluded; it causes false corrections on tracks
  //   where the leader IS the correct tempo (e.g. 126 -> 84 in Southern
  //   Gothic, 201 -> 134 in Sergio's Dustbin).
  //
  // Phase 2 - upward (sesquialtera): if phase 1 didn't trigger and the
  //   leader x1.5 has very strong energy (>= 60%), the detector tracked
  //   half-speed groupings; promote to the faster tempo.
  const leader = candidates[0];

  // Helper: look up the histogram energy near an arbitrary BPM.  Searches
  // ±1 bin around the target and returns the maximum, giving ±0.5 BPM
  // tolerance so that peaks sitting slightly off the exact harmonic ratio
  // are not missed (histogram resolution is 0.5 BPM).
  const histScoreAt = (bpm: number): number => {
    const bin = (bpm - bpmMin) / bpmRes;
    const lo = Math.max(0, Math.floor(bin) - 1);
    const hi = Math.min(numBins - 1, Math.ceil(bin) + 1);
    let best = 0;
    for (let b = lo; b <= hi; b++) {
      if (hist[b] > best) best = hist[b];
    }
    return best;
  };

  // Phase 1 - downward correction (first match wins)
  //
  // x0.5 threshold depends on the resulting tempo.  Half-tempo energy is
  // an almost universal artefact (every-other-beat IOI patterns routinely
  // reach 80-95 % of the leader).  If the resulting BPM is below 80 (an
  // uncommon musical tempo), we demand near-parity (95 %) to prevent false
  // corrections (e.g. 133 BPM Canon in D → 67).  Above 80 the standard
  // 40 % threshold applies, since a leader above ~160 is likely genuine
  // subdivisions that should be halved (e.g. 209 → 105 Adeste Fideles).
  //
  // x1/3 keeps 40 % regardless; triple-tempo artefacts are far less common.
  const SLOW_TEMPO_FLOOR = 80;
  const STRICT_HALF_THRESHOLD = 0.95;
  const DEFAULT_DOWN_THRESHOLD = 0.40;
  let corrected = false;
  // Record which ratio was applied, if any, so the UI can suppress
  // redundant harmonic hints when the algorithm already self-corrected.
  let correctionRatio: number | undefined;
  for (const ratio of [0.5, 1 / 3]) {
    const altBpm = leader.bpm * ratio;
    if (altBpm < bpmMin || altBpm > bpmMax) continue;
    const altScore = histScoreAt(altBpm);
    // For x0.5, use a strict threshold when the result is a very slow tempo.
    const threshold =
      ratio === 0.5 && altBpm < SLOW_TEMPO_FLOOR
        ? STRICT_HALF_THRESHOLD
        : DEFAULT_DOWN_THRESHOLD;
    if (altScore >= leader.score * threshold) {
      candidates.unshift({ bpm: Math.round(altBpm * 2) / 2, score: altScore });
      corrected = true;
      correctionRatio = ratio;
      break;
    }
  }

  // Phase 2 - upward corrections (first match wins)
  //
  // ×1.5 (sesquialtera): detector locked onto every-other-beat groupings.
  // ×3: detector locked onto every-third-beat (e.g. 62 detected for a 186 BPM
  //   waltz where the strong downbeat is 3× the onset rate).
  //   Threshold is kept tight (70 %) to avoid false promotions on tracks
  //   whose true tempo genuinely sits near the ×3 candidate.
  if (!corrected) {
    for (const [ratio, threshold] of [[1.5, 0.60], [3, 0.70]] as const) {
      const altBpm = leader.bpm * ratio;
      if (altBpm >= bpmMin && altBpm <= bpmMax) {
        const altScore = histScoreAt(altBpm);
        if (altScore >= leader.score * threshold) {
          candidates.unshift({ bpm: Math.round(altBpm * 2) / 2, score: altScore });
          correctionRatio = ratio;
          break;
        }
      }
    }
  }

  const maxScore = candidates[0].score;
  // Confidence: ratio of winning score to a baseline of the total votes.
  const totalWeight = weightedIois.reduce((s, x) => s + x.weight, 0);
  const confidence = Math.min(1, maxScore / Math.max(1, totalWeight * 0.3));

  return {
    bpm: Math.round(candidates[0].bpm),
    candidates: candidates.slice(0, 5).map((c) => ({ bpm: Math.round(c.bpm), score: c.score })),
    confidence,
    correctionRatio,
  };
}

/* ============================================================
   Public API
   ============================================================ */

/** Progress callback invoked during analysis (0–1). */
export type ProgressCallback = (progress: number) => void;

/**
 * Analyse an audio file (as an ArrayBuffer) and return beat detection results.
 *
 * This function is designed to be called from the main thread but does
 * heavy lifting synchronously; for large files (~10 minutes of audio)
 * expect up to a few seconds of processing.
 *
 * @param arrayBuffer  Raw audio file bytes.
 * @param settings     Detection parameters from user settings.
 * @param onProgress   Optional callback for progress updates (0–1).
 */
/**
 * Throw a DOM AbortError if the given signal has been aborted.
 * Used to cancel analysis between processing stages.
 */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Analysis was cancelled.', 'AbortError');
  }
}

export async function analyseAudio(
  arrayBuffer: ArrayBuffer,
  settings: DetectionSettings,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  throwIfAborted(signal);
  onProgress?.(0.05);

  // Decode the audio using a regular AudioContext (no output device needed).
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  let audioBuffer: AudioBuffer;

  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioCtx.close();
  }

  // Bail out if cancelled during the async decode step.
  throwIfAborted(signal);
  onProgress?.(0.2);
  // Yield so React can flush the 0.2 update before synchronous work begins.
  await Promise.resolve();

  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  const hopSize = settings.hopSize;
  const numHops = Math.floor(audioBuffer.length / hopSize);

  // Mix down to mono for analysis
  const mono = mixDownToMono(audioBuffer);
  throwIfAborted(signal);
  onProgress?.(0.3);
  // Yield before the expensive spectral flux computation so 0.3 renders.
  await Promise.resolve();
  throwIfAborted(signal);

  // Compute onset strength
  let rawOnsets: Float32Array;
  if (settings.useSpectralFlux) {
    rawOnsets = computeSpectralFlux(mono, sampleRate, hopSize);
  } else {
    rawOnsets = computeEnergyEnvelope(mono, hopSize);
  }
  throwIfAborted(signal);
  onProgress?.(0.6);
  // Yield after the most expensive stage so 0.6 renders before finishing.
  await Promise.resolve();
  throwIfAborted(signal);

  // Smooth and normalise
  const smoothed = smoothArray(rawOnsets, settings.smoothingWindow);
  const onsets = normalise(smoothed);
  throwIfAborted(signal);
  onProgress?.(0.7);

  // Times for each hop frame
  const hopDuration = hopSize / sampleRate;
  const onsetTimes = Array.from({ length: numHops }, (_, i) => i * hopDuration);

  // Pick peaks (convert minBeatGap from seconds to frames).
  // Clamp the gap to one beat period at bpmMax so it never blocks the fastest
  // valid tempo while remaining as long as possible to suppress noise.
  const effectiveMinBeatGap = Math.min(settings.minBeatGap, 60 / settings.bpmMax);
  const minGapFrames = Math.max(1, Math.round(effectiveMinBeatGap / hopDuration));
  const peakFrames = pickPeaks(onsets, settings.peakThreshold, minGapFrames, 0.25);
  throwIfAborted(signal);
  onProgress?.(0.8);

  // Convert peak frame indices to Beat objects
  const beats: Beat[] = peakFrames.map((frame) => ({
    time: frame * hopDuration,
    confidence: onsets[frame],
  }));

  // Estimate BPM
  const beatTimes = beats.map((b) => b.time);
  const bpmEstimate = estimateBpm(beatTimes, settings.bpmMin, settings.bpmMax);
  onProgress?.(0.95);

  const onsetStrengths = Array.from(onsets);

  onProgress?.(1.0);

  return {
    beats,
    bpmEstimate,
    onsetTimes,
    onsetStrengths,
    duration,
    sampleRate,
  };
}

/**
 * Decode an audio ArrayBuffer and return the AudioBuffer for playback/export.
 * Uses a fresh AudioContext each time; caller is responsible for closing it.
 */
export async function decodeAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close();
  }
}
