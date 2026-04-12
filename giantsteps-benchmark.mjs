/**
 * GiantSteps key detection benchmark.
 *
 * Runs BeatDet's key detection algorithm against all 460 tracks from the
 * GiantSteps Key Dataset and reports accuracy statistics.
 *
 * Usage:
 *   node giantsteps-benchmark.mjs
 *
 * Dataset layout expected:
 *   testfiles/giantsteps-key-dataset/audio/*.LOFI.mp3
 *   testfiles/giantsteps-key-dataset/annotations/key/*.LOFI.key  (plain "C minor")
 *
 * Enharmonic equivalence is handled: GiantSteps uses Db/Gb; BeatDet uses C#/F#.
 */

import { createRequire } from 'module';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { AudioContext } = require('node-web-audio-api');
const __dirname = dirname(fileURLToPath(import.meta.url));

/* ============================================================
   Constants — must match keyDetection.ts exactly
   ============================================================ */

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CAMELOT_MAJOR = ['8B','3B','10B','5B','12B','7B','2B','9B','4B','11B','6B','1B'];
const CAMELOT_MINOR = ['5A','12A','7A','2A','9A','4A','11A','6A','1A','8A','3A','10A'];

/**
 * Bellman-Budge profiles (must stay in sync with keyDetection.ts).
 */
const KEY_MAJOR = [16.80, 0.86, 12.95, 1.41, 13.49, 11.93, 1.25, 20.28, 1.80, 8.04, 0.62, 10.57];
const KEY_MINOR = [18.16, 0.69, 12.99, 13.34, 1.07, 11.15, 1.38, 21.07, 7.49, 1.53, 0.92, 10.21];

/* ============================================================
   Enharmonic normalisation
   GiantSteps uses Db/Gb; BeatDet uses C#/F#.
   ============================================================ */

const ENHARMONIC = { 'Db': 'C#', 'Gb': 'F#' };

function normaliseKey(keyStr) {
  // e.g. "Gb minor" → "F# minor"
  const parts = keyStr.trim().split(' ');
  const note = ENHARMONIC[parts[0]] ?? parts[0];
  return `${note} ${parts[1]}`;
}

/* ============================================================
   Math helpers (mirror of keyDetection.ts)
   ============================================================ */

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

function rotateRight(arr, steps) {
  const n = arr.length;
  return Array.from({ length: n }, (_, i) => arr[((i - steps) % n + n) % n]);
}

function applyHann(buf, windowSize) {
  for (let i = 0; i < windowSize; i++) {
    buf[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nr = curRe * wRe - curIm * wIm; curIm = curRe * wIm + curIm * wRe; curRe = nr;
      }
    }
  }
}

/* ============================================================
   HPSS helpers
   ============================================================ */

function insertionSort(arr, len) {
  for (let i = 1; i < len; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) { arr[j + 1] = arr[j]; j--; }
    arr[j + 1] = key;
  }
}

function separateHarmonicComponent(spec, numBins, numFrames, hKernel, pKernel) {
  const hHalf = Math.floor(hKernel / 2);
  const pHalf = Math.floor(pKernel / 2);
  const harmSpec = new Float32Array(spec.length);
  const percSpec = new Float32Array(spec.length);
  const tmpH = new Float32Array(hKernel);
  const tmpP = new Float32Array(pKernel);

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
  const result = new Float32Array(spec.length);
  for (let i = 0; i < spec.length; i++) {
    const h = harmSpec[i], p = percSpec[i];
    const denom = h * h + p * p;
    if (denom > 0) result[i] = spec[i] * (h * h / denom);
  }
  return result;
}

/* ============================================================
   Chroma extraction (mirror of keyDetection.ts)
   ============================================================ */

function computeChromaVector(mono, sampleRate, fftSize = 4096, hopSize = 2048, fMin = 150, fMax = 2100, useHpss = true) {
  const chroma = new Float64Array(12);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const numFrames = Math.floor((mono.length - fftSize) / hopSize) + 1;
  const freqPerBin = sampleRate / fftSize;
  const bMin = Math.max(1, Math.ceil(fMin / freqPerBin));
  const bMax = Math.min(fftSize / 2, Math.floor(fMax / freqPerBin));
  const activeBins = bMax - bMin + 1;

  const binToPitchClass = new Uint8Array(activeBins);
  for (let b = 0; b < activeBins; b++) {
    const freq = (b + bMin) * freqPerBin;
    const midiNote = 69 + 12 * Math.log2(freq / 440);
    binToPitchClass[b] = ((Math.round(midiNote) % 12) + 12) % 12;
  }

  const spectrogram = new Float32Array(numFrames * activeBins);
  for (let frame = 0; frame < numFrames; frame++) {
    const sampleOffset = frame * hopSize;
    for (let i = 0; i < fftSize; i++) { re[i] = mono[sampleOffset + i] ?? 0; im[i] = 0; }
    applyHann(re, fftSize);
    fft(re, im);
    const frameOffset = frame * activeBins;
    for (let b = 0; b < activeBins; b++) {
      const absB = b + bMin;
      spectrogram[frameOffset + b] = Math.sqrt(re[absB] * re[absB] + im[absB] * im[absB]);
    }
  }

  const activeSpec = useHpss
    ? separateHarmonicComponent(spectrogram, activeBins, numFrames, 17, 17)
    : spectrogram;

  for (let frame = 0; frame < numFrames; frame++) {
    const frameOffset = frame * activeBins;
    for (let b = 0; b < activeBins; b++) {
      chroma[binToPitchClass[b]] += activeSpec[frameOffset + b];
    }
  }

  let maxVal = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > maxVal) maxVal = chroma[i];
  if (maxVal > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxVal;
  return Array.from(chroma);
}

/* ============================================================
   Key detection (mirror of keyDetection.ts)
   ============================================================ */

function detectKey(mono, sampleRate, fMin = 150, fMax = 2100, useHpss = true) {
  const chroma = computeChromaVector(mono, sampleRate, 4096, 2048, fMin, fMax, useHpss);
  const results = [];
  for (let pc = 0; pc < 12; pc++) {
    results.push({ pc, mode: 'major', r: pearsonCorrelation(chroma, rotateRight(KEY_MAJOR, pc)) });
    results.push({ pc, mode: 'minor', r: pearsonCorrelation(chroma, rotateRight(KEY_MINOR, pc)) });
  }
  results.sort((a, b) => b.r - a.r);
  const best = results[0];
  return {
    key: NOTE_NAMES[best.pc],
    mode: best.mode,
    camelot: best.mode === 'major' ? CAMELOT_MAJOR[best.pc] : CAMELOT_MINOR[best.pc],
    confidence: Math.max(0, Math.min(1, best.r)),
  };
}

/* ============================================================
   Audio decode
   ============================================================ */

function mixDownToMono(audioBuffer) {
  const nc = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < nc; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i];
  }
  const scale = 1 / nc;
  for (let i = 0; i < len; i++) mono[i] *= scale;
  return mono;
}

async function decodeMp3(filePath) {
  const raw = readFileSync(filePath);
  const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(arrayBuffer);
    return buf;
  } finally {
    await ctx.close();
  }
}

/* ============================================================
   Camelot adjacency: "close" means same number ±1 or same letter
   ============================================================ */

function camelotDistance(a, b) {
  // e.g. "8A" vs "9A" → adjacent; "8A" vs "8B" → relative key
  if (a === b) return 0;
  const numA = parseInt(a), numB = parseInt(b);
  const letterA = a.slice(-1), letterB = b.slice(-1);
  if (letterA === letterB && Math.abs(numA - numB) === 1) return 1; // adjacent same mode
  if (letterA === letterB && Math.abs(numA - numB) === 11) return 1; // wrap-around (1 and 12)
  if (numA === numB && letterA !== letterB) return 1; // relative major/minor
  return 2; // unrelated
}

/* ============================================================
   Main
   ============================================================ */

const AUDIO_DIR = join(__dirname, 'testfiles', 'giantsteps-key-dataset', 'audio');
const ANNOT_DIR = join(__dirname, 'testfiles', 'giantsteps-key-dataset', 'annotations', 'key');

const mp3Files = readdirSync(AUDIO_DIR)
  .filter(f => f.endsWith('.mp3'))
  .filter(f => existsSync(join(ANNOT_DIR, basename(f, '.mp3') + '.key')))
  .sort();

console.log(`Running BeatDet key detection on ${mp3Files.length} GiantSteps tracks...\n`);

// Configurations to bench: [label, fMin, fMax, useHpss]
const CONFIGS = [
  ['No HPSS  / 150Hz (v0.7.3)', 150, 2100, false],
  ['HPSS     /  65Hz (branch)',   65, 2100, true],
  ['HPSS     / 150Hz',           150, 2100, true],
  ['HPSS     / 200Hz',           200, 2100, true],
];
const scores = CONFIGS.map(() => 0);
const closeCounts = CONFIGS.map(() => 0);

let processed = 0;
const startTime = Date.now();

// We run all configs on each track so that the expensive decode happens once.
for (const file of mp3Files) {
  const audioPath = join(AUDIO_DIR, file);
  const keyPath = join(ANNOT_DIR, basename(file, '.mp3') + '.key');
  const rawAnnotation = readFileSync(keyPath, 'utf8').trim();
  const normalised = normaliseKey(rawAnnotation);
  const [expectedNote, expectedMode] = normalised.split(' ');

  let mono, sampleRate;
  try {
    const buf = await decodeMp3(audioPath);
    mono = mixDownToMono(buf);
    sampleRate = buf.sampleRate;
  } catch (err) {
    console.error(`  ERROR decoding ${file}: ${err.message}`);
    processed++;
    continue;
  }

  CONFIGS.forEach(([, fMin, fMax, useHpss], idx) => {
    const detected = detectKey(mono, sampleRate, fMin, fMax, useHpss);
    const isCorrect = detected.key === expectedNote && detected.mode === expectedMode;
    const expCamelot = expectedMode === 'major'
      ? CAMELOT_MAJOR[NOTE_NAMES.indexOf(expectedNote)]
      : CAMELOT_MINOR[NOTE_NAMES.indexOf(expectedNote)];
    const dist = camelotDistance(expCamelot, detected.camelot);
    if (isCorrect) scores[idx]++;
    else if (dist === 1) closeCounts[idx]++;
  });

  processed++;
  if (processed % 50 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(`  ${processed}/${mp3Files.length} processed... (${elapsed}s)\n`);
  }
}

const total = processed;
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('\n' + '='.repeat(65));
console.log('RESULTS on ' + total + ' tracks (' + elapsed + 's)');
console.log('='.repeat(65));
console.log('Config'.padEnd(35) + 'Correct    Close     Combined');
console.log('-'.repeat(65));
CONFIGS.forEach(([label], idx) => {
  const c = scores[idx], cl = closeCounts[idx], t = total;
  const pctC  = ((c / t) * 100).toFixed(1).padStart(5);
  const pctCl = ((cl / t) * 100).toFixed(1).padStart(5);
  const pctCo = (((c + cl) / t) * 100).toFixed(1).padStart(5);
  console.log(`${label.padEnd(35)}${pctC}%   ${pctCl}%   ${pctCo}%`);
});
