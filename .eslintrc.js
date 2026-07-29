module.exports = {
  extends: ['codex'],
  env: {
    'node': true,
    'jest': true
  },
  globals: {
    /**
     * Global since Node 18 (this project runs Node 24 per .nvmrc), but not part of
     * eslint's "node" env, which predates the WHATWG Streams API
     */
    'TransformStream': 'readonly'
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
