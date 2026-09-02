import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Vindeshi Express ESLint configuration.
 *
 * Two entries here hold invariants rather than style:
 *
 *   - `vindeshi/no-any-in-src` makes `@typescript-eslint/no-explicit-any` an error in
 *     `src/`. Phase 0 exit criterion: "Zero `any` in `src/`; lint rule enforces it."
 *   - `vindeshi/renderer-import-boundary` keeps `src/renderer/**` from importing seed,
 *     content or destination modules. The renderer does not exist until Phase 4; the rule
 *     is armed now so the boundary is enforced the moment it does (CLAUDE.md §6 invariant
 *     24, Test.md test 24c). tests/architecture/renderer-import-boundary.test.ts proves the
 *     rule actually fires rather than sitting inert.
 *
 * Next's rules are wired from `@next/eslint-plugin-next` directly rather than through
 * `eslint-config-next`, because that shared config replaces the parser project-wide and
 * would disable every type-aware rule.
 */
export const RENDERER_BOUNDARY_CONFIG_NAME = 'vindeshi/renderer-import-boundary'

/** Module groups the route renderer may never depend on (CLAUDE.md §6 invariant 24). */
export const RENDERER_FORBIDDEN_IMPORT_GROUPS = ['seed', 'content', 'destinations']

const rendererForbiddenPatterns = RENDERER_FORBIDDEN_IMPORT_GROUPS.flatMap((group) => [
  `@/${group}`,
  `@/${group}/*`,
  `@/${group}/**`,
  `**/${group}`,
  `**/${group}/*`,
  `**/${group}/**`,
])

const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts']

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'src/generated/**',
    ],
  },

  js.configs.recommended,

  {
    name: 'vindeshi/typescript',
    files: TS_FILES,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Object keys must be unquoted where possible. The enum single-source test matches
      // quoted string literals, so unquoted keys keep type-checked label maps (which are
      // exhaustive by construction) from reading as duplicated literals.
      'quote-props': ['error', 'as-needed'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            'Do not declare TypeScript enums. Domain enumerations live in src/domain/enums.ts as const arrays (CLAUDE.md §9).',
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    name: 'vindeshi/next',
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },

  {
    name: 'vindeshi/no-any-in-src',
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    name: RENDERER_BOUNDARY_CONFIG_NAME,
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: rendererForbiddenPatterns,
              message:
                'CLAUDE.md §6 invariant 24: the route renderer must be route-agnostic. It may not import seed, content or destination modules — if a route needs special rendering, the renderer is wrong.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'vindeshi/config-and-tooling',
    files: ['**/*.mjs', '**/*.js', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
)
