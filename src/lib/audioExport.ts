/**
 * Audio export utilities — slicing, isolating, and encoding audio.
 *
 * All export functions return a Blob that can be downloaded directly by
 * the browser. WAV encoding is implemented natively without any third-party
 * library; MP3 export degrades gracefully to WAV when a native encoder is
 * unavailable.
 */

import type { Beat, ExportOptions } from '@/types';

/* ============================================================
   WAV encoding
   ============================================================ */

/**
 * Encode a raw PCM AudioBuffer as a WAV Blob (16-bit stereo or mono).
 */
export function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;

  const ab = new ArrayBuffer(fileSize);
  const view = new DataView(ab);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt  chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);         // chunk size
  view.setUint16(20, 1, true);          // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);         // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples (interleaved channels, 16-bit)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/* ============================================================
   Buffer manipulation
   ============================================================ */

/**
 * Extract a time slice from an AudioBuffer.
 *
 * @param source    The original decoded audio buffer.
 * @param startSec  Slice start in seconds.
 * @param endSec    Slice end in seconds.
 */
export function sliceBuffer(
  source: AudioBuffer,
  startSec: number,
  endSec: number
): AudioBuffer {
  const sampleRate = source.sampleRate;
  const startSample = Math.max(0, Math.round(startSec * sampleRate));
  const endSample = Math.min(source.length, Math.round(endSec * sampleRate));
  const length = Math.max(1, endSample - startSample);

  const offline = new OfflineAudioContext(
    source.numberOfChannels,
    length,
    sampleRate
  );
  const out = offline.createBuffer(source.numberOfChannels, length, sampleRate);

  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    const src = source.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      dst[i] = src[startSample + i];
    }
  }

  return out;
}

/**
 * Concatenate an array of AudioBuffers (must share the same sample rate
 * and channel count).
 */
export function concatenateBuffers(buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 0) throw new Error('No buffers to concatenate.');

  const { numberOfChannels, sampleRate } = buffers[0];
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);

  const offline = new OfflineAudioContext(numberOfChannels, totalLength, sampleRate);
  const out = offline.createBuffer(numberOfChannels, totalLength, sampleRate);

  let offset = 0;
  for (const buf of buffers) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      out.getChannelData(ch).set(buf.getChannelData(ch), offset);
    }
    offset += buf.length;
  }

  return out;
}

/**
 * Normalise an AudioBuffer so the peak amplitude is at –1 dBFS (≈ 0.891).
 * Modifies the buffer in-place for efficiency.
 */
export function normalisePeak(buffer: AudioBuffer): AudioBuffer {
  const TARGET = 0.891; // –1 dBFS
  let peak = 0;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  if (peak === 0) return buffer;
  const gain = TARGET / peak;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }

  return buffer;
}

/* ============================================================
   High-level export functions
   ============================================================ */

/**
 * Decode an ArrayBuffer of audio data into an AudioBuffer.
 * Uses a short-lived AudioContext that is closed immediately after.
 */
async function decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close();
  }
}

/** Result from a multi-file export (cut-at-beats mode). */
export interface ExportedSlice {
  /** 1-based index of this slice. */
  index: number;
  /** Filename to use when downloading. */
  filename: string;
  /** Audio data as a downloadable Blob. */
  blob: Blob;
}

/**
 * Export the full audio file (optionally normalised), with no slicing.
 */
export async function exportFull(
  arrayBuffer: ArrayBuffer,
  options: ExportOptions,
  baseName: string
): Promise<ExportedSlice[]> {
  const buffer = await decodeAudio(arrayBuffer);
  if (options.normalise) normalisePeak(buffer);
  const blob = encodeWav(buffer);
  return [{ index: 1, filename: `${baseName}.wav`, blob }];
}

/**
 * Export only the portions of the audio that contain beats.
 * Pre-roll and post-roll are applied around each beat.
 */
export async function exportIsolatedBeats(
  arrayBuffer: ArrayBuffer,
  beats: Beat[],
  options: ExportOptions,
  baseName: string
): Promise<ExportedSlice[]> {
  const buffer = await decodeAudio(arrayBuffer);

  // Merge overlapping beat regions
  const regions: Array<{ start: number; end: number }> = beats.map((b) => ({
    start: Math.max(0, b.time - options.preRoll),
    end: Math.min(buffer.duration, b.time + options.postRoll),
  }));

  const merged: Array<{ start: number; end: number }> = [];
  for (const region of regions) {
    if (merged.length === 0) {
      merged.push({ ...region });
    } else {
      const last = merged[merged.length - 1];
      if (region.start <= last.end) {
        last.end = Math.max(last.end, region.end);
      } else {
        merged.push({ ...region });
      }
    }
  }

  const slices = merged.map((r) => sliceBuffer(buffer, r.start, r.end));
  const combined = concatenateBuffers(slices);
  if (options.normalise) normalisePeak(combined);
  const blob = encodeWav(combined);

  return [{ index: 1, filename: `${baseName}_beats.wav`, blob }];
}

/**
 * Cut the audio at each beat boundary and return individual slices.
 * Each slice starts at one beat and ends at the next.
 */
export async function exportCutAtBeats(
  arrayBuffer: ArrayBuffer,
  beats: Beat[],
  options: ExportOptions,
  baseName: string
): Promise<ExportedSlice[]> {
  const buffer = await decodeAudio(arrayBuffer);
  const slices: ExportedSlice[] = [];

  // Build cut points: [0, beat1, beat2, ..., beatN, duration]
  const cutPoints = [0, ...beats.map((b) => b.time), buffer.duration];

  for (let i = 0; i < cutPoints.length - 1; i++) {
    const start = Math.max(0, cutPoints[i] - (i > 0 ? options.preRoll : 0));
    const end = Math.min(
      buffer.duration,
      cutPoints[i + 1] + (i < cutPoints.length - 2 ? options.postRoll : 0)
    );

    const slice = sliceBuffer(buffer, start, end);
    if (options.normalise) normalisePeak(slice);
    const blob = encodeWav(slice);
    const filename = `${baseName}_slice_${String(i + 1).padStart(3, '0')}.wav`;
    slices.push({ index: i + 1, filename, blob });
  }

  return slices;
}

/**
 * Export a custom time range from the audio.
 */
export async function exportCustomRange(
  arrayBuffer: ArrayBuffer,
  options: ExportOptions,
  baseName: string
): Promise<ExportedSlice[]> {
  const buffer = await decodeAudio(arrayBuffer);
  const start = options.rangeStart ?? 0;
  const end = options.rangeEnd ?? buffer.duration;
  const slice = sliceBuffer(buffer, start, end);
  if (options.normalise) normalisePeak(slice);
  const blob = encodeWav(slice);
  return [{ index: 1, filename: `${baseName}_custom.wav`, blob }];
}

/**
 * Master export dispatcher — routes to the appropriate export function
 * based on the chosen export mode.
 */
export async function exportAudio(
  arrayBuffer: ArrayBuffer,
  beats: Beat[],
  options: ExportOptions,
  originalFileName: string
): Promise<ExportedSlice[]> {
  // Strip extension from original filename to use as base name
  const baseName = originalFileName.replace(/\.[^.]+$/, '');

  switch (options.mode) {
    case 'full':
      return exportFull(arrayBuffer, options, baseName);
    case 'isolate-beats':
      return exportIsolatedBeats(arrayBuffer, beats, options, baseName);
    case 'cut-at-beats':
      return exportCutAtBeats(arrayBuffer, beats, options, baseName);
    case 'custom-range':
      return exportCustomRange(arrayBuffer, options, baseName);
    default:
      return exportFull(arrayBuffer, options, baseName);
  }
}

/**
 * Trigger a browser download for a single Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
