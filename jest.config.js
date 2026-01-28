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
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'test/tsconfig.json',
    }],
  },

  /**
   * Map node: prefixed imports to mock files
   * Jest 27 supports node: prefix for ESM imports, but CommonJS require('node:crypto')
   * in modules like argon2.cjs still needs explicit mapping to mocks
   */
  moduleNameMapper: {
    '^node:crypto$': '<rootDir>/test/__mocks__/node_crypto.js',
    '^node:util$': '<rootDir>/test/__mocks__/node_util.js',
  },

  /**
   * Ignore folders
   */
  testPathIgnorePatterns: [
    '/node_modules/',
    '/integration/',
  ],
};
