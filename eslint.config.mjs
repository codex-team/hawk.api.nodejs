import CodeX from 'eslint-config-codex';

export default [
  ...CodeX,

  {
    rules: {
      /**
       * Downgraded in .eslintrc.js, kept that way here.
       */
      'no-shadow': 'warn',
      'no-unused-expressions': 'warn',

      /**
       * Resolves imports as Node does and never looks for .ts.
       */
      'n/no-missing-import': 'off',

      /**
       * Demand require('process') and require('buffer') over the globals.
       */
      'n/prefer-global/process': 'off',
      'n/prefer-global/buffer': 'off',
    },
  },

  {
    /**
     * CodeX registers @typescript-eslint and jsdoc for *.ts only, and resolves
     * tsconfigRootDir inside its own package.
     */
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    rules: {
      /**
       * Downgraded in .eslintrc.js, kept that way here. `jsdoc/require-jsdoc`
       * replaces the removed core `require-jsdoc`.
       */
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'jsdoc/require-jsdoc': 'warn',
    },
  },
];
