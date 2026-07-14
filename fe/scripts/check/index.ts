import { availableParallelism } from 'node:os';
import {
  discoverFormatFiles,
  discoverLintFiles,
  discoverSourceFiles,
  splitFileChunks
} from './discover';
import { printBanner, printResults } from './reporter';
import { runTasks } from './runner';
import {
  buildEslintTasks,
  buildPrettierTasks,
  buildStaticTasks
} from './tasks';
import type { CheckMode, TaskResult } from './types';

function readMode(value: string | undefined): CheckMode {
  if (value === undefined || value === 'check') {
    return 'check';
  }

  if (value === 'fix') {
    return 'fix';
  }

  throw new Error('Usage: bun scripts/check/index.ts [check|fix]');
}

function fileWorkerCount(fileCount: number): number {
  if (fileCount === 0) {
    return 0;
  }

  const cpuCount = availableParallelism();

  return Math.min(
    fileCount,
    Math.max(1, Math.min(6, Math.floor(cpuCount / 3)))
  );
}

async function main(): Promise<void> {
  const mode = readMode(process.argv[2]);
  const [formatFiles, lintFiles, sourceFiles] = await Promise.all([
    discoverFormatFiles(),
    discoverLintFiles(),
    discoverSourceFiles()
  ]);
  const lintChunks = splitFileChunks(
    lintFiles,
    fileWorkerCount(lintFiles.length)
  );
  const formatChunks = splitFileChunks(
    formatFiles,
    fileWorkerCount(formatFiles.length)
  );
  const fileCounts = {
    format: formatFiles.length,
    lint: lintFiles.length,
    source: sourceFiles.length
  };

  if (mode === 'fix') {
    const prettierTasks = buildPrettierTasks(formatChunks, true);
    const eslintTasks = buildEslintTasks(lintChunks, true);
    const finalPrettierTasks = buildPrettierTasks(formatChunks, true).map(
      (task) => ({
        ...task,
        group: 'prettier-final',
        label: task.label.replace('prettier', 'prettier final')
      })
    );
    const fixTasks = [...prettierTasks, ...eslintTasks, ...finalPrettierTasks];
    const fixResults: TaskResult[] = [];
    const start = performance.now();
    printBanner(mode, fixTasks, fileCounts);
    const prettierResults = await runTasks(prettierTasks);
    fixResults.push(...prettierResults);

    if (prettierResults.some((result) => result.exitCode !== 0)) {
      printResults(fixResults, Math.round(performance.now() - start));
      process.exitCode = 1;

      return;
    }

    const eslintResults = await runTasks(eslintTasks);
    fixResults.push(...eslintResults);

    if (eslintResults.some((result) => result.exitCode !== 0)) {
      printResults(fixResults, Math.round(performance.now() - start));
      process.exitCode = 1;

      return;
    }

    fixResults.push(...(await runTasks(finalPrettierTasks)));
    const failures = printResults(
      fixResults,
      Math.round(performance.now() - start)
    );

    if (failures.length > 0) {
      process.exitCode = 1;

      return;
    }

    console.log('\nVerifying the repaired tree...');
  }

  const tasks = [
    ...buildEslintTasks(lintChunks, false),
    ...buildPrettierTasks(formatChunks, false),
    ...buildStaticTasks()
  ];
  const start = performance.now();
  printBanner('check', tasks, fileCounts);
  const results: TaskResult[] = await runTasks(tasks);
  const failures = printResults(results, Math.round(performance.now() - start));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Checker failed to start: ${message}`);
  process.exitCode = 1;
}
