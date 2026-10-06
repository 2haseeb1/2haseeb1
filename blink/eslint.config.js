// Flat ESLint config. `expo lint` scaffolds this file automatically; it is
// committed so CI and local runs enforce exactly the same rules.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Build output and dependencies are never linted. `web-build` is the static
    // export from `npm run build:web` — minified output fails every stylistic rule.
    ignores: ['node_modules/**', 'dist/**', 'web-build/**'],
  },
  {
    // The static preview server runs in Node, not in the app.
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'writable',
        console: 'readonly',
      },
    },
  },
  {
    files: [
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
      'jest.setup.js',
    ],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
]);
