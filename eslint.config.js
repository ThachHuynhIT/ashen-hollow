import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Layers that game rules, data and core helpers must never depend on. */
const PRESENTATION = ['**/scenes/**', '**/render/**', '**/ui/**', '**/platform/**', '**/audio/**'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Rules, data and core helpers stay engine-agnostic and deterministic (spec §8.12, §12.4)
    // so they can be unit-tested, run headless and replayed bit for bit.
    files: ['src/game/**/*.ts', 'src/data/**/*.ts', 'src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'game/, data/ and core/ must stay engine-agnostic.' }],
          patterns: [
            {
              group: PRESENTATION,
              message: 'game/, data/ and core/ must not depend on presentation or platform code.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        ...['random', 'hypot', 'sin', 'cos', 'tan', 'atan2', 'exp', 'log', 'pow'].map(
          (property) => ({
            object: 'Math',
            property,
            message: 'Non-deterministic or engine-dependent; see spec §8.12.',
          }),
        ),
        { object: 'Date', property: 'now', message: 'Wall-clock time is non-deterministic.' },
        {
          object: 'performance',
          property: 'now',
          message: 'Wall-clock time is non-deterministic.',
        },
      ],
    },
  },
  {
    // Data is plain values and types: it must not import rules either.
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'data/ must stay engine-agnostic.' }],
          patterns: [
            {
              group: ['**/game/**', ...PRESENTATION],
              message:
                'data/ holds only values and types; it must not import rules or presentation.',
            },
          ],
        },
      ],
    },
  },
);
