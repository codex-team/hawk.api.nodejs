/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/en/configuration.html
 */

module.exports = {
  testTimeout: 30000,
  /**
   * The test environment that will be used for testing
   */
  testEnvironment: 'node',

  /**
   * For testing mongodb queries
   */
  preset: '@shelf/jest-mongodb',

  /**
   * Setup file to provide global APIs needed by MongoDB driver
   */
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  /**
   * TypeScript support
   */
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  /**
   * Ignore folders
   */
  testPathIgnorePatterns: [
    '/node_modules/',
    '/integration/',
  ],
};
