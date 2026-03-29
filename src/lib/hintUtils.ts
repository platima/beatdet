/**
 * hintUtils: derives contextual detection hints from a BPM estimate.
 *
 * Extracted from BpmDisplay so the logic can be unit tested independently of
 * the React rendering layer.
 */

import type { BpmEstimate } from '@/types';

/** A detection hint with optional Wikipedia "more info" link. */
export interface Hint {
  text: string;
  url?: string;
}

/**
 * Check if a ratio is within a fractional tolerance of a target value.
 * Uses relative tolerance: |ratio - target| / target <= tol.
 */
export function isCloseRatio(ratio: number, target: number, tol = 0.08): boolean {
  return Math.abs(ratio - target) / target <= tol;
}

/**
 * Derive contextual hints from a BPM estimate to surface common detection
 * edge cases: octave errors, 4:3 ratio ambiguity, low confidence, and
 * short-clip warnings. Each hint may carry a Wikipedia URL for users who
 * want to understand the underlying phenomenon.
 *
 * Ratio hints are suppressed when the algorithm already auto-corrected the
 * same ratio (`correctionRatio` is set on the estimate), to avoid giving
 * contradictory advice.
 *
 * @param bpmEstimate  Result from `estimateBpm`.
 * @param beatCount    Number of beats detected (used for short-clip check).
 */
export function buildHints(bpmEstimate: BpmEstimate, beatCount: number): Hint[] {
  const hints: Hint[] = [];
  const { bpm, candidates, confidence, correctionRatio } = bpmEstimate;
  if (bpm === 0) return hints;

  // Short clip: fewer beats reduce IOI statistics reliability.
  if (beatCount < 30) {
    hints.push({ text: 'Short clip: accuracy improves with longer audio (30 s+).' });
  }

  // Low overall confidence with sufficient data: sparse or ambiguous texture.
  if (confidence < 0.35 && beatCount >= 30) {
    hints.push({
      text: 'Low confidence: this track may lack a strong, regular beat.',
      url: 'https://en.wikipedia.org/wiki/Beat_(music)',
    });
  }

  // Harmonic ratio hints between winner and runner-up. Skipped when the
  // algorithm already applied a correction for the same ratio.
  if (candidates.length >= 2 && correctionRatio === undefined) {
    const a = candidates[0].bpm;
    const b = candidates[1].bpm;
    const ratio = Math.max(a, b) / Math.min(a, b);

    if (isCloseRatio(ratio, 2)) {
      hints.push(
        a > b
          ? {
              text: 'If this feels fast, try the ÷2 button. A half-tempo candidate was also detected.',
              url: 'https://en.wikipedia.org/wiki/Tempo',
            }
          : {
              text: 'If this feels slow, try the ×2 button. A double-tempo candidate was also detected.',
              url: 'https://en.wikipedia.org/wiki/Tempo',
            },
      );
    } else if (isCloseRatio(ratio, 4 / 3, 0.06)) {
      hints.push({
        text: 'Uncertain result: candidates at a 4:3 ratio were detected. The true tempo may be ¾ of this value.',
        url: 'https://en.wikipedia.org/wiki/Hemiola',
      });
    } else if (isCloseRatio(ratio, 3 / 2, 0.07)) {
      hints.push(
        a > b
          ? {
              text: 'A 3:2 ratio candidate was detected; the true tempo may be ⅔ of this value.',
              url: 'https://en.wikipedia.org/wiki/Hemiola',
            }
          : {
              text: 'A 3:2 ratio candidate was detected; the true tempo may be 1.5× this value.',
              url: 'https://en.wikipedia.org/wiki/Hemiola',
            },
      );
    } else if (isCloseRatio(ratio, 3, 0.10)) {
      hints.push(
        a > b
          ? {
              text: 'Waltz or 3/4 feel? A candidate at ⅓ of this value was also detected; the true tempo may be lower.',
              url: 'https://en.wikipedia.org/wiki/Triple_metre',
            }
          : {
              text: 'Waltz or 3/4 feel? The true tempo may be 3× this value.',
              url: 'https://en.wikipedia.org/wiki/Triple_metre',
            },
      );
    }
  }

  return hints;
}
