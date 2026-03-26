/**
 * Unit tests for the BeatDet beat detection engine.
 *
 * All tested functions are pure TypeScript with no browser dependencies, so
 * these run in the Node test environment via Jest.
 *
 * Test groups:
 *   - fft              Cooley-Tukey FFT correctness
 *   - smoothArray      Moving-average smoother
 *   - normalise        [0,1] normalisation
 *   - computeEnergyEnvelope  O(N) onset strength
 *   - computeSpectralFlux    O(N log N) onset strength
 *   - pickPeaks        Adaptive peak picking
 *   - estimateBpm      Multi-lag IOI accumulation with octave correction
 */

import {
  fft,
  smoothArray,
  normalise,
  computeEnergyEnvelope,
  computeSpectralFlux,
  pickPeaks,
  estimateBpm,
} from '../beatDetection';

/* ============================================================
   Helpers
   ============================================================ */

/** Build a Float32Array from an ordinary number array. */
const f32 = (values: number[]): Float32Array => new Float32Array(values);
/** Build a Float64Array from an ordinary number array. */
const f64 = (values: number[]): Float64Array => new Float64Array(values);

/**
 * Generate a perfect metronome beat-time array.
 * @param bpm       Tempo in beats per minute.
 * @param durationS Total track length in seconds.
 * @param offsetS   Time of the first beat (default 0).
 */
function metronome(bpm: number, durationS: number, offsetS = 0): number[] {
  const interval = 60 / bpm;
  const times: number[] = [];
  for (let t = offsetS; t <= durationS; t += interval) {
    times.push(t);
  }
  return times;
}

/**
 * Generate a pure cosine in a Float32Array.
 * Useful for FFT and spectral-flux smoke tests.
 */
function cosineSignal(freqBin: number, fftSize: number): Float32Array {
  const sig = new Float32Array(fftSize);
  for (let n = 0; n < fftSize; n++) {
    sig[n] = Math.cos((2 * Math.PI * freqBin * n) / fftSize);
  }
  return sig;
}

/* ============================================================
   fft: Cooley-Tukey radix-2 correctness
   ============================================================ */

describe('fft', () => {
  it('DC signal: energy at bin 0 only', () => {
    const n = 8;
    const re = f64(Array(n).fill(1));
    const im = f64(Array(n).fill(0));
    fft(re, im);

    // re[0] should equal the sum of inputs (N * 1 = 8)
    expect(re[0]).toBeCloseTo(n, 5);
    // All other bins should be zero
    for (let k = 1; k < n; k++) {
      expect(Math.abs(re[k])).toBeLessThan(1e-9);
      expect(Math.abs(im[k])).toBeLessThan(1e-9);
    }
  });

  it('delta function: flat magnitude spectrum', () => {
    // x[0]=1, rest 0 → X[k]=1 for all k
    const n = 8;
    const re = f64([1, 0, 0, 0, 0, 0, 0, 0]);
    const im = f64(Array(n).fill(0));
    fft(re, im);

    for (let k = 0; k < n; k++) {
      const mag = Math.sqrt(re[k] ** 2 + im[k] ** 2);
      expect(mag).toBeCloseTo(1, 5);
    }
  });

  it('single-frequency cosine: energy at conjugate bins', () => {
    // DFT of cos(2π·2·n/16): energy concentrated at bins 2 and 14 (N-2).
    const n = 16;
    const freqBin = 2;
    const re = f64(Array.from({ length: n }, (_, i) =>
      Math.cos((2 * Math.PI * freqBin * i) / n)
    ));
    const im = f64(Array(n).fill(0));
    fft(re, im);

    const mags = Array.from({ length: n }, (_, k) =>
      Math.sqrt(re[k] ** 2 + im[k] ** 2)
    );

    // Bins 2 and N−2=14 should have the highest magnitude (≈ N/2 = 8)
    const sorted = [...mags].sort((a, b) => b - a);
    expect(mags[freqBin]).toBeCloseTo(sorted[0], 0);
    expect(mags[n - freqBin]).toBeCloseTo(sorted[1], 0);

    // All other bins should be tiny
    for (let k = 0; k < n; k++) {
      if (k !== freqBin && k !== n - freqBin) {
        expect(mags[k]).toBeLessThan(1e-8);
      }
    }
  });

  it('Nyquist signal [1,-1,1,-1,...]: energy at bin N/2 only', () => {
    const n = 8;
    const re = f64(Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 1 : -1)));
    const im = f64(Array(n).fill(0));
    fft(re, im);

    // Nyquist bin is n/2 = 4
    const nyquist = n / 2;
    const mags = Array.from({ length: n }, (_, k) =>
      Math.sqrt(re[k] ** 2 + im[k] ** 2)
    );
    expect(mags[nyquist]).toBeCloseTo(n, 5);
    for (let k = 0; k < n; k++) {
      if (k !== nyquist) expect(mags[k]).toBeLessThan(1e-9);
    }
  });
});

/* ============================================================
   smoothArray: moving-average smoother
   ============================================================ */

describe('smoothArray', () => {
  it('window=1 returns the same values', () => {
    const input = f32([0.1, 0.5, 0.3, 0.9, 0.2]);
    const out = smoothArray(input, 1);
    for (let i = 0; i < input.length; i++) {
      expect(out[i]).toBeCloseTo(input[i], 6);
    }
  });

  it('window=3 averages neighbouring values', () => {
    // [0, 3, 0]: middle value should average to (0+3+0)/3 = 1
    const input = f32([0, 3, 0]);
    const out = smoothArray(input, 3);
    expect(out[1]).toBeCloseTo(1, 5);
  });

  it('output has the same length as input', () => {
    const input = f32([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(smoothArray(input, 4).length).toBe(input.length);
  });

  it('large window on constant signal returns constant', () => {
    const input = f32(Array(20).fill(0.5));
    const out = smoothArray(input, 10);
    for (const v of out) expect(v).toBeCloseTo(0.5, 5);
  });
});

/* ============================================================
   normalise: [0,1] normalisation
   ============================================================ */

describe('normalise', () => {
  it('scales max to 1 and preserves relative proportions', () => {
    const input = f32([2, 4, 1, 3]);
    const out = normalise(input);
    expect(out[0]).toBeCloseTo(0.5, 5);  // 2/4
    expect(out[1]).toBeCloseTo(1.0, 5);  // 4/4
    expect(out[2]).toBeCloseTo(0.25, 5); // 1/4
    expect(out[3]).toBeCloseTo(0.75, 5); // 3/4
  });

  it('all-zero input returns unchanged (no divide-by-zero)', () => {
    const input = f32([0, 0, 0]);
    const out = normalise(input);
    for (const v of out) expect(v).toBe(0);
  });

  it('single-element input normalises to 1', () => {
    const out = normalise(f32([7]));
    expect(out[0]).toBeCloseTo(1, 5);
  });
});

/* ============================================================
   computeEnergyEnvelope: O(N) onset strength
   ============================================================ */

describe('computeEnergyEnvelope', () => {
  const hopSize = 256;

  it('returns the expected number of hops', () => {
    const numSamples = 4096;
    const mono = new Float32Array(numSamples);
    const out = computeEnergyEnvelope(mono, hopSize);
    expect(out.length).toBe(Math.floor(numSamples / hopSize));
  });

  it('constant-amplitude signal produces all-zero onsets after the first hop', () => {
    // Constant RMS → energy delta = 0 every hop beyond the initial transient.
    const mono = new Float32Array(4096).fill(0.5);
    const out = computeEnergyEnvelope(mono, hopSize);
    // All onsets beyond hop 0 should be ≤ 0 (half-wave rectified)
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBe(0);
    }
  });

  it('sudden amplitude jump produces a positive onset', () => {
    const numSamples = 4 * hopSize;
    const mono = new Float32Array(numSamples);
    // First two hops: silence. Second two hops: loud signal.
    for (let i = 2 * hopSize; i < numSamples; i++) mono[i] = 1.0;
    const out = computeEnergyEnvelope(mono, hopSize);
    // Onset should appear at hop 2 (where the energy jumps)
    expect(out[2]).toBeGreaterThan(0);
    // Hops after the initial jump should settle back to zero
    expect(out[3]).toBe(0);
  });
});

/* ============================================================
   computeSpectralFlux: O(N log N) onset strength
   ============================================================ */

describe('computeSpectralFlux', () => {
  const sampleRate = 44100;
  const hopSize = 512;

  it('returns the expected number of hops', () => {
    const numSamples = 44100; // 1 second
    const mono = new Float32Array(numSamples);
    const out = computeSpectralFlux(mono, sampleRate, hopSize);
    const expectedHops = Math.floor((numSamples - hopSize * 2) / hopSize);
    expect(out.length).toBe(expectedHops);
  });

  it('silent signal produces near-zero flux', () => {
    const mono = new Float32Array(8192);
    const out = computeSpectralFlux(mono, sampleRate, hopSize);
    for (const v of out) expect(v).toBeCloseTo(0, 5);
  });

  it('steady-state sinusoid produces low flux after the first frame', () => {
    // A pure cosine that has been playing since t=0 should not create new
    // spectral energy; flux should settle near zero after one frame.
    const numSamples = 8192;
    const freqBin = 10;
    // Fill the entire buffer with the same cosine so there is no transient.
    const mono = new Float32Array(numSamples).map(
      (_, n) => Math.cos((2 * Math.PI * freqBin * n) / (hopSize * 2))
    );
    const out = computeSpectralFlux(mono, sampleRate, hopSize);
    // After the first hop (where prev mags are all zero), flux settles.
    const steadyStateFlux = Array.from(out.slice(2));
    const maxFlux = Math.max(...steadyStateFlux);
    // Allow a small epsilon for floating-point windowing artefacts.
    expect(maxFlux).toBeLessThan(1.0);
  });

  it('returns empty array when signal is too short', () => {
    const mono = new Float32Array(100); // shorter than one fftSize (hopSize*2=1024)
    const out = computeSpectralFlux(mono, sampleRate, hopSize);
    expect(out.length).toBe(0);
  });
});

/* ============================================================
   pickPeaks: adaptive peak picking
   ============================================================ */

describe('pickPeaks', () => {
  it('identifies clear isolated peaks', () => {
    // Onset curve with peaks at indices 5 and 15, separated by silence.
    // Local medians will be ~0 in quiet regions so multiplicative threshold is met.
    const onsets = new Float32Array(30).fill(0.01);
    onsets[5] = 1.0;
    onsets[15] = 0.9;

    const peaks = pickPeaks(onsets, 0.15, 3);
    expect(peaks).toContain(5);
    expect(peaks).toContain(15);
  });

  it('suppresses peaks below the multiplicative threshold', () => {
    // All values identical; no local maximum exists.
    const onsets = new Float32Array(20).fill(0.5);
    const peaks = pickPeaks(onsets, 0.15, 3);
    expect(peaks.length).toBe(0);
  });

  it('enforces the minimum inter-beat gap', () => {
    // Two peaks 2 frames apart with minGapFrames=5; only the first is kept.
    const onsets = new Float32Array(20).fill(0.01);
    onsets[5] = 1.0;
    onsets[7] = 0.9;
    const peaks = pickPeaks(onsets, 0.15, 5);
    expect(peaks).toContain(5);
    expect(peaks).not.toContain(7);
  });

  it('returns an empty array for an all-zero onset curve', () => {
    const onsets = new Float32Array(30).fill(0);
    expect(pickPeaks(onsets, 0.15, 3).length).toBe(0);
  });

  it('absMinHeight suppresses peaks below the absolute floor', () => {
    // Two clear local maxima, but the second is below the 0.5 absolute floor.
    const onsets = new Float32Array(30).fill(0.01);
    onsets[5] = 1.0;
    onsets[15] = 0.4;
    const peaks = pickPeaks(onsets, 0.15, 3, 0.5);
    expect(peaks).toContain(5);
    expect(peaks).not.toContain(15);
  });

  it('absMinHeight=0 (default) preserves all qualifying peaks', () => {
    const onsets = new Float32Array(30).fill(0.01);
    onsets[5] = 0.1;
    onsets[15] = 0.05;
    // Both are local maxima well above the median-based threshold.
    const peaks = pickPeaks(onsets, 0.15, 3);
    expect(peaks).toContain(5);
    expect(peaks).toContain(15);
  });
});

/* ============================================================
   estimateBpm: multi-lag IOI with Gaussian + octave correction
   ============================================================ */

describe('estimateBpm', () => {
  /** Round to the nearest integer and check within ±tolerance. */
  function expectBpm(actual: number, expected: number, tolerance = 2) {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
  }

  it('returns zero BPM for fewer than 2 beat times', () => {
    expect(estimateBpm([], 60, 200).bpm).toBe(0);
    expect(estimateBpm([1.0], 60, 200).bpm).toBe(0);
  });

  it('detects 126 BPM from clean beat times', () => {
    const times = metronome(126, 30); // 30-second excerpt
    const { bpm } = estimateBpm(times, 60, 200);
    expectBpm(bpm, 126);
  });

  it('detects 82 BPM from clean beat times', () => {
    const times = metronome(82, 30);
    const { bpm } = estimateBpm(times, 60, 200);
    expectBpm(bpm, 82);
  });

  it('survives a small number of subdivision false positives', () => {
    // Real scenario: beat detector fired correctly at 82 BPM but also picked up
    // a handful of 8th-note false positives. The majority of IOIs should still
    // vote for 82 BPM and the result should be correct.
    const T = 60 / 82; // ≈ 0.7317 s
    const downbeats = metronome(82, 30);           // ~42 clean 82-BPM beats
    // Inject 5 false positives at 8th-note positions between downbeats 0–4
    const falsePositives = [T / 2, 3 * T / 2, 5 * T / 2, 7 * T / 2, 9 * T / 2];
    const allBeats = [...downbeats, ...falsePositives].sort((a, b) => a - b);
    const { bpm } = estimateBpm(allBeats, 60, 200);
    expectBpm(bpm, 82, 3);
  });

  it('detects high BPM ≈ 200 from clean beat times', () => {
    const times = metronome(200, 20);
    const { bpm } = estimateBpm(times, 60, 220);
    expectBpm(bpm, 200, 3);
  });

  it('detects 203 BPM within ±3 BPM', () => {
    // Regression: previously returned 199 due to integer histogram rounding.
    const times = metronome(203, 20);
    const { bpm } = estimateBpm(times, 60, 220);
    expectBpm(bpm, 203, 3);
  });

  it('excludes IOIs that fall outside the requested BPM range', () => {
    // With bpmMin=100 and bpmMax=140, beats at 120 BPM should be found...
    const times120 = metronome(120, 20);
    const { bpm: found } = estimateBpm(times120, 100, 140);
    expectBpm(found, 120, 3);

    // ...but with a range of 140–200 that excludes 120 BPM, no valid IOIs
    // should match and the function should return 0 BPM gracefully.
    const { bpm: excluded } = estimateBpm(times120, 140, 200);
    expect(excluded).toBe(0);
  });

  it('returns candidates list with at least the winning BPM', () => {
    const times = metronome(120, 20);
    const { candidates, bpm } = estimateBpm(times, 60, 200);
    expect(candidates.length).toBeGreaterThan(0);
    // The first candidate should match the returned BPM.
    expect(candidates[0].bpm).toBe(bpm);
  });

  it('returns a confidence value in [0, 1]', () => {
    const times = metronome(120, 20);
    const { confidence } = estimateBpm(times, 60, 200);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it('handles noisy jitter gracefully', () => {
    // Add +-10 ms random jitter to beat times; should still detect 120 BPM.
    const times = metronome(120, 30).map((t) => t + (Math.random() - 0.5) * 0.02);
    const { bpm } = estimateBpm(times, 60, 200);
    expectBpm(bpm, 120, 5);
  });
});
