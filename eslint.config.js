import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Layers that game rules, data and core helpers must never depend on. */
const PRESENTATION = ['**/scenes/**', '**/render/**', '**/ui/**', '**/platform/**', '**/audio/**'];

// imul is exact 32-bit integer math (the RNG and hash functions need it), hence allowed beyond §8.12's list.
const ALLOWED_MATH = 'sqrt|floor|ceil|round|min|max|abs|imul';
const ALLOWED_MATH_LIST = ALLOWED_MATH.replaceAll('|', ',');
const GLOBAL_OBJECTS = 'globalThis|window|self';
const NON_DETERMINISTIC_GLOBALS = 'Math|performance|Date|crypto';

/** Determinism bans that no-restricted-properties cannot express (spec §8.12). */
const DETERMINISM_SYNTAX = [
  [
    `MemberExpression[object.name='Math'][computed=false]:not([property.name=/^(${ALLOWED_MATH})$/])`,
    `Only Math.{${ALLOWED_MATH_LIST}} are allowed (spec §8.12).`,
  ],
  [
    `MemberExpression[object.name='Math'][computed=true]:not([property.type='Literal'][property.value=/^(${ALLOWED_MATH})$/])`,
    `Only Math.{${ALLOWED_MATH_LIST}} are allowed (spec §8.12).`,
  ],
  [
    ":not(MemberExpression[object.name='Math']) > Identifier[name='Math']",
    'Do not alias or destructure Math; call the allowed members directly (spec §8.12).',
  ],
  ["BinaryExpression[operator='**']", 'The ** operator is engine-dependent; multiply instead.'],
  [
    "AssignmentExpression[operator='**=']",
    'The **= operator is engine-dependent; multiply instead.',
  ],
  ["NewExpression[callee.name='Date']", 'Wall-clock time is non-deterministic.'],
  ["CallExpression[callee.name='Date']", 'Wall-clock time is non-deterministic.'],
  ["MemberExpression[object.name='Date']", 'Wall-clock time is non-deterministic.'],
  ["MemberExpression[object.name='performance']", 'Wall-clock time is non-deterministic.'],
  [
    `MemberExpression[object.name=/^(${GLOBAL_OBJECTS})$/][property.name=/^(${NON_DETERMINISTIC_GLOBALS})$/]`,
    'Reaching non-deterministic globals through the global object is forbidden.',
  ],
  [
    "Identifier[name='crypto']:not(MemberExpression[computed=false] > Identifier.property)",
    'crypto is non-deterministic.',
  ],
  ['ImportExpression', 'Dynamic import() would bypass the layering rules.'],
].map(([selector, message]) => ({ selector, message }));

const phaserPaths = (who) => [{ name: 'phaser', message: `${who} must stay engine-agnostic.` }];
const phaserPatterns = (who) => ({
  group: ['phaser', 'phaser/**'],
  message: `${who} must stay engine-agnostic.`,
});

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
          paths: phaserPaths('game/, data/ and core/'),
          patterns: [
            phaserPatterns('game/, data/ and core/'),
            {
              group: PRESENTATION,
              message: 'game/, data/ and core/ must not depend on presentation or platform code.',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', ...DETERMINISM_SYNTAX],
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
          paths: phaserPaths('data/'),
          patterns: [
            phaserPatterns('data/'),
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
  {
    // Core is the lowest layer: it may not reach into game rules either.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: phaserPaths('core/'),
          patterns: [
            phaserPatterns('core/'),
            {
              group: ['**/game/**', ...PRESENTATION],
              message: 'core/ is the lowest layer; it must not import game rules or presentation.',
            },
          ],
        },
      ],
    },
  },
);
