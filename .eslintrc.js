module.exports = {
  env: {
    es6: true,
    node: true
  },
  extends: ['eslint:recommended', 'codex'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  rules: {
    'no-console-log': 'off'
  }
};
