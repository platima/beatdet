/**
 * Jest configuration for BeatDet.
 *
 * Uses the Next.js SWC transformer so TypeScript and the `@/*` path alias
 * are handled without a separate ts-jest setup.
 */

// @ts-check

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  // Node environment is sufficient for the pure-function unit tests.
  testEnvironment: 'node',

  // Disable the Jest 30 globals cleanup pass.  Node 25 exposes `localStorage`
  // as a built-in global (backed by --localstorage-file); when Jest's teardown
  // iterates global keys to clean them up it touches the getter, which emits a
  // spurious "localstorage-file was provided without a valid path" warning.
  // We run in a Node environment and have no browser globals to clean up.
  testEnvironmentOptions: {
    globalsCleanup: 'off',
  },

  // Collect coverage from the logic-heavy lib/ directory.
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    '!src/lib/**/*.d.ts',
  ],

  // Place test files under __tests__ subdirectories.
  testMatch: ['**/__tests__/**/*.test.ts'],
};

module.exports = createJestConfig(customConfig);
