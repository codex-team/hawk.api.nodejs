module.exports = {
  extends: ['codex'],
  env: {
    'node': true,
    'jest': true
  },
  rules: {
    '@typescript-eslint/camelcase': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'require-jsdoc': 'warn',
    'no-shadow': 'warn',
    'no-unused-expressions': 'warn'
  }
};
