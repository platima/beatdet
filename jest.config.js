/**
 * Jest configuration for BeatDet.
 *
 * Uses the Next.js SWC transformer so TypeScript and the `@/*` path alias
 * are handled without a separate ts-jest setup.
 */

// @ts-check

const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  // Node environment is sufficient for the pure-function unit tests.
  testEnvironment: 'node',

  // Collect coverage from the logic-heavy lib/ directory.
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    '!src/lib/**/*.d.ts',
  ],

  // Place test files under __tests__ subdirectories.
  testMatch: ['**/__tests__/**/*.test.ts'],
};

module.exports = createJestConfig(customConfig);
