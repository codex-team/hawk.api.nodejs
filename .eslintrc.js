module.exports = {
  extends: ['codex'],
  env: {
    'node': true,
    'jest': true
  },
  globals: {
    /**
     * TODO: bump eslint since it's current env uses older "node" version which missing required global types
     */
    'AbortController': 'readonly'
  },
  rules: {
    '@typescript-eslint/camelcase': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'require-jsdoc': 'warn',
    'no-shadow': 'warn',
    'no-unused-expressions': 'warn'
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off'
      }
    }
  ]
};
