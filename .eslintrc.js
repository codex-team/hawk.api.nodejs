module.exports = {
  extends: ['codex'],
  env: {
    'node': true,
    'jest': true
  },
  globals: {
    /**
     * TODO: bump ESLint because its current Node environment is missing required globals
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
