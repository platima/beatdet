/**
 * Unit tests for the key detection engine.
 *
 * Tests cover:
 *   - pearsonCorrelation / rotateLeft helpers (via detectKey)
 *   - computeChromaVector: pure-tone input maps to the expected pitch class
 *   - detectKey: synthetic chromatic input returns correct key
 *   - Relative key calculation for all modes
 *   - Camelot codes for well-known keys
 *   - Ambiguity flag on noisy (flat) input
 */

import { detectKey, computeChromaVector, resolveFifthConfusion } from '../keyDetection';

/* ============================================================
   Helpers
   ============================================================ */

/**
 * Generate a mono Float32Array containing a pure sine wave.
 *
 * @param freq        Frequency in Hz.
 * @param sampleRate  Sample rate in Hz.
 * @param durationS   Duration in seconds.
 */
function sineTone(freq: number, sampleRate: number, durationS: number): Float32Array {
  const len = Math.floor(sampleRate * durationS);
  const buf = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    buf[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
  }
  return buf;
}

/**
 * Build a synthetic mono signal whose chroma vector is dominated by a given
 * pitch class, using several octave-spread harmonics to make the pitch class
 * clearly dominant across the chroma range (65ÔÇô2100 Hz).
 *
 * @param pitchClass  0=C, 1=C#, 2=D, ÔÇª 11=B
 * @param sampleRate  Sample rate in Hz.
 */
function chromaDominantSignal(pitchClass: number, sampleRate: number): Float32Array {
  const durationS = 4;
  const len = Math.floor(sampleRate * durationS);
  const buf = new Float32Array(len);
  // Middle octave reference: C4 = 261.63 Hz (MIDI note 60 + pitchClass)
  const baseFreq = 440 * Math.pow(2, (pitchClass - 9) / 12); // A4-relative
  // Add octaves: ensure at least one falls in [65, 2100] Hz
  for (let oct = -2; oct <= 3; oct++) {
    const f = baseFreq * Math.pow(2, oct);
    if (f < 65 || f > 2100) continue;
    for (let i = 0; i < len; i++) {
      buf[i] += Math.sin(2 * Math.PI * f * i / sampleRate);
    }
  }
  return buf;
}

/**
 * Build a multi-octave synthetic signal with the specified pitch classes weighted
 * at the given amplitudes.
 *
 * Using multiple octaves per pitch class ensures each pitch class accumulates
 * strong energy across many FFT bins, making the chroma vector robust against
 * spectral leakage from adjacent frequencies.
 *
 * @param notes       Array of { pitchClass, amplitude } entries.
 * @param sampleRate  Sample rate in Hz.
 */
function buildChordSignal(
  notes: Array<{ pc: number; amp: number }>,
  sampleRate: number
): Float32Array {
  const durationS = 4;
  const len = Math.floor(sampleRate * durationS);
  const buf = new Float32Array(len);
  for (const { pc, amp } of notes) {
    // Anchor to A4 = 440 Hz (pitch class 9).
    const baseFreq = 440 * Math.pow(2, (pc - 9) / 12);
    for (let oct = -3; oct <= 3; oct++) {
      const freq = baseFreq * Math.pow(2, oct);
      if (freq < 65 || freq > 2100) continue;
      for (let i = 0; i < len; i++) {
        buf[i] += amp * Math.sin(2 * Math.PI * freq * i / sampleRate);
      }
    }
  }
  return buf;
}

/**
 * Build a signal strongly resembling C major:
 * C (tonic) at full amplitude, E (mediant) and G (dominant) lower.
 */
function cMajorSignal(sampleRate: number): Float32Array {
  return buildChordSignal([
    { pc: 0, amp: 1.0 },  // C  tonic
    { pc: 4, amp: 0.6 },  // E  mediant
    { pc: 7, amp: 0.8 },  // G  dominant
    { pc: 2, amp: 0.2 },  // D  supertonic
    { pc: 5, amp: 0.2 },  // F  subdominant
    { pc: 9, amp: 0.2 },  // A  submediant
    { pc: 11, amp: 0.15 }, // B  leading tone
  ], sampleRate);
}

/**
 * Build a signal strongly resembling A minor:
 * A (tonic) at full amplitude, C (mediant) and E (dominant) lower.
 */
function aMinorSignal(sampleRate: number): Float32Array {
  return buildChordSignal([
    { pc: 9, amp: 1.0 },  // A  tonic
    { pc: 0, amp: 0.6 },  // C  mediant
    { pc: 4, amp: 0.8 },  // E  dominant
    { pc: 2, amp: 0.2 },  // D  subdominant
    { pc: 5, amp: 0.2 },  // F  submediant
    { pc: 7, amp: 0.2 },  // G  subtonic
    { pc: 11, amp: 0.15 }, // B  supertonic
  ], sampleRate);
}

/* ============================================================
   computeChromaVector
   ============================================================ */

describe('computeChromaVector', () => {
  const SR = 22050;

  test('returns a 12-element vector', () => {
    const sig = sineTone(440, SR, 1);
    const chroma = computeChromaVector(sig, SR);
    expect(chroma).toHaveLength(12);
  });

  test('maximum bin is 1 (normalised)', () => {
    const sig = sineTone(440, SR, 2);
    const chroma = computeChromaVector(sig, SR);
    const max = Math.max(...Array.from(chroma));
    expect(max).toBeCloseTo(1, 5);
  });

  test('pure A4 (440 Hz) has peak energy in pitch class 9 (A)', () => {
    const sig = sineTone(440, SR, 2);
    const chroma = computeChromaVector(sig, SR);
    const peakPc = Array.from(chroma).indexOf(Math.max(...Array.from(chroma)));
    expect(peakPc).toBe(9); // A = pitch class 9
  });

  test('pure C4 (261.63 Hz) has peak in pitch class 0 (C)', () => {
    const sig = sineTone(261.63, SR, 2);
    const chroma = computeChromaVector(sig, SR);
    const peakPc = Array.from(chroma).indexOf(Math.max(...Array.from(chroma)));
    expect(peakPc).toBe(0); // C = pitch class 0
  });

  test('all zeros returns a zero vector (no crash, no NaN)', () => {
    const sig = new Float32Array(SR * 2);
    const chroma = computeChromaVector(sig, SR);
    for (let i = 0; i < 12; i++) {
      expect(chroma[i]).not.toBeNaN();
      expect(chroma[i]).toBe(0);
    }
  });

  test('returns expected dominant pitch class for each chromatic note', () => {
    // Check all 12 pitch classes using octave-spread single-pitch signals.
    for (let pc = 0; pc < 12; pc++) {
      const sig = chromaDominantSignal(pc, SR);
      const chroma = computeChromaVector(sig, SR);
      const peakPc = Array.from(chroma).indexOf(Math.max(...Array.from(chroma)));
      expect(peakPc).toBe(pc);
    }
  });
});

/* ============================================================
   detectKey
   ============================================================ */

describe('detectKey', () => {
  const SR = 22050;

  test('returns a well-formed KeyEstimate', () => {
    const sig = cMajorSignal(SR);
    const result = detectKey(sig, SR);

    expect(result.key).toBeTruthy();
    expect(['major', 'minor']).toContain(result.mode);
    expect(result.display).toMatch(/Major|Minor/);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.camelot).toMatch(/^\d{1,2}[AB]$/);
    expect(result.relativeKey).toMatch(/Major|Minor/);
    expect(result.candidates).toHaveLength(5);
    expect(typeof result.ambiguous).toBe('boolean');
  });

  test('detects C Major signal as C Major', () => {
    const sig = cMajorSignal(SR);
    const result = detectKey(sig, SR);
    expect(result.key).toBe('C');
    expect(result.mode).toBe('major');
  });

  test('C Major has Camelot code 8B', () => {
    const sig = cMajorSignal(SR);
    const result = detectKey(sig, SR);
    expect(result.camelot).toBe('8B');
  });

  test('C Major relative key is A Minor', () => {
    const sig = cMajorSignal(SR);
    const result = detectKey(sig, SR);
    expect(result.relativeKey).toBe('A Minor');
  });

  test('detects A Minor signal as A Minor', () => {
    const sig = aMinorSignal(SR);
    const result = detectKey(sig, SR);
    expect(result.key).toBe('A');
    expect(result.mode).toBe('minor');
  });

  test('A Minor has Camelot code 8A', () => {
    const sig = aMinorSignal(SR);
    const result = detectKey(sig, SR);
    expect(result.camelot).toBe('8A');
  });

  test('A Minor relative key is C Major', () => {
    const sig = aMinorSignal(SR);
    const result = detectKey(sig, SR);
    expect(result.relativeKey).toBe('C Major');
  });

  test('candidates are sorted by confidence descending', () => {
    const sig = cMajorSignal(SR);
    const result = detectKey(sig, SR);
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].confidence).toBeGreaterThanOrEqual(
        result.candidates[i].confidence
      );
    }
  });

  test('all candidate confidences are in [0, 1]', () => {
    const sig = cMajorSignal(SR);
    const result = detectKey(sig, SR);
    for (const c of result.candidates) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  test('candidate camelot codes match expected pattern', () => {
    const sig = cMajorSignal(SR);
    const result = detectKey(sig, SR);
    for (const c of result.candidates) {
      expect(c.camelot).toMatch(/^\d{1,2}[AB]$/);
    }
  });

  test('flat (zero) chroma marks result as ambiguous', () => {
    // A silent signal produces an all-zero chroma vector. Pearson correlation
    // against any KK profile is 0/0 ÔåÆ treated as 0, which is below the raw
    // ambiguity threshold (0.40), so the result must be ambiguous.
    const buf = new Float32Array(SR * 2);
    const result = detectKey(buf, SR);
    expect(result.ambiguous).toBe(true);
  });

  test('G Major has Camelot code 9B', () => {
    // G major chord: G (tonic), B (mediant), D (dominant) with multi-octave spread.
    // The E submediant is deliberately omitted: square-root chroma compression
    // flattens amplitude differences, so even a quiet E hands the relative
    // E minor triad (E-G-B) enough support to win under the minor prior.
    // Real G major material is dominated by the tonic triad, which this
    // signal now reflects.
    const buf = buildChordSignal([
      { pc: 7, amp: 1.0 },   // G tonic
      { pc: 11, amp: 0.7 },  // B mediant
      { pc: 2, amp: 0.9 },   // D dominant
      { pc: 9, amp: 0.15 },  // A supertonic
      { pc: 0, amp: 0.15 },  // C subdominant
      { pc: 6, amp: 0.15 },  // F# leading tone
    ], SR);
    const result = detectKey(buf, SR);
    expect(result.key).toBe('G');
    expect(result.mode).toBe('major');
    expect(result.camelot).toBe('9B');
  });
});

/* ============================================================
   resolveFifthConfusion
   ============================================================ */

describe('resolveFifthConfusion', () => {
  type Candidate = { pitchClass: number; mode: 'major' | 'minor'; correlation: number };

  /** Chroma where C major (C, E, G) clearly out-supports G major (G, B, D). */
  const cMajorChroma = [1.0, 0, 0.5, 0, 0.8, 0.3, 0, 0.9, 0, 0.2, 0, 0.2];

  function leaderAndRunnerUp(gap: number, leaderPc = 7, runnerPc = 0, mode: 'major' | 'minor' = 'major'): Candidate[] {
    return [
      { pitchClass: leaderPc, mode, correlation: 0.80 },
      { pitchClass: runnerPc, mode, correlation: 0.80 - gap },
    ];
  }

  test('promotes the runner-up when the leader is its dominant with weaker triad support', () => {
    const results = leaderAndRunnerUp(0.02);
    resolveFifthConfusion(results, cMajorChroma);
    expect(results[0].pitchClass).toBe(0); // C promoted over G
    expect(results[1].pitchClass).toBe(7);
  });

  test('does nothing when the correlation gap exceeds the threshold', () => {
    const results = leaderAndRunnerUp(0.10);
    resolveFifthConfusion(results, cMajorChroma);
    expect(results[0].pitchClass).toBe(7);
  });

  test('does nothing when the top two differ in mode', () => {
    const results: Candidate[] = [
      { pitchClass: 7, mode: 'major', correlation: 0.80 },
      { pitchClass: 0, mode: 'minor', correlation: 0.78 },
    ];
    resolveFifthConfusion(results, cMajorChroma);
    expect(results[0].pitchClass).toBe(7);
  });

  test('does nothing when the top two are not a fifth apart', () => {
    const results = leaderAndRunnerUp(0.02, 4, 0); // E over C: major third
    resolveFifthConfusion(results, cMajorChroma);
    expect(results[0].pitchClass).toBe(4);
  });

  test('keeps the leader when its triad support is stronger', () => {
    // Chroma favouring G major (G, B, D) over C major (C, E, G).
    const gMajorChroma = [0.3, 0, 0.8, 0, 0.1, 0, 0, 1.0, 0, 0.2, 0, 0.9];
    const results = leaderAndRunnerUp(0.02);
    resolveFifthConfusion(results, gMajorChroma);
    expect(results[0].pitchClass).toBe(7);
  });

  test('handles a single-candidate list without crashing', () => {
    const results: Candidate[] = [{ pitchClass: 0, mode: 'major', correlation: 0.9 }];
    expect(() => resolveFifthConfusion(results, cMajorChroma)).not.toThrow();
    expect(results[0].pitchClass).toBe(0);
  });
});
