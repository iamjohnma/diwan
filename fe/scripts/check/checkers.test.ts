import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';

interface ToolResult {
  exitCode: number;
  output: string;
}

const fixtureDirectories: string[] = [];
const toolsDirectory = join(import.meta.dir, 'tools');

function writeFixture(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'law-checker-'));
  fixtureDirectories.push(directory);
  const tsconfig = {
    compilerOptions: {
      jsx: 'react-jsx',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      paths: {
        '@/*': ['./src/*']
      },
      strict: true,
      target: 'ES2022'
    },
    include: ['src']
  };

  writeFileSync(
    join(directory, 'tsconfig.json'),
    `${JSON.stringify(tsconfig, null, 2)}\n`
  );

  for (const [path, content] of Object.entries(files)) {
    const target = join(directory, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }

  return directory;
}

async function runTool(
  tool: 'architecture.ts' | 'unused-exports.ts',
  files: Record<string, string>
): Promise<ToolResult> {
  const cwd = writeFixture(files);
  const child = Bun.spawn([process.execPath, join(toolsDirectory, tool)], {
    cwd,
    env: { ...process.env, NO_COLOR: '1' },
    stderr: 'pipe',
    stdout: 'pipe'
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);

  return {
    exitCode,
    output: `${stdout}${stderr}`
  };
}

afterAll(() => {
  for (const directory of fixtureDirectories) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('architecture checker', () => {
  test('accepts Vite asset imports and arithmetic class helpers', async () => {
    const result = await runTool('architecture.ts', {
      'src/assets/logo.svg': '<svg />',
      'src/main.tsx': `
        import logo from '@/assets/logo.svg?url';
        import '@/styles/app.css';

        function pick(value: number) {
          return String(value);
        }

        const width = 1;
        const gap = 2;
        const view = <div className={pick(width + gap)} data-logo={logo} />;
        void view;
      `,
      'src/styles/app.css': ':root {}'
    });

    expect(result).toEqual({ exitCode: 0, output: expect.any(String) });
  });

  test('detects variants, multiple arbitrary values, and composition', async () => {
    const result = await runTool('architecture.ts', {
      'src/BadProbe.tsx': `
        const spacing = 2;
        const view = (
          <div className={\`sm:w-[13px] md:h-[.5rem] p-\${spacing}\`} />
        );
        void view;
      `,
      'src/main.tsx': 'export {};'
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('filename-kebab-case');
    expect(result.output).toContain('class-name-composition');
    expect(result.output).toContain('sm:w-[13px]');
    expect(result.output).toContain('md:h-[.5rem]');
  });
});

describe('dead-code checker', () => {
  test('propagates named demand through a barrel', async () => {
    const result = await runTool('unused-exports.ts', {
      'src/feature/index.ts': "export { Unused, Used } from './values';\n",
      'src/feature/values.ts':
        'export const Used = 1;\nexport const Unused = 2;\n',
      'src/main.ts': "import { Used } from '@/feature';\nconsole.log(Used);\n"
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Unused');
    expect(result.output).not.toMatch(/— Used(?:\n|$)/);
  });

  test('does not let a dead importer shield another dead file', async () => {
    const result = await runTool('unused-exports.ts', {
      'src/dead-consumer.ts':
        "import { LiveOnlyInDeadCode } from '@/orphan';\nvoid LiveOnlyInDeadCode;\n",
      'src/main.ts': 'export {};\n',
      'src/orphan.ts': 'export const LiveOnlyInDeadCode = true;\n'
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('dead-files (2)');
    expect(result.output).toContain('src/dead-consumer.ts');
    expect(result.output).toContain('src/orphan.ts');
  });

  test('recognizes an inline import type as symbol usage', async () => {
    const result = await runTool('unused-exports.ts', {
      'src/main.ts': `
        type CaseRecord = import('@/types').CaseRecord;
        const record: CaseRecord = { id: 'case-1' };
        console.log(record);
      `,
      'src/types.ts': 'export interface CaseRecord { id: string }\n'
    });

    expect(result).toEqual({ exitCode: 0, output: expect.any(String) });
  });
});
