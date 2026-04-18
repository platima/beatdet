/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Resolve and load an autoresearch algorithm module.
 *
 * Supports either:
 * - `AUTORESEARCH_ALGORITHM=path/to/file.mjs`
 * - `node autoresearch/benchmark-*.mjs path/to/file.mjs`
 *
 * Relative paths are resolved from the current working directory.
 */

const { isAbsolute, resolve } = require('path');
const { pathToFileURL } = require('url');

function resolveAlgorithmPath(specifier = process.argv[2] ?? process.env.AUTORESEARCH_ALGORITHM ?? 'autoresearch/algorithm.mjs', baseDir = process.cwd()) {
  return isAbsolute(specifier) ? specifier : resolve(baseDir, specifier);
}

async function loadAlgorithmModule(baseDir = process.cwd(), specifier) {
  const algorithmPath = resolveAlgorithmPath(specifier, baseDir);
  const algorithmModule = await import(pathToFileURL(algorithmPath).href);
  return { algorithmPath, algorithmModule };
}

module.exports = {
  loadAlgorithmModule,
  resolveAlgorithmPath,
};