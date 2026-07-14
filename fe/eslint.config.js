import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { rules as customRules } from './scripts/tooling/eslint-custom-rules/index.js';

const reactHooksRecommended =
  reactHooks.configs.flat?.recommended?.rules ??
  reactHooks.configs.recommended.rules;

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'src/routeTree.gen.ts',
      'src/@types/generated/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    plugins: {
      local: { rules: customRules },
      'unused-imports': unusedImports
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: false,
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'local/no-placeholder-comments': 'error',
      'no-duplicate-imports': [
        'error',
        { allowSeparateTypeImports: true, includeExports: true }
      ],
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooksRecommended,
      'local/hook-variable-naming': 'error',
      'local/no-default-export': 'error',
      'local/no-destructured-hook-return': 'error',
      'local/no-destructured-props': 'error',
      'local/no-hardcoded-permissions': 'error',
      'local/no-ltr-tailwind': 'error',
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'react/jsx-newline': ['error', { allowMultilines: false, prevent: true }],
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/self-closing-comp': 'error',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/exhaustive-deps': 'off'
    },
    settings: {
      react: {
        version: '19.2'
      }
    }
  },
  {
    files: ['src/**/*.{jsx,tsx}'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          allowedStrings: [
            ' ',
            '#',
            '%',
            '(',
            ')',
            '*',
            '+',
            ',',
            '-',
            '.',
            '/',
            ':',
            '...',
            'â€¢',
            '|'
          ],
          ignoreProps: true,
          noStrings: true
        }
      ]
    }
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}', '*.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.bun,
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off'
    }
  },
  eslintConfigPrettier,
  {
    files: ['src/main.tsx'],
    rules: {
      'react/jsx-no-literals': 'off'
    }
  },
  {
    files: [
      '*.config.{js,mjs,ts}',
      'eslint.config.js',
      'prettier.config.js',
      'vite.config.ts',
      'scripts/tooling/**/*.js'
    ],
    rules: {
      'local/no-default-export': 'off'
    }
  },
  {
    files: [
      'src/components/ui/select.tsx',
      'src/components/ui/popover.tsx',
      'src/components/ui/combobox.tsx',
      'src/components/ui/menu.tsx',
      'src/components/ui/input-combobox.tsx',
      'src/components/ui/input-combobox-multi-select.tsx',
      'src/components/ui/search-field.tsx',
      'src/components/ui/dynamic-popover/**/*.{ts,tsx}'
    ],
    rules: {
      // Naab overlay primitives destructure local hooks inline; keep source
      // parity rather than rewriting thousands of lines for Law naming rules.
      'local/no-destructured-hook-return': 'off',
      'local/hook-variable-naming': 'off'
    }
  },
  {
    files: ['src/**/*.d.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      'local/no-default-export': 'off'
    }
  }
);
