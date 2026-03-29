/**
 * Unit tests for hintUtils: isCloseRatio and buildHints.
 *
 * All functions are pure TypeScript with no browser dependencies and run in
 * the Node test environment via Jest.
 */

import { isCloseRatio, buildHints } from '../hintUtils';
import type { BpmEstimate } from '@/types';

/* ============================================================
   Helpers
   ============================================================ */

/** Construct a minimal BpmEstimate for use in tests. */
function makeEstimate(overrides: Partial<BpmEstimate> = {}): BpmEstimate {
  return {
    bpm: 120,
    candidates: [
      { bpm: 120, score: 1.0 },
      { bpm: 60, score: 0.5 },
    ],
    confidence: 0.8,
    correctionRatio: undefined,
    ...overrides,
  };
}

/* ============================================================
   isCloseRatio
   ============================================================ */

describe('isCloseRatio', () => {
  test('exact match returns true', () => {
    expect(isCloseRatio(2, 2)).toBe(true);
  });

  test('within default tolerance (8%) returns true', () => {
    expect(isCloseRatio(2.15, 2)).toBe(true);   // 7.5% off
    expect(isCloseRatio(1.85, 2)).toBe(true);   // 7.5% off
  });

  test('outside default tolerance returns false', () => {
    expect(isCloseRatio(2.2, 2)).toBe(false);   // 10% off
    expect(isCloseRatio(1.8, 2)).toBe(false);   // 10% off
  });

  test('custom tolerance is applied', () => {
    expect(isCloseRatio(1.4, 4 / 3, 0.06)).toBe(true);   // 4/3 ≈ 1.333, 1.4 is ~5% off
    expect(isCloseRatio(1.45, 4 / 3, 0.06)).toBe(false);  // ~8.75% off
  });

  test('ratio of 1.0 to itself is always true', () => {
    expect(isCloseRatio(1.0, 1.0, 0)).toBe(true);
  });
});

/* ============================================================
   buildHints: no-hint conditions
   ============================================================ */

describe('buildHints: no hints', () => {
  test('returns empty array when bpm is 0', () => {
    const estimate = makeEstimate({ bpm: 0 });
    expect(buildHints(estimate, 100)).toHaveLength(0);
  });

  test('returns empty array for normal high-confidence result with plenty of beats', () => {
    const estimate = makeEstimate({
      bpm: 120,
      candidates: [{ bpm: 120, score: 1.0 }, { bpm: 119, score: 0.95 }], // ~1:1 ratio, no harmonic match
      confidence: 0.9,
    });
    expect(buildHints(estimate, 80)).toHaveLength(0);
  });

  test('ratio hints suppressed when correctionRatio is set', () => {
    // 2:1 candidates but algorithm already corrected; no hint expected.
    const estimate = makeEstimate({
      bpm: 120,
      candidates: [{ bpm: 120, score: 1 }, { bpm: 60, score: 0.8 }],
      confidence: 0.8,
      correctionRatio: 0.5,
    });
    expect(buildHints(estimate, 80)).toHaveLength(0);
  });
});

/* ============================================================
   buildHints: short clip
   ============================================================ */

describe('buildHints: short clip', () => {
  test('fires when beatCount < 30', () => {
    const hints = buildHints(makeEstimate(), 20);
    expect(hints.some((h) => h.text.includes('Short clip'))).toBe(true);
  });

  test('does not fire when beatCount === 30', () => {
    const hints = buildHints(makeEstimate(), 30);
    expect(hints.some((h) => h.text.includes('Short clip'))).toBe(false);
  });

  test('short clip hint has no URL', () => {
    const hints = buildHints(makeEstimate(), 10);
    const hint = hints.find((h) => h.text.includes('Short clip'));
    expect(hint?.url).toBeUndefined();
  });
});

/* ============================================================
   buildHints: low confidence
   ============================================================ */

describe('buildHints: low confidence', () => {
  test('fires when confidence < 0.35 and beatCount >= 30', () => {
    const estimate = makeEstimate({ confidence: 0.30, candidates: [{ bpm: 120, score: 1 }] });
    const hints = buildHints(estimate, 50);
    expect(hints.some((h) => h.text.includes('Low confidence'))).toBe(true);
  });

  test('does not fire when confidence === 0.35', () => {
    const estimate = makeEstimate({ confidence: 0.35, candidates: [{ bpm: 120, score: 1 }] });
    const hints = buildHints(estimate, 50);
    expect(hints.some((h) => h.text.includes('Low confidence'))).toBe(false);
  });

  test('does not fire when beatCount < 30 (short clip takes precedence)', () => {
    const estimate = makeEstimate({ confidence: 0.10, candidates: [{ bpm: 120, score: 1 }] });
    const hints = buildHints(estimate, 5);
    expect(hints.some((h) => h.text.includes('Low confidence'))).toBe(false);
    expect(hints.some((h) => h.text.includes('Short clip'))).toBe(true);
  });

  test('low confidence hint links to Beat_(music) Wikipedia article', () => {
    const estimate = makeEstimate({ confidence: 0.20, candidates: [{ bpm: 120, score: 1 }] });
    const hint = buildHints(estimate, 50).find((h) => h.text.includes('Low confidence'));
    expect(hint?.url).toBe('https://en.wikipedia.org/wiki/Beat_(music)');
  });
});

/* ============================================================
   buildHints: 2:1 ratio (octave)
   ============================================================ */

describe('buildHints: 2:1 ratio', () => {
  test('suggests ÷2 when winner is double the runner-up', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 120, score: 1 }, { bpm: 60, score: 0.8 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('÷2'))).toBe(true);
  });

  test('suggests ×2 when winner is half the runner-up', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 60, score: 1 }, { bpm: 120, score: 0.8 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('×2'))).toBe(true);
  });

  test('octave hint links to Tempo Wikipedia article', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 120, score: 1 }, { bpm: 60, score: 0.8 }],
    });
    const hint = buildHints(estimate, 80).find((h) => h.text.includes('÷2'));
    expect(hint?.url).toBe('https://en.wikipedia.org/wiki/Tempo');
  });
});

/* ============================================================
   buildHints: 4:3 ratio (hemiola)
   ============================================================ */

describe('buildHints: 4:3 ratio', () => {
  test('fires for candidates at a 4:3 ratio (e.g. 140 vs 105)', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 140, score: 1 }, { bpm: 105, score: 0.9 }],
      confidence: 0.5,
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('4:3'))).toBe(true);
  });

  test('4:3 hint links to Hemiola Wikipedia article', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 140, score: 1 }, { bpm: 105, score: 0.9 }],
    });
    const hint = buildHints(estimate, 80).find((h) => h.text.includes('4:3'));
    expect(hint?.url).toBe('https://en.wikipedia.org/wiki/Hemiola');
  });

  test('does not fire when ratio is outside 4:3 tolerance', () => {
    // 160 vs 100 → ratio 1.6, not close to 4/3 ≈ 1.333
    const estimate = makeEstimate({
      candidates: [{ bpm: 160, score: 1 }, { bpm: 100, score: 0.9 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('4:3'))).toBe(false);
  });
});

/* ============================================================
   buildHints: 3:2 ratio (sesquialtera / hemiola)
   ============================================================ */

describe('buildHints: 3:2 ratio', () => {
  test('fires for candidates at a 3:2 ratio (e.g. 120 vs 80)', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 120, score: 1 }, { bpm: 80, score: 0.8 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('3:2'))).toBe(true);
  });

  test('⅔ text appears when winner > runner-up', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 120, score: 1 }, { bpm: 80, score: 0.8 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('⅔'))).toBe(true);
  });

  test('1.5× text appears when winner < runner-up', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 80, score: 1 }, { bpm: 120, score: 0.8 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('1.5×'))).toBe(true);
  });

  test('3:2 hint links to Hemiola Wikipedia article', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 120, score: 1 }, { bpm: 80, score: 0.8 }],
    });
    const hint = buildHints(estimate, 80).find((h) => h.text.includes('3:2'));
    expect(hint?.url).toBe('https://en.wikipedia.org/wiki/Hemiola');
  });
});

/* ============================================================
   buildHints: 3:1 ratio (triple-tempo / waltz)
   ============================================================ */

describe('buildHints: 3:1 ratio', () => {
  test('fires for candidates at a 3:1 ratio (e.g. 180 vs 60)', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 180, score: 1 }, { bpm: 60, score: 0.7 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.toLowerCase().includes('waltz'))).toBe(true);
  });

  test('⅓ text appears when winner > runner-up', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 180, score: 1 }, { bpm: 60, score: 0.7 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('⅓'))).toBe(true);
  });

  test('3× text appears when winner < runner-up', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 60, score: 1 }, { bpm: 180, score: 0.7 }],
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.includes('3×'))).toBe(true);
  });

  test('waltz hint links to Triple_metre Wikipedia article', () => {
    const estimate = makeEstimate({
      candidates: [{ bpm: 180, score: 1 }, { bpm: 60, score: 0.7 }],
    });
    const hint = buildHints(estimate, 80).find((h) => h.text.toLowerCase().includes('waltz'));
    expect(hint?.url).toBe('https://en.wikipedia.org/wiki/Triple_metre');
  });
});

/* ============================================================
   buildHints: correctionRatio suppression
   ============================================================ */

describe('buildHints: correctionRatio suppression', () => {
  test('ratio hints not returned when correctionRatio is defined', () => {
    // 3:1 candidates but algorithm already corrected for it.
    const estimate = makeEstimate({
      bpm: 60,
      candidates: [{ bpm: 60, score: 1 }, { bpm: 180, score: 0.7 }],
      correctionRatio: 1 / 3,
    });
    const hints = buildHints(estimate, 80);
    expect(hints.some((h) => h.text.toLowerCase().includes('waltz'))).toBe(false);
  });

  test('non-ratio hints (short clip) still fire when correctionRatio is set', () => {
    const estimate = makeEstimate({
      correctionRatio: 0.5,
    });
    const hints = buildHints(estimate, 10);
    expect(hints.some((h) => h.text.includes('Short clip'))).toBe(true);
  });
});
