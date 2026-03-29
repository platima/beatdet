/**
 * Temporary ad-hoc probe: run BPM detection on every MP3 in testfiles/
 * and compare against the BPM encoded in each filename.
 * Not a test file — delete after use.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AudioContext } = require('node-web-audio-api') as { AudioContext: typeof globalThis.AudioContext };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).AudioContext = AudioContext;

import * as fs from 'fs';
import * as path from 'path';
import {
  mixDownToMono,
  computeSpectralFlux,
  smoothArray,
  normalise,
  pickPeaks,
  estimateBpm,
} from './src/lib/beatDetection';

const TESTFILES_DIR = path.join(__dirname, 'testfiles');
const DEFAULTS = {
  hopSize: 512,
  smoothingWindow: 5,
  peakThreshold: 0.15,
  minBeatGapS: 0.3,
  bpmMin: 55,
  bpmMax: 210,
};

async function decodeMp3(filePath: string): Promise<AudioBuffer> {
  const raw = fs.readFileSync(filePath);
  const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(arrayBuffer as ArrayBuffer);
  } finally {
    await ctx.close();
  }
}

function detect(buf: AudioBuffer): { bpm: number; confidence: number } {
  const { hopSize, smoothingWindow, peakThreshold, minBeatGapS, bpmMin, bpmMax } = DEFAULTS;
  const mono = mixDownToMono(buf);
  const sr = buf.sampleRate;
  const raw = computeSpectralFlux(mono, sr, hopSize);
  const smooth = smoothArray(raw, smoothingWindow);
  const norm = normalise(smooth);
  const hopDur = hopSize / sr;
  const gap = Math.min(minBeatGapS, 60 / bpmMax);
  const minGap = Math.max(1, Math.round(gap / hopDur));
  const peaks = pickPeaks(norm, peakThreshold, minGap, 0.25);
  return estimateBpm(peaks.map((f) => f * hopDur), bpmMin, bpmMax);
}

async function main(): Promise<void> {
  const files = fs.readdirSync(TESTFILES_DIR)
    .filter((f) => f.endsWith('.mp3'))
    .sort();

  console.log(`\nRunning detection on ${files.length} files:\n`);
  console.log('Track'.padEnd(52) + 'Expected  Detected  Diff    OK?');
  console.log('-'.repeat(82));

  let pass = 0, fail = 0;
  for (const f of files) {
    const m = f.match(/(\d+)bpm/i);
    const expected = m ? parseInt(m[1]) : null;
    const buf = await decodeMp3(path.join(TESTFILES_DIR, f));
    const { bpm, confidence } = detect(buf);
    const diff = expected != null ? Math.abs(bpm - expected) : null;
    const octaveDiff = expected != null
      ? Math.min(diff!, Math.abs(bpm - expected * 2), Math.abs(bpm * 2 - expected))
      : null;
    const ok: boolean | '?' = octaveDiff != null ? octaveDiff <= 5 : '?';
    if (ok === true) pass++;
    else if (ok === false) fail++;

    const name = f.replace('.mp3', '').substring(0, 50).padEnd(52);
    const exp  = expected != null ? String(expected).padEnd(10) : '?'.padEnd(10);
    const det  = String(bpm).padEnd(10);
    const dif  = diff != null ? `±${diff}`.padEnd(8) : '?'.padEnd(8);
    const flag = ok === true ? 'PASS' : ok === false ? 'FAIL' : '?';
    console.log(`${name}${exp}${det}${dif}${flag}  (conf ${confidence.toFixed(3)})`);
  }
  console.log('-'.repeat(82));
  console.log(`${pass} pass, ${fail} fail out of ${files.length} tracks`);
}

main().catch(console.error);
