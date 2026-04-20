/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Shared helpers for BeatDet autoresearch benchmarks.
 *
 * Keep this file fixed during parameter search. Only algorithm.mjs should
 * change while running experiments.
 */

const { readFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');
const { AudioContext } = require('node-web-audio-api');

const ROOT = join(__dirname, '..');

const KEY_AUDIO_DIR = join(ROOT, 'testfiles', 'giantsteps-key-dataset', 'audio');
const KEY_ANNOT_DIR = join(ROOT, 'testfiles', 'giantsteps-key-dataset', 'annotations', 'key');
const TEMPO_AUDIO_DIR = join(ROOT, 'testfiles', 'giantsteps-tempo-dataset', 'audio');
const TEMPO_ANNOT_DIR = join(ROOT, 'testfiles', 'giantsteps-tempo-dataset', 'annotations_v2', 'tempo');

const ENHARMONIC = { Db: 'C#', Gb: 'F#' };
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CAMELOT_MAJOR = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B'];
const CAMELOT_MINOR = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A'];
const TEMPO_TOLERANCE = 0.04;
const REPORT_WIDTH = 60;

function normaliseKey(keyStr) {
  const parts = keyStr.trim().split(' ');
  const note = ENHARMONIC[parts[0]] ?? parts[0];
  return `${note} ${parts[1]}`;
}

function keyCamelot(note, mode) {
  const idx = NOTE_NAMES.indexOf(note);
  if (idx === -1) return '??';
  return mode === 'major' ? CAMELOT_MAJOR[idx] : CAMELOT_MINOR[idx];
}

function classifyTempoResult(detected, annotated) {
  const ratio = annotated > 0 ? detected / annotated : 0;
  const tol = annotated * TEMPO_TOLERANCE;

  if (Math.abs(detected - annotated) <= tol) {
    return { verdict: 'correct', detail: 'correct', ratio };
  }
  if (Math.abs(detected - annotated * 2) <= annotated * 2 * TEMPO_TOLERANCE) {
    return { verdict: 'octave', detail: 'double', ratio };
  }
  if (Math.abs(detected - annotated / 2) <= annotated / 2 * TEMPO_TOLERANCE) {
    return { verdict: 'octave', detail: 'half', ratio };
  }

  return {
    verdict: 'wrong',
    detail: detected < annotated ? 'slow' : 'fast',
    ratio,
  };
}

function classifyKeyMiss(expected, detected, camelotDistanceValue) {
  let shape = 'same-mode wrong root';
  if (expected.note === detected.note && expected.mode !== detected.mode) {
    shape = 'same-root mode flip';
  } else if (expected.mode !== detected.mode) {
    shape = 'cross-root mode flip';
  }

  return {
    proximity: camelotDistanceValue === 1 ? 'close' : 'far',
    shape,
  };
}

function incrementCount(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedCounts(map) {
  return Array.from(map.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
}

function formatPercent(count, total, digits = 1) {
  if (total === 0) return digits === 2 ? '0.00' : '0.0';
  return ((count / total) * 100).toFixed(digits);
}

function loadKeyFiles() {
  return readdirSync(KEY_AUDIO_DIR)
    .filter(file => file.endsWith('.mp3'))
    .filter(file => existsSync(join(KEY_ANNOT_DIR, file.replace(/\.mp3$/, '.key'))))
    .sort();
}

function loadTempoFiles() {
  return readdirSync(TEMPO_ANNOT_DIR)
    .filter(file => file.endsWith('.bpm'))
    .filter(file => {
      const id = file.replace(/\.LOFI\.bpm$/, '');
      const wavPath = join(TEMPO_AUDIO_DIR, `${id}.wav`);
      if (!existsSync(wavPath)) return false;
      const bpm = parseFloat(readFileSync(join(TEMPO_ANNOT_DIR, file), 'utf8').trim());
      return bpm > 0;
    })
    .sort();
}

async function decodeAudio(filePath) {
  const raw = readFileSync(filePath);
  const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const ctx = new AudioContext({ sinkId: { type: 'none' } });
  try {
    return await ctx.decodeAudioData(ab);
  } finally {
    await ctx.close();
  }
}

function createProgressTracker(totalTracks) {
  const startTime = Date.now();
  let processed = 0;

  return {
    tick() {
      processed += 1;
      if (processed % 100 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`  ${processed}/${totalTracks} processed... (${elapsed}s)\n`);
      }
    },
    elapsedSeconds() {
      return ((Date.now() - startTime) / 1000).toFixed(1);
    },
  };
}

function printDivider() {
  console.log('='.repeat(REPORT_WIDTH));
}

function printLines(lines) {
  for (const line of lines) console.log(line);
}

function formatConfusionList(entries, limit) {
  return entries.slice(0, limit).map(([label, count]) => `  ${String(count).padStart(3)}  ${label}`);
}

function formatTempoMissList(entries, limit) {
  return entries.slice(0, limit).map(({ id, detected, annotated, detail, absPercentError }) => {
    return `  ${id}: ${detected} vs ${annotated} (${detail}, ${absPercentError.toFixed(1)}% error)`;
  });
}

async function evaluateKeyDataset({ keyFiles, detectKeyFromMono, mixDownToMono, camelotDistance, progress }) {
  let keyCorrect = 0;
  let keyClose = 0;
  const confusionCounts = new Map();
  const missShapeCounts = new Map();

  for (const file of keyFiles) {
    const audioPath = join(KEY_AUDIO_DIR, file);
    const annotPath = join(KEY_ANNOT_DIR, file.replace(/\.mp3$/, '.key'));
    const expectedLabel = normaliseKey(readFileSync(annotPath, 'utf8').trim());
    const [expectedNote, expectedMode] = expectedLabel.split(' ');

    let buf;
    try {
      buf = await decodeAudio(audioPath);
    } catch (err) {
      process.stderr.write(`  WARN decode ${file}: ${err.message}\n`);
      progress.tick();
      continue;
    }

    const mono = mixDownToMono(buf);
    const result = detectKeyFromMono(mono, buf.sampleRate);

    if (result.note === expectedNote && result.mode === expectedMode) {
      keyCorrect += 1;
    } else {
      const distance = camelotDistance(
        keyCamelot(expectedNote, expectedMode),
        result.camelot,
      );

      if (distance === 1) keyClose += 1;

      incrementCount(confusionCounts, `${expectedLabel} -> ${result.note} ${result.mode}`);
      incrementCount(
        missShapeCounts,
        classifyKeyMiss(
          { note: expectedNote, mode: expectedMode },
          { note: result.note, mode: result.mode },
          distance,
        ).shape,
      );
    }

    progress.tick();
  }

  return {
    total: keyFiles.length,
    keyCorrect,
    keyClose,
    keyFar: keyFiles.length - keyCorrect - keyClose,
    confusionCounts,
    missShapeCounts,
  };
}

async function evaluateTempoDataset({ tempoFiles, detectBpmFromMono, mixDownToMono, progress }) {
  let tempoCorrect = 0;
  let tempoHalf = 0;
  let tempoDouble = 0;
  let tempoWrongSlow = 0;
  let tempoWrongFast = 0;
  const misses = [];

  for (const annotFile of tempoFiles) {
    const id = annotFile.replace(/\.LOFI\.bpm$/, '');
    const audioPath = join(TEMPO_AUDIO_DIR, `${id}.wav`);
    const annotPath = join(TEMPO_ANNOT_DIR, annotFile);
    const annotated = parseFloat(readFileSync(annotPath, 'utf8').trim());

    let buf;
    try {
      buf = await decodeAudio(audioPath);
    } catch (err) {
      process.stderr.write(`  WARN decode ${id}.wav: ${err.message}\n`);
      progress.tick();
      continue;
    }

    const mono = mixDownToMono(buf);
    const result = detectBpmFromMono(mono, buf.sampleRate);
    const verdict = classifyTempoResult(result.bpm, annotated);

    if (verdict.verdict === 'correct') {
      tempoCorrect += 1;
    } else if (verdict.detail === 'half') {
      tempoHalf += 1;
    } else if (verdict.detail === 'double') {
      tempoDouble += 1;
    } else if (verdict.detail === 'slow') {
      tempoWrongSlow += 1;
    } else {
      tempoWrongFast += 1;
    }

    if (verdict.verdict !== 'correct') {
      misses.push({
        id,
        annotated,
        detected: result.bpm,
        detail: verdict.detail,
        absPercentError: annotated > 0 ? Math.abs((result.bpm - annotated) / annotated) * 100 : 0,
      });
    }

    progress.tick();
  }

  misses.sort((a, b) => b.absPercentError - a.absPercentError || a.id.localeCompare(b.id));

  return {
    total: tempoFiles.length,
    tempoCorrect,
    tempoHalf,
    tempoDouble,
    tempoOctave: tempoHalf + tempoDouble,
    tempoWrongSlow,
    tempoWrongFast,
    tempoWrong: tempoWrongSlow + tempoWrongFast,
    misses,
  };
}

function printKeyDiagnostics(keyResult, limit = 8) {
  printLines([
    `Key     exact: ${String(keyResult.keyCorrect).padStart(4)}/${keyResult.total}  (${formatPercent(keyResult.keyCorrect, keyResult.total)}%)`,
    `Key     close: ${String(keyResult.keyClose).padStart(4)}/${keyResult.total}  (${formatPercent(keyResult.keyClose, keyResult.total)}%)`,
    `Key     far:   ${String(keyResult.keyFar).padStart(4)}/${keyResult.total}  (${formatPercent(keyResult.keyFar, keyResult.total)}%)`,
    `Misses  same-root mode flip: ${String(keyResult.missShapeCounts.get('same-root mode flip') ?? 0).padStart(3)}`,
    `Misses  cross-root mode flip: ${String(keyResult.missShapeCounts.get('cross-root mode flip') ?? 0).padStart(3)}`,
    `Misses  same-mode wrong root: ${String(keyResult.missShapeCounts.get('same-mode wrong root') ?? 0).padStart(3)}`,
  ]);

  const confusions = sortedCounts(keyResult.confusionCounts);
  if (confusions.length > 0) {
    console.log('Top key confusions:');
    printLines(formatConfusionList(confusions, limit));
  }
}

function printTempoDiagnostics(tempoResult, limit = 8) {
  printLines([
    `Tempo   correct: ${String(tempoResult.tempoCorrect).padStart(4)}/${tempoResult.total}  (${formatPercent(tempoResult.tempoCorrect, tempoResult.total)}%)`,
    `Tempo   half:    ${String(tempoResult.tempoHalf).padStart(4)}/${tempoResult.total}  (${formatPercent(tempoResult.tempoHalf, tempoResult.total)}%)`,
    `Tempo   double:  ${String(tempoResult.tempoDouble).padStart(4)}/${tempoResult.total}  (${formatPercent(tempoResult.tempoDouble, tempoResult.total)}%)`,
    `Tempo   slow:    ${String(tempoResult.tempoWrongSlow).padStart(4)}/${tempoResult.total}  (${formatPercent(tempoResult.tempoWrongSlow, tempoResult.total)}%)`,
    `Tempo   fast:    ${String(tempoResult.tempoWrongFast).padStart(4)}/${tempoResult.total}  (${formatPercent(tempoResult.tempoWrongFast, tempoResult.total)}%)`,
  ]);

  if (tempoResult.misses.length > 0) {
    console.log('Largest tempo misses:');
    printLines(formatTempoMissList(tempoResult.misses, limit));
  }
}

async function runKeyBenchmark({ detectKeyFromMono, mixDownToMono, camelotDistance }) {
  const keyFiles = loadKeyFiles();
  const progress = createProgressTracker(keyFiles.length);

  console.log('BeatDet autoresearch key benchmark');
  console.log(`  Key dataset: ${keyFiles.length} tracks\n`);

  const keyResult = await evaluateKeyDataset({
    keyFiles,
    detectKeyFromMono,
    mixDownToMono,
    camelotDistance,
    progress,
  });

  console.log();
  printDivider();
  console.log(`RESULTS  (${progress.elapsedSeconds()}s, ${keyResult.total} tracks measured)`);
  printDivider();
  printKeyDiagnostics(keyResult);
  printDivider();
  console.log(
    `SCORE key_correct=${keyResult.keyCorrect}/${keyResult.total}` +
    ` key_close=${keyResult.keyClose}/${keyResult.total}` +
    ` pct=${formatPercent(keyResult.keyCorrect, keyResult.total, 2)}`,
  );

  return keyResult;
}

async function runTempoBenchmark({ detectBpmFromMono, mixDownToMono }) {
  const tempoFiles = loadTempoFiles();
  const progress = createProgressTracker(tempoFiles.length);

  console.log('BeatDet autoresearch tempo benchmark');
  console.log(`  Tempo dataset: ${tempoFiles.length} tracks\n`);

  const tempoResult = await evaluateTempoDataset({
    tempoFiles,
    detectBpmFromMono,
    mixDownToMono,
    progress,
  });

  console.log();
  printDivider();
  console.log(`RESULTS  (${progress.elapsedSeconds()}s, ${tempoResult.total} tracks measured)`);
  printDivider();
  printTempoDiagnostics(tempoResult);
  printDivider();
  console.log(
    `SCORE tempo_correct=${tempoResult.tempoCorrect}/${tempoResult.total}` +
    ` tempo_half=${tempoResult.tempoHalf}/${tempoResult.total}` +
    ` tempo_double=${tempoResult.tempoDouble}/${tempoResult.total}` +
    ` pct=${formatPercent(tempoResult.tempoCorrect, tempoResult.total, 2)}`,
  );

  return tempoResult;
}

async function runCombinedBenchmark({ detectKeyFromMono, detectBpmFromMono, mixDownToMono, camelotDistance }) {
  const keyFiles = loadKeyFiles();
  const tempoFiles = loadTempoFiles();
  const totalTracks = keyFiles.length + tempoFiles.length;
  const progress = createProgressTracker(totalTracks);

  console.log('BeatDet autoresearch combined benchmark');
  console.log(`  Key dataset:   ${keyFiles.length} tracks`);
  console.log(`  Tempo dataset: ${tempoFiles.length} tracks`);
  console.log(`  Total:         ${totalTracks} tracks\n`);

  const keyResult = await evaluateKeyDataset({
    keyFiles,
    detectKeyFromMono,
    mixDownToMono,
    camelotDistance,
    progress,
  });

  console.log(`  Key phase complete (${keyFiles.length} tracks)\n`);

  const tempoResult = await evaluateTempoDataset({
    tempoFiles,
    detectBpmFromMono,
    mixDownToMono,
    progress,
  });

  const combined = keyResult.keyCorrect + tempoResult.tempoCorrect;

  console.log();
  printDivider();
  console.log(`RESULTS  (${progress.elapsedSeconds()}s, ${totalTracks} tracks measured)`);
  printDivider();
  printLines([
    `Key     exact:    ${String(keyResult.keyCorrect).padStart(4)}/${keyResult.total}  (${formatPercent(keyResult.keyCorrect, keyResult.total)}%)`,
    `Key     close:    ${String(keyResult.keyClose).padStart(4)}/${keyResult.total}  (${formatPercent(keyResult.keyClose, keyResult.total)}%)`,
    `Key     combined: ${String(keyResult.keyCorrect + keyResult.keyClose).padStart(4)}/${keyResult.total}  (${formatPercent(keyResult.keyCorrect + keyResult.keyClose, keyResult.total)}%)`,
    `Tempo   correct:  ${String(tempoResult.tempoCorrect).padStart(4)}/${tempoResult.total}  (${formatPercent(tempoResult.tempoCorrect, tempoResult.total)}%)`,
    `Tempo   octave:   ${String(tempoResult.tempoOctave).padStart(4)}/${tempoResult.total}  (${formatPercent(tempoResult.tempoOctave, tempoResult.total)}%)`,
    `Tempo   half:     ${String(tempoResult.tempoHalf).padStart(4)}/${tempoResult.total}`,
    `Tempo   double:   ${String(tempoResult.tempoDouble).padStart(4)}/${tempoResult.total}`,
    `Combined:         ${String(combined).padStart(4)}/${totalTracks}`,
  ]);
  printDivider();

  const confusions = sortedCounts(keyResult.confusionCounts);
  if (confusions.length > 0) {
    console.log('Top key confusions:');
    printLines(formatConfusionList(confusions, 5));
  }

  if (tempoResult.misses.length > 0) {
    console.log('Largest tempo misses:');
    printLines(formatTempoMissList(tempoResult.misses, 5));
  }

  printDivider();
  console.log(
    `SCORE key_correct=${keyResult.keyCorrect}/${keyResult.total}` +
    ` tempo_correct=${tempoResult.tempoCorrect}/${tempoResult.total}` +
    ` combined=${combined}/${totalTracks}` +
    ` pct=${formatPercent(combined, totalTracks, 2)}`,
  );

  return { keyResult, tempoResult };
}

module.exports = {
  classifyKeyMiss,
  classifyTempoResult,
  formatPercent,
  loadKeyFiles,
  loadTempoFiles,
  runCombinedBenchmark,
  runKeyBenchmark,
  runTempoBenchmark,
  sortedCounts,
};