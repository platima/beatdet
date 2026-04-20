/* eslint-disable @typescript-eslint/no-require-imports */
const {
  classifyKeyMiss,
  classifyTempoResult,
  sortedCounts,
} = require('../../../autoresearch/benchmarkShared.cjs');

describe('autoresearch benchmark shared helpers', () => {
  it('classifies tempo hits within tolerance as correct', () => {
    expect(classifyTempoResult(101.5, 100)).toEqual(
      expect.objectContaining({ verdict: 'correct', detail: 'correct' }),
    );
  });

  it('classifies double-tempo octave errors', () => {
    expect(classifyTempoResult(200, 100)).toEqual(
      expect.objectContaining({ verdict: 'octave', detail: 'double' }),
    );
  });

  it('classifies half-tempo octave errors', () => {
    expect(classifyTempoResult(50, 100)).toEqual(
      expect.objectContaining({ verdict: 'octave', detail: 'half' }),
    );
  });

  it('classifies non-octave slow and fast tempo misses', () => {
    expect(classifyTempoResult(82, 100)).toEqual(
      expect.objectContaining({ verdict: 'wrong', detail: 'slow' }),
    );
    expect(classifyTempoResult(123, 100)).toEqual(
      expect.objectContaining({ verdict: 'wrong', detail: 'fast' }),
    );
  });

  it('classifies key misses by proximity and miss shape', () => {
    expect(
      classifyKeyMiss(
        { note: 'A', mode: 'minor' },
        { note: 'A', mode: 'major' },
        1,
      ),
    ).toEqual({ proximity: 'close', shape: 'same-root mode flip' });

    expect(
      classifyKeyMiss(
        { note: 'A', mode: 'minor' },
        { note: 'C', mode: 'major' },
        2,
      ),
    ).toEqual({ proximity: 'far', shape: 'cross-root mode flip' });

    expect(
      classifyKeyMiss(
        { note: 'A', mode: 'minor' },
        { note: 'G', mode: 'minor' },
        2,
      ),
    ).toEqual({ proximity: 'far', shape: 'same-mode wrong root' });
  });

  it('sorts count maps by descending count then label', () => {
    const counts = new Map<string, number>([
      ['b item', 2],
      ['a item', 2],
      ['z item', 1],
    ]);

    expect(sortedCounts(counts)).toEqual([
      ['a item', 2],
      ['b item', 2],
      ['z item', 1],
    ]);
  });
});