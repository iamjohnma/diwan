import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execPath } from 'node:process';
import type { Task } from './types';

function findNodeModules(startDirectory: string): string {
  let directory = resolve(startDirectory);

  while (true) {
    const candidate = join(directory, 'node_modules');
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not find node_modules from ${startDirectory}.`);
    }

    directory = parent;
  }
}

const nodeModules = findNodeModules('.');
const eslintBin = join(nodeModules, 'eslint/bin/eslint.js');
const prettierBin = join(nodeModules, 'prettier/bin/prettier.cjs');
const tscBin = join(nodeModules, 'typescript/bin/tsc');
const eslintCacheDirectory = join(nodeModules, '.cache/law-eslint');

function toolingFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);

      return entry.isDirectory() ? toolingFiles(path) : [path];
    })
    .sort();
}

function eslintCacheKey(): string {
  const hash = createHash('sha256');
  const files = [
    'eslint.config.js',
    'package.json',
    ...toolingFiles('scripts/tooling/eslint-custom-rules')
  ];

  for (const file of files) {
    hash.update(file);
    hash.update(readFileSync(file));
  }

  return hash.digest('hex').slice(0, 12);
}

const cacheKey = eslintCacheKey();

function label(prefix: string, index: number, total: number): string {
  return total === 1 ? prefix : `${prefix} [${index + 1}/${total}]`;
}

export function buildEslintTasks(
  chunks: readonly string[][],
  fix: boolean
): Task[] {
  return chunks.map((files, index) => ({
    command: [
      execPath,
      eslintBin,
      '--cache',
      '--cache-location',
      join(eslintCacheDirectory, cacheKey, `.eslintcache.${index}`),
      '--cache-strategy',
      'content',
      '--max-warnings',
      '0',
      '--no-warn-ignored',
      ...(fix ? ['--fix'] : []),
      ...files
    ],
    group: 'eslint',
    label: label('eslint', index, chunks.length)
  }));
}

export function buildPrettierTasks(
  chunks: readonly string[][],
  fix: boolean
): Task[] {
  return chunks.map((files, index) => ({
    command: [
      execPath,
      prettierBin,
      fix ? '--write' : '--check',
      '--ignore-unknown',
      '--no-error-on-unmatched-pattern',
      ...files
    ],
    group: 'prettier',
    label: label('prettier', index, chunks.length)
  }));
}

export function buildStaticTasks(): Task[] {
  return [
    {
      command: [
        execPath,
        tscBin,
        '-p',
        'tsconfig.json',
        '--noEmit',
        '--pretty'
      ],
      group: 'tsc',
      label: 'tsc app'
    },
    {
      command: [
        execPath,
        tscBin,
        '-p',
        'tsconfig.tools.json',
        '--noEmit',
        '--pretty'
      ],
      group: 'tsc',
      label: 'tsc tooling'
    },
    {
      command: [execPath, 'scripts/check/tools/architecture.ts'],
      group: 'architecture',
      label: 'architecture'
    },
    {
      command: [execPath, 'scripts/check/tools/enforce-i18n.ts'],
      group: 'i18n',
      label: 'i18n'
    },
    {
      command: [execPath, 'scripts/check/tools/unused-exports.ts'],
      group: 'dead-code',
      label: 'dead-code'
    }
  ];
}
