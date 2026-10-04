import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    ignores: ['dist/', 'node_modules/', '.obsidian/', '*.config.js', '*.config.ts'],
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.base.json', './packages/*/tsconfig.json', './client/tsconfig.json', './server/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-unresolved': 'error',
      'import/order': ['error', { 'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'], 'alphabetize': { order: 'asc' } }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    },
  },
  {
    files: ['client/**/*.ts', 'client/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@raaz/shared-schemas/internal', '@raaz/shared-schemas/internal/*'],
              message: 'Client cannot import server-only schemas from @raaz/shared-schemas/internal. Use the client-safe exports from @raaz/shared-schemas instead.',
            },
            {
              group: ['server/**', '../server/**', '../../server/**'],
              message: 'Client cannot import from server. Shared code belongs in @raaz/shared-schemas.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['client/**', '../client/**', '../../client/**'],
              message: 'Server cannot import from client.',
            },
          ],
        },
      ],
    },
  }
);