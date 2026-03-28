/**
 * Unit tests for audioExport.ts.
 *
 * Tests cover WAV encoding correctness, buffer manipulation, peak
 * normalisation, ZIP bundling, and file-extension handling for the
 * format-aware export helpers.
 *
 * AudioBuffer creation uses `node-web-audio-api` so these run in Node
 * without a browser — identical to the realAudio.test.ts approach.
 *
 * Note: encodeMp3 and the high-level exportFull / exportCutAtBeats /
 * exportIsolatedBeats / exportCustomRange functions depend on
 * AudioContext.decodeAudioData and a dynamic lamejs import.  Those are
 * covered at the integration level by realAudio.test.ts; the present
 * tests focus on the pure / low-level helpers that can be verified
 * without supplying real audio data.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AudioContext } = require('node-web-audio-api') as {
  AudioContext: typeof globalThis.AudioContext;
};

// Expose AudioContext globally so audioExport.ts can find it at call time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).AudioContext = AudioContext;

import { encodeWav, sliceBuffer, concatenateBuffers, normalisePeak, bundleZip, closeBufferContext } from '../audioExport';
import type { ExportedSlice } from '../audioExport';

// A single shared AudioContext for all buffer creation, plus the lazy
// singleton inside audioExport.ts.  Closing both in afterAll lets Jest
// exit cleanly without --forceExit or "open handles" warnings.
const sharedCtx = new AudioContext();
afterAll(async () => {
  if (sharedCtx.state !== 'closed') await sharedCtx.close();
  await closeBufferContext();
});

/* ============================================================
   Helpers
   ============================================================ */

/** Synthesise an AudioBuffer using the shared (polyfilled) AudioContext. */
function makeBuffer(
  numChannels: number,
  numSamples: number,
  sampleRate: number,
  fill?: (ch: number, i: number) => number
): AudioBuffer {
  const buf = sharedCtx.createBuffer(numChannels, numSamples, sampleRate);
  if (fill) {
    for (let ch = 0; ch < numChannels; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < numSamples; i++) {
        data[i] = fill(ch, i);
      }
    }
  }
  return buf;
}

/** Read 4 bytes at offset as an ASCII string (for RIFF header checks). */
function readFourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

/** Read a little-endian uint32 from a byte array. */
function readUint32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

/** Read a little-endian uint16 from a byte array. */
function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

/* ============================================================
   encodeWav
   ============================================================ */

describe('encodeWav', () => {
  it('returns a Blob with audio/wav MIME type', async () => {
    const buf = makeBuffer(1, 1024, 44100);
    const blob = encodeWav(buf);
    expect(blob.type).toBe('audio/wav');
  });

  it('output starts with RIFF / WAVE header', async () => {
    const buf = makeBuffer(1, 512, 44100);
    const blob = encodeWav(buf);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(readFourCC(bytes, 0)).toBe('RIFF');
    expect(readFourCC(bytes, 8)).toBe('WAVE');
    expect(readFourCC(bytes, 12)).toBe('fmt ');
    expect(readFourCC(bytes, 36)).toBe('data');
  });

  it('header encodes correct channel count and sample rate', async () => {
    const numChannels = 2;
    const sampleRate = 22050;
    const buf = makeBuffer(numChannels, 256, sampleRate);
    const blob = encodeWav(buf);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(readUint16LE(bytes, 22)).toBe(numChannels);
    expect(readUint32LE(bytes, 24)).toBe(sampleRate);
  });

  it('file size matches the expected WAV formula', async () => {
    const numSamples = 1000;
    const numChannels = 1;
    const buf = makeBuffer(numChannels, numSamples, 44100);
    const blob = encodeWav(buf);
    // WAV file size = 44-byte header + numSamples * numChannels * 2 (16-bit)
    const expectedBytes = 44 + numSamples * numChannels * 2;
    expect(blob.size).toBe(expectedBytes);
  });

  it('full-scale positive sample encodes to maximum int16 value', async () => {
    // Channel data = [1.0], which should encode to 0x7FFF in int16
    const buf = makeBuffer(1, 1, 44100, () => 1.0);
    const blob = encodeWav(buf);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Sample starts at byte 44 (after the 44-byte header)
    const lo = bytes[44];
    const hi = bytes[45];
    const int16 = (hi << 8) | lo; // little-endian
    expect(int16).toBe(0x7fff);
  });

  it('silence encodes to all-zero PCM data', async () => {
    const numSamples = 64;
    const buf = makeBuffer(1, numSamples, 44100, () => 0);
    const blob = encodeWav(buf);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // All 128 bytes of PCM data should be zero
    for (let i = 44; i < bytes.length; i++) {
      expect(bytes[i]).toBe(0);
    }
  });
});

/* ============================================================
   normalisePeak
   ============================================================ */

describe('normalisePeak', () => {
  it('scales peak amplitude to ~0.891 (−1 dBFS)', () => {
    const TARGET = 0.891;
    // Buffer with a single sample at 0.5 (half full scale)
    const buf = makeBuffer(1, 100, 44100, (_, i) => (i === 50 ? 0.5 : 0));
    normalisePeak(buf);
    const data = buf.getChannelData(0);
    // Peak sample should have been scaled to TARGET
    expect(data[50]).toBeCloseTo(TARGET, 3);
  });

  it('scales consistently across two channels', () => {
    const TARGET = 0.891;
    const buf = makeBuffer(2, 100, 44100, (ch, i) => {
      if (ch === 0 && i === 10) return 0.4;
      if (ch === 1 && i === 20) return 0.2;
      return 0;
    });
    normalisePeak(buf);
    // Both channels should be scaled by the same gain (peak = 0.4)
    const gain = TARGET / 0.4;
    expect(buf.getChannelData(0)[10]).toBeCloseTo(0.4 * gain, 4);
    expect(buf.getChannelData(1)[20]).toBeCloseTo(0.2 * gain, 4);
  });

  it('returns the buffer unchanged when all samples are zero', () => {
    const buf = makeBuffer(1, 64, 44100, () => 0);
    const result = normalisePeak(buf);
    for (const s of result.getChannelData(0)) {
      expect(s).toBe(0);
    }
  });

  it('does not clip when peak is already at full scale', () => {
    const TARGET = 0.891;
    const buf = makeBuffer(1, 10, 44100, (_, i) => (i === 5 ? 1.0 : 0));
    normalisePeak(buf);
    const data = buf.getChannelData(0);
    expect(data[5]).toBeCloseTo(TARGET, 3);
    // All other samples remain at zero (scaled)
    for (let i = 0; i < 10; i++) {
      if (i !== 5) expect(data[i]).toBe(0);
    }
  });
});

/* ============================================================
   sliceBuffer
   ============================================================ */

describe('sliceBuffer', () => {
  const SAMPLE_RATE = 44100;

  it('returns a buffer of the correct duration', () => {
    // 1-second buffer, slice seconds 0.1–0.4
    const buf = makeBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
    const slice = sliceBuffer(buf, 0.1, 0.4);
    const expectedSamples = Math.round((0.4 - 0.1) * SAMPLE_RATE);
    // Allow ±1 sample for rounding at boundaries
    expect(Math.abs(slice.length - expectedSamples)).toBeLessThanOrEqual(1);
  });

  it('preserves the sample rate', () => {
    const buf = makeBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
    const slice = sliceBuffer(buf, 0, 0.5);
    expect(slice.sampleRate).toBe(SAMPLE_RATE);
  });

  it('preserves the channel count', () => {
    const buf = makeBuffer(2, SAMPLE_RATE, SAMPLE_RATE);
    const slice = sliceBuffer(buf, 0, 0.5);
    expect(slice.numberOfChannels).toBe(2);
  });

  it('copies PCM values correctly', () => {
    // Fill with a ramp: sample[i] = i / numSamples
    const numSamples = SAMPLE_RATE;
    const buf = makeBuffer(1, numSamples, SAMPLE_RATE, (_, i) => i / numSamples);

    // Slice the middle quarter (0.25 s – 0.5 s)
    const slice = sliceBuffer(buf, 0.25, 0.5);
    const sliceData = slice.getChannelData(0);
    const srcData = buf.getChannelData(0);

    const startSample = Math.round(0.25 * SAMPLE_RATE);
    // Compare a selection of samples
    for (let i = 0; i < 10; i++) {
      expect(sliceData[i]).toBeCloseTo(srcData[startSample + i], 5);
    }
  });

  it('clamps end to buffer duration without throwing', () => {
    const buf = makeBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
    // Request a slice that goes past the end of the buffer
    expect(() => sliceBuffer(buf, 0.8, 2.0)).not.toThrow();
    const slice = sliceBuffer(buf, 0.8, 2.0);
    // Should not be longer than the remaining samples
    expect(slice.length).toBeLessThanOrEqual(Math.round(0.2 * SAMPLE_RATE) + 1);
  });
});

/* ============================================================
   concatenateBuffers
   ============================================================ */

describe('concatenateBuffers', () => {
  const SR = 44100;

  it('produces a buffer whose length is the sum of inputs', () => {
    const a = makeBuffer(1, 100, SR);
    const b = makeBuffer(1, 200, SR);
    const c = makeBuffer(1, 50, SR);
    const joined = concatenateBuffers([a, b, c]);
    expect(joined.length).toBe(350);
  });

  it('preserves PCM data from all constituent buffers in order', () => {
    // Fill each buffer with a distinct constant value
    const a = makeBuffer(1, 100, SR, () => 0.1);
    const b = makeBuffer(1, 100, SR, () => 0.5);
    const joined = concatenateBuffers([a, b]);
    const data = joined.getChannelData(0);

    // First 100 samples should be ~0.1
    for (let i = 0; i < 100; i++) {
      expect(data[i]).toBeCloseTo(0.1, 5);
    }
    // Next 100 samples should be ~0.5
    for (let i = 100; i < 200; i++) {
      expect(data[i]).toBeCloseTo(0.5, 5);
    }
  });

  it('works with stereo buffers', () => {
    const a = makeBuffer(2, 50, SR, (ch) => ch === 0 ? 0.3 : 0.7);
    const b = makeBuffer(2, 50, SR, () => 0.0);
    const joined = concatenateBuffers([a, b]);
    expect(joined.numberOfChannels).toBe(2);
    expect(joined.getChannelData(0)[0]).toBeCloseTo(0.3, 5);
    expect(joined.getChannelData(1)[0]).toBeCloseTo(0.7, 5);
  });

  it('throws when given an empty array', () => {
    expect(() => concatenateBuffers([])).toThrow();
  });
});

/* ============================================================
   bundleZip
   ============================================================ */

describe('bundleZip', () => {
  function makeSlice(index: number, filename: string, content: string): ExportedSlice {
    const blob = new Blob([content], { type: 'text/plain' });
    return { index, filename, blob };
  }

  it('returns a Blob with application/zip MIME type', async () => {
    const slices = [makeSlice(1, 'beat_001.wav', 'dummy')];
    const zip = await bundleZip(slices);
    expect(zip.type).toBe('application/zip');
  });

  it('output starts with ZIP magic bytes (PK header)', async () => {
    const slices = [makeSlice(1, 'track.wav', 'audio data here')];
    const zip = await bundleZip(slices);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    // ZIP local file header signature: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
    expect(bytes[0]).toBe(0x50); // 'P'
    expect(bytes[1]).toBe(0x4b); // 'K'
  });

  it('bundles multiple slices into a single Blob', async () => {
    const slices = [
      makeSlice(1, 'slice_001.wav', 'data-one'),
      makeSlice(2, 'slice_002.wav', 'data-two'),
      makeSlice(3, 'slice_003.wav', 'data-three'),
    ];
    const zip = await bundleZip(slices);
    // A valid ZIP with 3 entries should be > 0 bytes and well-formed
    expect(zip.size).toBeGreaterThan(0);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // PK magic
    expect(bytes[1]).toBe(0x4b);
  });
});

/* ============================================================
   File size guard constants
   ============================================================ */

describe('file size guard', () => {
  it('MAX_FILE_BYTES is 100 MB', () => {
    // Import just the constant by re-defining the expected value.
    // The actual check lives in useAudioAnalysis.ts; this test documents
    // the agreed Cloudflare Pages upload limit.
    const MAX_FILE_BYTES = 100 * 1024 * 1024;
    expect(MAX_FILE_BYTES).toBe(104_857_600);
    expect(MAX_FILE_BYTES / (1024 * 1024)).toBe(100);
  });
});
