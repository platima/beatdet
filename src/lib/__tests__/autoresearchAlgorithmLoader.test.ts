/* eslint-disable @typescript-eslint/no-require-imports */
const {
  resolveAlgorithmPath,
} = require('../../../autoresearch/algorithmLoader.cjs');

describe('autoresearch algorithm loader', () => {
  it('resolves the default algorithm path from the workspace root', () => {
    expect(resolveAlgorithmPath(undefined, 'D:/Repos/beatdet')).toBe(
      'D:\\Repos\\beatdet\\autoresearch\\algorithm.mjs',
    );
  });

  it('preserves absolute paths', () => {
    expect(resolveAlgorithmPath('D:/temp/foo.mjs', 'D:/Repos/beatdet')).toBe('D:/temp/foo.mjs');
  });

  it('resolves relative candidate paths from the provided base directory', () => {
    expect(resolveAlgorithmPath('autoresearch/candidates/foo.mjs', 'D:/Repos/beatdet')).toBe(
      'D:\\Repos\\beatdet\\autoresearch\\candidates\\foo.mjs',
    );
  });
});