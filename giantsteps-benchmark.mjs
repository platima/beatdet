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
   Chroma extraction (mirror of keyDetection.ts)
   ============================================================ */

function computeChromaVector(mono, sampleRate, fftSize = 4096, hopSize = 2048, fMin = 150, fMax = 2100) {
  const chroma = new Float64Array(12);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const numFrames = Math.floor((mono.length - fftSize) / hopSize) + 1;
  const numBins = fftSize / 2 + 1;
  const binToPitchClass = new Int8Array(numBins).fill(-1);
  const freqPerBin = sampleRate / fftSize;
  for (let b = 1; b < numBins; b++) {
    const freq = b * freqPerBin;
    if (freq < fMin || freq > fMax) continue;
    const midiNote = 69 + 12 * Math.log2(freq / 440);
    binToPitchClass[b] = ((Math.round(midiNote) % 12) + 12) % 12;
  }
  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    for (let i = 0; i < fftSize; i++) { re[i] = mono[offset + i] ?? 0; im[i] = 0; }
    applyHann(re, fftSize);
    fft(re, im);
    for (let b = 0; b < numBins; b++) {
      const pc = binToPitchClass[b];
      if (pc === -1) continue;
      chroma[pc] += Math.sqrt(re[b] * re[b] + im[b] * im[b]);
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

function detectKey(mono, sampleRate) {
  const chroma = computeChromaVector(mono, sampleRate);
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

let correct = 0;
let closeWrong = 0; // adjacent Camelot key (off by one step)
let wrong = 0;
const confusionMap = {}; // "expected → detected" tallies
const perKeyStats = {};  // expected key → { correct, total }
const results = [];

let processed = 0;
const startTime = Date.now();

for (const file of mp3Files) {
  const audioPath = join(AUDIO_DIR, file);
  const keyPath = join(ANNOT_DIR, basename(file, '.mp3') + '.key');
  const rawAnnotation = readFileSync(keyPath, 'utf8').trim();
  const normalised = normaliseKey(rawAnnotation);
  const [expectedNote, expectedMode] = normalised.split(' ');

  let detected;
  try {
    const buf = await decodeMp3(audioPath);
    const mono = mixDownToMono(buf);
    detected = detectKey(mono, buf.sampleRate);
  } catch (err) {
    console.error(`  ERROR decoding ${file}: ${err.message}`);
    wrong++;
    processed++;
    continue;
  }

  const detectedStr = `${detected.key} ${detected.mode}`;
  const isCorrect = detected.key === expectedNote && detected.mode === expectedMode;
  const dist = camelotDistance(
    expectedMode === 'major' ? CAMELOT_MAJOR[NOTE_NAMES.indexOf(expectedNote)] : CAMELOT_MINOR[NOTE_NAMES.indexOf(expectedNote)],
    detected.camelot,
  );

  if (isCorrect) {
    correct++;
  } else if (dist === 1) {
    closeWrong++;
  } else {
    wrong++;
  }

  // Confusion tracking
  const confKey = `${normalised} → ${detectedStr}`;
  confusionMap[confKey] = (confusionMap[confKey] || 0) + 1;

  // Per-key tracking
  if (!perKeyStats[normalised]) perKeyStats[normalised] = { correct: 0, total: 0 };
  perKeyStats[normalised].total++;
  if (isCorrect) perKeyStats[normalised].correct++;

  results.push({ file, expected: normalised, detected: detectedStr, camelot: detected.camelot, confidence: detected.confidence, isCorrect, dist });

  processed++;
  if (processed % 50 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const pct = ((correct / processed) * 100).toFixed(1);
    process.stdout.write(`  ${processed}/${mp3Files.length} processed... ${pct}% correct so far (${elapsed}s)\n`);
  }
}

const total = results.length;
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('\n' + '='.repeat(60));
console.log('RESULTS');
console.log('='.repeat(60));
console.log(`Total tracks:        ${total}`);
console.log(`Correct:             ${correct} (${((correct / total) * 100).toFixed(1)}%)`);
console.log(`Close (±1 Camelot):  ${closeWrong} (${((closeWrong / total) * 100).toFixed(1)}%)`);
console.log(`Wrong:               ${wrong} (${((wrong / total) * 100).toFixed(1)}%)`);
console.log(`Correct + close:     ${correct + closeWrong} (${(((correct + closeWrong) / total) * 100).toFixed(1)}%)`);
console.log(`Time:                ${elapsed}s`);

console.log('\n' + '-'.repeat(60));
console.log('PER-KEY ACCURACY (sorted by worst first)');
console.log('-'.repeat(60));
Object.entries(perKeyStats)
  .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
  .forEach(([key, { correct: c, total: t }]) => {
    const pct = ((c / t) * 100).toFixed(0).padStart(3);
    const bar = '█'.repeat(Math.round(c / t * 20)).padEnd(20, '░');
    console.log(`  ${key.padEnd(12)} ${bar} ${pct}%  (${c}/${t})`);
  });

console.log('\n' + '-'.repeat(60));
console.log('TOP CONFUSIONS (wrong detections, most common first)');
console.log('-'.repeat(60));
Object.entries(confusionMap)
  .filter(([k]) => !k.startsWith(k.split(' → ')[1]))  // exclude correct ones
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([pair, count]) => {
    console.log(`  ${count.toString().padStart(3)}×  ${pair}`);
  });
