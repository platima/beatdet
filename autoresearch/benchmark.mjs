/**
 * BeatDet autoresearch benchmark — FIXED EVALUATION HARNESS.
 *
 * DO NOT MODIFY this file. The agent only modifies algorithm.mjs.
 *
 * Evaluates two combined datasets:
 *   1. GiantSteps Key Dataset   — 604 MP3s, key annotations
 *   2. GiantSteps Tempo Dataset — up to 664 WAVs (only present files used),
 *                                  v2 tempo annotations (float, crowdsourced)
 *
 * Usage:
 *   node autoresearch/benchmark.mjs
 *
 * Scoring:
 *   Key   — correct: exact match (enharmonic-normalised)
 *            close:   Camelot distance 1 (adjacent or relative key)
 *   Tempo — correct: detected BPM within ±4 % of annotated BPM
 *            octave:  within ±4 % of 2× or 0.5× annotated BPM
 *            (P-score compatible; octave errors count as close, not correct)
 *
 * Final SCORE line (grep-friendly):
 *   SCORE key_correct=N/604 tempo_correct=N/M combined=N/T pct=XX.XX
 */

import { createRequire }   from 'module';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname }   from 'path';
import { fileURLToPath }   from 'url';

import {
  detectKeyFromMono,
  detectBpmFromMono,
  mixDownToMono,
  camelotDistance,
  KEY_MAJOR,
} from './algorithm.mjs';

const require    = createRequire(import.meta.url);
const { AudioContext } = require('node-web-audio-api');
const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');

/* ============================================================
   Dataset paths (fixed)
   ============================================================ */

const KEY_AUDIO_DIR  = join(ROOT, 'testfiles', 'giantsteps-key-dataset',  'audio');
const KEY_ANNOT_DIR  = join(ROOT, 'testfiles', 'giantsteps-key-dataset',  'annotations', 'key');
const TEMPO_AUDIO_DIR= join(ROOT, 'testfiles', 'giantsteps-tempo-dataset','audio');
const TEMPO_ANNOT_DIR= join(ROOT, 'testfiles', 'giantsteps-tempo-dataset','annotations_v2', 'tempo');

/* ============================================================
   Enharmonic normalisation (fixed)
   GiantSteps uses Db / Gb; the algorithm uses C# / F#.
   ============================================================ */

const ENHARMONIC = { Db: 'C#', Gb: 'F#' };

function normaliseKey(keyStr) {
  const parts = keyStr.trim().split(' ');
  const note  = ENHARMONIC[parts[0]] ?? parts[0];
  return `${note} ${parts[1]}`;
}

/* ============================================================
   Note-name → index (for Camelot lookup)
   ============================================================ */

const NOTE_NAMES    = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const CAMELOT_MAJOR = ['8B','3B','10B','5B','12B','7B','2B','9B','4B','11B','6B','1B'];
const CAMELOT_MINOR = ['5A','12A','7A','2A','9A','4A','11A','6A','1A','8A','3A','10A'];

function keyCamelot(note, mode) {
  const idx = NOTE_NAMES.indexOf(note);
  if (idx === -1) return '??';
  return mode === 'major' ? CAMELOT_MAJOR[idx] : CAMELOT_MINOR[idx];
}

/* ============================================================
   Tempo scoring helpers (fixed)
   ============================================================ */

const TEMPO_TOLERANCE = 0.04; // ±4%

/**
 * Returns 'correct' | 'octave' | 'wrong'.
 * 'correct' = within tolerance of the annotated tempo.
 * 'octave'  = within tolerance of 2× or 0.5× the annotated tempo.
 */
function scoreTempoResult(detected, annotated) {
  const tol = annotated * TEMPO_TOLERANCE;
  if (Math.abs(detected - annotated) <= tol) return 'correct';
  if (Math.abs(detected - annotated * 2)   <= annotated * 2 * TEMPO_TOLERANCE) return 'octave';
  if (Math.abs(detected - annotated / 2)   <= annotated / 2 * TEMPO_TOLERANCE) return 'octave';
  return 'wrong';
}

/* ============================================================
   Audio decode helper (fixed)
   ============================================================ */

async function decodeAudio(filePath) {
  const raw = readFileSync(filePath);
  const ab  = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(ab);
    return buf;
  } finally {
    await ctx.close();
  }
}

/* ============================================================
   Load dataset file lists (fixed)
   ============================================================ */

/**
 * Key dataset: annotation files are <id>.LOFI.key; audio files are <id>.LOFI.mp3.
 * Both must exist (all 604 should be present).
 */
const keyFiles = readdirSync(KEY_AUDIO_DIR)
  .filter(f => f.endsWith('.mp3'))
  .filter(f => existsSync(join(KEY_ANNOT_DIR, f.replace(/\.mp3$/, '.key'))))
  .sort();

/**
 * Tempo dataset: annotation files are <id>.LOFI.bpm; audio files are <id>.wav.
 * Only include entries where the WAV exists (388 of 664 are available).
 * Also skip entries with BPM = 0.0 (three files without valid tempo in v2).
 */
const tempoFiles = readdirSync(TEMPO_ANNOT_DIR)
  .filter(f => f.endsWith('.bpm'))
  .filter(f => {
    const id      = f.replace(/\.LOFI\.bpm$/, '');
    const wavPath = join(TEMPO_AUDIO_DIR, `${id}.wav`);
    if (!existsSync(wavPath)) return false;
    const bpm = parseFloat(readFileSync(join(TEMPO_ANNOT_DIR, f), 'utf8').trim());
    return bpm > 0;
  })
  .sort();

/* ============================================================
   Main evaluation loop
   ============================================================ */

const startTime = Date.now();

// Counters
let keyCorrect  = 0;
let keyClose    = 0;
let tempoCorrect= 0;
let tempoOctave = 0;
let tempoTotal  = 0;

const totalTracks = keyFiles.length + tempoFiles.length;
let   processed   = 0;

console.log(`BeatDet autoresearch benchmark`);
console.log(`  Key dataset:   ${keyFiles.length} tracks`);
console.log(`  Tempo dataset: ${tempoFiles.length} tracks`);
console.log(`  Total:         ${totalTracks} tracks\n`);

// --- Key detection ---
for (const file of keyFiles) {
  const audioPath = join(KEY_AUDIO_DIR, file);
  const annotPath = join(KEY_ANNOT_DIR, file.replace(/\.mp3$/, '.key'));
  const expected  = normaliseKey(readFileSync(annotPath, 'utf8').trim());
  const [expNote, expMode] = expected.split(' ');

  let buf;
  try {
    buf = await decodeAudio(audioPath);
  } catch (err) {
    process.stderr.write(`  WARN decode ${file}: ${err.message}\n`);
    processed++;
    continue;
  }

  const mono   = mixDownToMono(buf);
  const result = detectKeyFromMono(mono, buf.sampleRate);

  const isCorrect = result.note === expNote && result.mode === expMode;
  if (isCorrect) {
    keyCorrect++;
  } else {
    const expCamelot = keyCamelot(expNote, expMode);
    const dist       = camelotDistance(expCamelot, result.camelot);
    if (dist === 1) keyClose++;
  }

  processed++;
  if (processed % 100 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(`  ${processed}/${totalTracks} processed... (${elapsed}s)\n`);
  }
}

console.log(`  Key phase complete (${keyFiles.length} tracks)\n`);

// --- Tempo detection ---
for (const annotFile of tempoFiles) {
  const id        = annotFile.replace(/\.LOFI\.bpm$/, '');
  const audioPath = join(TEMPO_AUDIO_DIR, `${id}.wav`);
  const annotPath = join(TEMPO_ANNOT_DIR, annotFile);
  const annotBpm  = parseFloat(readFileSync(annotPath, 'utf8').trim());

  let buf;
  try {
    buf = await decodeAudio(audioPath);
  } catch (err) {
    process.stderr.write(`  WARN decode ${id}.wav: ${err.message}\n`);
    processed++;
    continue;
  }

  const mono   = mixDownToMono(buf);
  const result = detectBpmFromMono(mono, buf.sampleRate);
  const verdict= scoreTempoResult(result.bpm, annotBpm);

  if (verdict === 'correct') tempoCorrect++;
  else if (verdict === 'octave') tempoOctave++;
  tempoTotal++;

  processed++;
  if (processed % 100 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    process.stdout.write(`  ${processed}/${totalTracks} processed... (${elapsed}s)\n`);
  }
}

/* ============================================================
   Results
   ============================================================ */

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const total   = keyFiles.length + tempoTotal;

const keyPct  = keyFiles.length  ? (keyCorrect  / keyFiles.length  * 100).toFixed(1) : '0.0';
const tempoPct= tempoTotal       ? (tempoCorrect / tempoTotal       * 100).toFixed(1) : '0.0';
const combined= keyCorrect + tempoCorrect;
const combPct = total > 0        ? (combined / total * 100).toFixed(2)                 : '0.00';

const W = 55;
console.log('\n' + '='.repeat(W));
console.log(`RESULTS  (${elapsed}s, ${total} tracks measured)`);
console.log('='.repeat(W));
console.log(`Key     exact:   ${String(keyCorrect).padStart(4)}/${keyFiles.length}  (${keyPct}%)`);
console.log(`Key     close:   ${String(keyClose).padStart(4)}/${keyFiles.length}  (${(keyClose/keyFiles.length*100).toFixed(1)}%)`);
console.log(`Key     combined:${String(keyCorrect+keyClose).padStart(4)}/${keyFiles.length}  (${((keyCorrect+keyClose)/keyFiles.length*100).toFixed(1)}%)`);
console.log(`Tempo   correct: ${String(tempoCorrect).padStart(4)}/${tempoTotal}  (${tempoPct}%)`);
console.log(`Tempo   octave:  ${String(tempoOctave).padStart(4)}/${tempoTotal}  (${tempoTotal?(tempoOctave/tempoTotal*100).toFixed(1):'0.0'}%)`);
console.log(`Combined:        ${String(combined).padStart(4)}/${total}`);
console.log('='.repeat(W));

// Single parseable summary line — grep for "^SCORE" to extract the metric
console.log(
  `SCORE key_correct=${keyCorrect}/${keyFiles.length}` +
  ` tempo_correct=${tempoCorrect}/${tempoTotal}` +
  ` combined=${combined}/${total}` +
  ` pct=${combPct}`
);
