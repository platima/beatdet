/**
 * BeatDet algorithm mirror for autoresearch benchmarking.
 *
 * This file is the ONLY file the autoresearch agent should modify.
 * It mirrors src/lib/beatDetection.ts and src/lib/keyDetection.ts in
 * plain ESM JavaScript so the benchmark can execute without a TypeScript
 * compilation step.
 *
 * After finding improvements here, port the winning constants/logic back
 * to the corresponding TypeScript source files.
 *
 * Structure:
 *   Section A — TUNABLE PARAMETERS     ← agent modifies these
 *   Section B — Math utilities          ← do not modify
 *   Section C — HPSS                    ← can modify (it's part of the alg)
 *   Section D — Chroma / key detection  ← can modify
 *   Section E — Beat detection          ← can modify
 *   Section F — Public API exports      ← do not modify signatures
 */

/* ============================================================
   Section A — TUNABLE PARAMETERS
   ============================================================ */

/**
 * Beat detection pipeline defaults.
 * These mirror the DEFAULT_SETTINGS in src/store/settingsStore.ts and the
 * hardcoded constants inside src/lib/beatDetection.ts.
 */
export const SETTINGS = {
  hopSize:        512,   // samples per onset hop (256 / 512 / 1024 / 2048)
  useSpectralFlux: true, // true = spectral flux; false = RMS energy envelope
  smoothingWindow: 8,    // moving-average window in frames
  peakThreshold:  0.15,  // fraction above local median to qualify as peak
  minBeatGap:     0.3,   // minimum inter-beat gap in seconds
  bpmMin:         55,    // lower BPM search boundary
  bpmMax:         200,   // upper BPM search boundary
};

/**
 * BPM estimation constants (all inside estimateBpm in beatDetection.ts).
 */
export const BPM_PARAMS = {
  bpmRes:              0.5,   // histogram bin resolution in BPM
  sigma:               2.5,   // Gaussian smoothing width in BPM (broader = more robust to IOI jitter)
  absMinHeight:        0.14,  // absolute normalised floor for peak picking
  medianWindow:        16,    // half-window size for adaptive peak picking
  slowTempoFloor:      80,    // BPM below which strictHalfThreshold applies
  strictHalfThreshold: 0.95,  // energy ratio to allow ×0.5 below slowTempoFloor
  defaultDownThreshold:0.30,  // energy ratio for all other downward corrections (was 0.40)
  sesqThreshold:       0.45,  // energy ratio for ×1.5 upward correction (was 0.60)
  tripleThreshold:     0.70,  // energy ratio for ×3 upward correction
};

/**
 * Key detection constants (all inside computeChromaVector / detectKey in
 * keyDetection.ts).
 */
export const KEY_PARAMS = {
  fftSize: 4096,  // chroma FFT window size
  hopSize: 2048,  // chroma hop size (fftSize / 2)
  fMin:    150,   // low-frequency cutoff in Hz (excludes kick fundamental)
  fMax:    2100,  // high-frequency cutoff in Hz
  hpssH:   27,    // HPSS horizontal (time-axis) median filter kernel width (was 17, ~1.25 s window)
  hpssP:   19,    // HPSS vertical (frequency-axis) median filter kernel width
  minorPriorBoost: 1.20, // EDM is ~85 % minor — boost minor correlations to correct bias
};

/**
 * Bellman-Budge 2005 major key profile (C-rooted, 12 pitch classes).
 * Provides stronger diatonic/non-diatonic separation than Krumhansl-Kessler.
 */
export const KEY_MAJOR = [
  16.80, 0.86, 12.95, 1.41, 16.00, 11.93,
   1.25, 20.28,  1.80,  8.04,  0.62, 10.57,
];

/**
 * Bellman-Budge 2005 minor key profile (C-rooted, 12 pitch classes).
 * Indices 10 (flat-7th = Bb) and 11 (leading tone = B) are swapped relative to
 * the original to better match natural minor / aeolian mode which is dominant in
 * electronic music.
 */
export const KEY_MINOR = [
  22.00, 0.69, 12.99, 13.34, 1.07, 11.15,
  1.38, 21.07,  7.49,  1.53, 10.21,  0.92,
];

/* ============================================================
   Internal constants — do not change these
   ============================================================ */

const NOTE_NAMES    = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const CAMELOT_MAJOR = ['8B','3B','10B','5B','12B','7B','2B','9B','4B','11B','6B','1B'];
const CAMELOT_MINOR = ['5A','12A','7A','2A','9A','4A','11A','6A','1A','8A','3A','10A'];

/* ============================================================
   Section B — Math utilities (do not modify)
   ============================================================ */

/** Pearson correlation between two equal-length arrays. */
function pearsonCorrelation(a, b) {
  const n = a.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n, meanB = sumB / n;
  let num = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; varA += da * da; varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : num / denom;
}

/** Circular right-rotate an array by `steps` positions. */
function rotateRight(arr, steps) {
  const n = arr.length;
  return Array.from({ length: n }, (_, i) => arr[((i - steps) % n + n) % n]);
}

/** Apply a Hann window in-place to the first `windowSize` elements of buf. */
function applyHann(buf, windowSize) {
  for (let i = 0; i < windowSize; i++) {
    buf[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }
}

/** In-place Cooley-Tukey radix-2 DIT FFT (power-of-two length). */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i+j+len/2]*curRe - im[i+j+len/2]*curIm;
        const vIm = re[i+j+len/2]*curIm + im[i+j+len/2]*curRe;
        re[i+j] = uRe+vRe; im[i+j] = uIm+vIm;
        re[i+j+len/2] = uRe-vRe; im[i+j+len/2] = uIm-vIm;
        const nr = curRe*wRe - curIm*wIm; curIm = curRe*wIm + curIm*wRe; curRe = nr;
      }
    }
  }
}

/** Insertion sort on the first `len` elements of arr (for small HPSS windows). */
function insertionSort(arr, len) {
  for (let i = 1; i < len; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) { arr[j+1] = arr[j]; j--; }
    arr[j+1] = key;
  }
}

/** Mean of arr[start..end). */
function mean(arr, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += arr[i];
  return sum / (end - start);
}

/* ============================================================
   Section C — HPSS (Harmonic-Percussive Source Separation)
   ============================================================ */

/**
 * Separate the harmonic component of a spectrogram using median filtering.
 * Returns the Wiener-soft-masked harmonic spectrogram.
 *
 * @param {Float32Array} spec      Flat row-major spectrogram (numFrames × numBins)
 * @param {number}       numBins   Number of frequency bins
 * @param {number}       numFrames Number of time frames
 * @param {number}       hKernel   Horizontal (time-axis) median kernel width
 * @param {number}       pKernel   Vertical (frequency-axis) median kernel width
 */
function separateHarmonicComponent(spec, numBins, numFrames, hKernel, pKernel) {
  const hHalf = Math.floor(hKernel / 2);
  const pHalf = Math.floor(pKernel / 2);
  const harmSpec = new Float32Array(spec.length);
  const percSpec = new Float32Array(spec.length);
  const tmpH = new Float32Array(hKernel);
  const tmpP = new Float32Array(pKernel);

  // Time-axis median filter → harmonic
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

  // Frequency-axis median filter → percussive
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

  // Squared Wiener soft mask: H² / (H² + P²)
  const result = new Float32Array(spec.length);
  for (let i = 0; i < spec.length; i++) {
    const h = harmSpec[i], p = percSpec[i];
    const denom = h * h + p * p;
    if (denom > 0) result[i] = spec[i] * (h * h / denom);
  }
  return result;
}

/* ============================================================
   Section D — Chroma extraction and key detection
   ============================================================ */

/**
 * Compute a 12-bin normalised chroma vector from mono PCM data.
 * Mirrors computeChromaVector() in src/lib/keyDetection.ts.
 */
function computeChromaVector(mono, sampleRate) {
  const { fftSize, hopSize, fMin, fMax, hpssH, hpssP } = KEY_PARAMS;
  const chroma    = new Float64Array(12);
  const re        = new Float64Array(fftSize);
  const im        = new Float64Array(fftSize);
  const numFrames = Math.floor((mono.length - fftSize) / hopSize) + 1;
  const freqPerBin = sampleRate / fftSize;
  const bMin = Math.max(1, Math.ceil(fMin / freqPerBin));
  const bMax = Math.min(fftSize / 2, Math.floor(fMax / freqPerBin));
  const activeBins = bMax - bMin + 1;

  // Pre-compute pitch-class mapping for each active bin
  const binToPitchClass = new Uint8Array(activeBins);
  for (let b = 0; b < activeBins; b++) {
    const freq     = (b + bMin) * freqPerBin;
    const midiNote = 69 + 12 * Math.log2(freq / 440);
    binToPitchClass[b] = ((Math.round(midiNote) % 12) + 12) % 12;
  }

  // Build the magnitude spectrogram (active frequency range only)
  const spectrogram = new Float32Array(numFrames * activeBins);
  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    for (let i = 0; i < fftSize; i++) { re[i] = mono[offset + i] ?? 0; im[i] = 0; }
    applyHann(re, fftSize);
    fft(re, im);
    const frameOffset = frame * activeBins;
    for (let b = 0; b < activeBins; b++) {
      const absB = b + bMin;
      spectrogram[frameOffset + b] = Math.sqrt(re[absB]*re[absB] + im[absB]*im[absB]);
    }
  }

  // Apply HPSS to isolate harmonic content
  const harmSpec = separateHarmonicComponent(spectrogram, activeBins, numFrames, hpssH, hpssP);

  // Accumulate into 12 chroma bins
  for (let frame = 0; frame < numFrames; frame++) {
    const frameOffset = frame * activeBins;
    for (let b = 0; b < activeBins; b++) {
      chroma[binToPitchClass[b]] += harmSpec[frameOffset + b];
    }
  }

  // Normalise to [0, 1]
  let maxVal = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > maxVal) maxVal = chroma[i];
  if (maxVal > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxVal;
  return Array.from(chroma);
}

/**
 * Detect the musical key of a mono audio signal.
 * Returns { note, mode, camelot, confidence }.
 * Mirrors detectKey() in src/lib/keyDetection.ts.
 */
export function detectKeyFromMono(mono, sampleRate) {
  const chroma  = computeChromaVector(mono, sampleRate);
  const { minorPriorBoost } = KEY_PARAMS;
  const results = [];
  for (let pc = 0; pc < 12; pc++) {
    results.push({ pc, mode: 'major', r: pearsonCorrelation(chroma, rotateRight(KEY_MAJOR, pc)) });
    results.push({ pc, mode: 'minor', r: pearsonCorrelation(chroma, rotateRight(KEY_MINOR, pc)) * minorPriorBoost });
  }
  results.sort((a, b) => b.r - a.r);
  const best = results[0];
  return {
    note:       NOTE_NAMES[best.pc],
    mode:       best.mode,
    camelot:    best.mode === 'major' ? CAMELOT_MAJOR[best.pc] : CAMELOT_MINOR[best.pc],
    confidence: Math.max(0, Math.min(1, best.r)),
  };
}

/* ============================================================
   Section E — Beat detection
   ============================================================ */

/**
 * Spectral-flux onset strength signal (half-wave rectified).
 * Mirrors computeSpectralFlux() in src/lib/beatDetection.ts.
 */
function computeSpectralFlux(mono, sampleRate, hopSize) {
  const fftSize  = hopSize * 2;
  const halfBins = fftSize >> 1;
  const numHops  = Math.floor((mono.length - fftSize) / hopSize);
  if (numHops <= 0) return new Float32Array(0);

  const onsets  = new Float32Array(numHops);
  const reB     = new Float64Array(fftSize);
  const imB     = new Float64Array(fftSize);
  let prevMags  = new Float32Array(halfBins);

  for (let hop = 0; hop < numHops; hop++) {
    const start = hop * hopSize;
    for (let n = 0; n < fftSize; n++) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)));
      reB[n] = (mono[start + n] ?? 0) * w;
      imB[n] = 0;
    }
    fft(reB, imB);
    const mags = new Float32Array(halfBins);
    for (let k = 0; k < halfBins; k++) {
      mags[k] = Math.sqrt(reB[k]*reB[k] + imB[k]*imB[k]);
    }
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
 * RMS energy envelope onset strength signal.
 * Mirrors computeEnergyEnvelope() in src/lib/beatDetection.ts.
 */
function computeEnergyEnvelope(mono, hopSize) {
  const numHops = Math.floor(mono.length / hopSize);
  const onsets  = new Float32Array(numHops);
  let prevEnergy = 0;
  for (let hop = 0; hop < numHops; hop++) {
    const start = hop * hopSize;
    let rms = 0;
    for (let i = start; i < start + hopSize && i < mono.length; i++) rms += mono[i]*mono[i];
    rms = Math.sqrt(rms / hopSize);
    const diff = rms - prevEnergy;
    onsets[hop] = diff > 0 ? diff : 0;
    prevEnergy = rms;
  }
  return onsets;
}

/** Moving-average smoother. Mirrors smoothArray() in beatDetection.ts. */
function smoothArray(arr, windowSize) {
  if (windowSize <= 1) return arr;
  const half = Math.floor(windowSize / 2);
  const out  = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - half);
    const end   = Math.min(arr.length, i + half + 1);
    out[i] = mean(arr, start, end);
  }
  return out;
}

/** Normalise array to [0, 1]. Mirrors normalise() in beatDetection.ts. */
function normaliseArray(arr) {
  let max = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
  if (max === 0) return arr;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] / max;
  return out;
}

/**
 * Adaptive peak picking.
 * Mirrors pickPeaks() in src/lib/beatDetection.ts.
 */
function pickPeaks(onsets, peakThreshold, minGapFrames, absMinHeight) {
  const peaks       = [];
  const { medianWindow } = BPM_PARAMS;
  let lastPeakFrame = -minGapFrames;

  for (let i = 1; i < onsets.length - 1; i++) {
    const val = onsets[i];
    if (val <= onsets[i-1] || val <= onsets[i+1]) continue;
    if (val < absMinHeight) continue;

    const wStart = Math.max(0, i - medianWindow);
    const wEnd   = Math.min(onsets.length, i + medianWindow);
    const win    = [];
    for (let j = wStart; j < wEnd; j++) win.push(onsets[j]);
    win.sort((a, b) => a - b);
    const localMedian = win[Math.floor(win.length / 2)];

    if (val < localMedian * (1.0 + peakThreshold)) continue;
    if (i - lastPeakFrame < minGapFrames) continue;

    peaks.push(i);
    lastPeakFrame = i;
  }
  return peaks;
}

/**
 * Estimate BPM from beat timestamps using multi-lag IOI accumulation with
 * Gaussian histogram smoothing and harmonic octave correction.
 * Mirrors estimateBpm() in src/lib/beatDetection.ts.
 */
function estimateBpm(beatTimes, bpmMin, bpmMax) {
  if (beatTimes.length < 2) return { bpm: 0, confidence: 0 };

  const {
    bpmRes, sigma, slowTempoFloor, strictHalfThreshold,
    defaultDownThreshold, sesqThreshold, tripleThreshold,
  } = BPM_PARAMS;

  const minIoi = 60 / bpmMax;
  const maxIoi = 60 / bpmMin;

  const weightedIois = [];
  for (let lag = 1; lag <= 3; lag++) {
    const lagWeight = 1 / lag;
    for (let i = lag; i < beatTimes.length; i++) {
      const ioi = (beatTimes[i] - beatTimes[i - lag]) / lag;
      if (ioi < minIoi || ioi > maxIoi) continue;
      weightedIois.push({ bpm: 60 / ioi, weight: lagWeight });
    }
  }
  if (weightedIois.length === 0) return { bpm: 0, confidence: 0 };

  const numBins    = Math.round((bpmMax - bpmMin) / bpmRes) + 1;
  const hist       = new Float64Array(numBins);
  const sigBins    = sigma / bpmRes;
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

  const candidates = [];
  for (let b = 1; b < numBins - 1; b++) {
    if (hist[b] > hist[b-1] && hist[b] >= hist[b+1]) {
      candidates.push({ bpm: bpmMin + b * bpmRes, score: hist[b] });
    }
  }
  if (candidates.length === 0) {
    let best = 0;
    for (let b = 1; b < numBins; b++) if (hist[b] > hist[best]) best = b;
    candidates.push({ bpm: bpmMin + best * bpmRes, score: hist[best] });
  }
  candidates.sort((a, b) => b.score - a.score);

  const leader = candidates[0];

  const histScoreAt = (bpm) => {
    const bin = (bpm - bpmMin) / bpmRes;
    const lo  = Math.max(0, Math.floor(bin) - 1);
    const hi  = Math.min(numBins - 1, Math.ceil(bin) + 1);
    let best  = 0;
    for (let b = lo; b <= hi; b++) if (hist[b] > best) best = hist[b];
    return best;
  };

  let corrected = false;
  for (const ratio of [0.5, 1/3]) {
    const altBpm = leader.bpm * ratio;
    if (altBpm < bpmMin || altBpm > bpmMax) continue;
    const altScore = histScoreAt(altBpm);
    const threshold = ratio === 0.5 && altBpm < slowTempoFloor
      ? strictHalfThreshold
      : defaultDownThreshold;
    if (altScore >= leader.score * threshold) {
      candidates.unshift({ bpm: Math.round(altBpm * 2) / 2, score: altScore });
      corrected = true;
      break;
    }
  }

  if (!corrected) {
    for (const [ratio, threshold] of [[1.5, sesqThreshold], [3, tripleThreshold]]) {
      const altBpm = leader.bpm * ratio;
      if (altBpm >= bpmMin && altBpm <= bpmMax) {
        const altScore = histScoreAt(altBpm);
        if (altScore >= leader.score * threshold) {
          candidates.unshift({ bpm: Math.round(altBpm * 2) / 2, score: altScore });
          break;
        }
      }
    }
  }

  const totalWeight = weightedIois.reduce((s, x) => s + x.weight, 0);
  const confidence  = Math.min(1, candidates[0].score / Math.max(1, totalWeight * 0.3));

  return { bpm: Math.round(candidates[0].bpm), confidence };
}

/* ============================================================
   Section F — Public API (do not modify signatures)
   ============================================================ */

/**
 * Mix a decoded AudioBuffer down to mono.
 * Called by the benchmark before passing PCM to the detection functions.
 */
export function mixDownToMono(audioBuffer) {
  const nc   = audioBuffer.numberOfChannels;
  const len  = audioBuffer.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < nc; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i];
  }
  const scale = 1 / nc;
  for (let i = 0; i < len; i++) mono[i] *= scale;
  return mono;
}

/**
 * Run the full beat detection pipeline and return the estimated BPM.
 *
 * @param {Float32Array} mono       Mono-mixed PCM samples
 * @param {number}       sampleRate Audio sample rate in Hz
 * @returns {{ bpm: number, confidence: number }}
 */
export function detectBpmFromMono(mono, sampleRate) {
  const { hopSize, useSpectralFlux, smoothingWindow, peakThreshold,
          minBeatGap, bpmMin, bpmMax } = SETTINGS;
  const { absMinHeight } = BPM_PARAMS;

  const rawOnsets = useSpectralFlux
    ? computeSpectralFlux(mono, sampleRate, hopSize)
    : computeEnergyEnvelope(mono, hopSize);

  const smoothed    = smoothArray(rawOnsets, smoothingWindow);
  const onsets      = normaliseArray(smoothed);
  const hopDuration = hopSize / sampleRate;

  const effectiveMinBeatGap = Math.min(minBeatGap, 60 / bpmMax);
  const minGapFrames = Math.max(1, Math.round(effectiveMinBeatGap / hopDuration));
  const peakFrames   = pickPeaks(onsets, peakThreshold, minGapFrames, absMinHeight);
  const beatTimes    = peakFrames.map(f => f * hopDuration);

  return estimateBpm(beatTimes, bpmMin, bpmMax);
}

/**
 * Camelot wheel adjacency distance (0 = exact match, 1 = adjacent/relative, 2 = other).
 * Used by the benchmark to count "close" key results.
 */
export function camelotDistance(a, b) {
  if (a === b) return 0;
  const numA = parseInt(a), numB = parseInt(b);
  const letA = a.slice(-1), letB = b.slice(-1);
  if (letA === letB && (Math.abs(numA - numB) === 1 || Math.abs(numA - numB) === 11)) return 1;
  if (numA === numB && letA !== letB) return 1;
  return 2;
}
