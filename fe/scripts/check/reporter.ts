import { COLORS } from './constants';
import type { CheckMode, Task, TaskResult } from './types';

function formatDuration(milliseconds: number): string {
  return milliseconds >= 1_000
    ? `${(milliseconds / 1_000).toFixed(1)}s`
    : `${milliseconds}ms`;
}

function orderedGroups(results: readonly TaskResult[]): string[] {
  return [...new Set(results.map((result) => result.group))];
}

function printOutput(result: TaskResult): void {
  const output = `${result.stdout}${result.stderr}`.trim();

  if (output !== '') {
    console.log(output);
  }
}

export function printBanner(
  mode: CheckMode,
  tasks: readonly Task[],
  fileCounts: { format: number; lint: number; source: number }
): void {
  const action = mode === 'fix' ? 'Repairing' : 'Checking';

  console.log(
    `\n${COLORS.bold}${action} Diwan frontend${COLORS.reset} ` +
      `${COLORS.dim}(${tasks.length} tasks, ${fileCounts.lint} lint / ` +
      `${fileCounts.format} format / ${fileCounts.source} source files)${COLORS.reset}\n`
  );
}

export function printResults(
  results: readonly TaskResult[],
  wallTimeMs: number
): TaskResult[] {
  const failures: TaskResult[] = [];

  for (const group of orderedGroups(results)) {
    const groupResults = results.filter((result) => result.group === group);
    const groupFailures = groupResults.filter(
      (result) => result.exitCode !== 0
    );
    const groupWallTime = Math.max(
      ...groupResults.map((result) => result.durationMs)
    );
    const passed = groupResults.length - groupFailures.length;
    const state =
      groupFailures.length === 0 ? `${COLORS.green}OK` : `${COLORS.red}FAIL`;
    const workerSummary =
      groupResults.length === 1
        ? ''
        : ` ${passed}/${groupResults.length} workers,`;

    console.log(
      `  ${state}${COLORS.reset} ${COLORS.cyan}${group}${COLORS.reset}` +
        `${COLORS.dim}${workerSummary} ${formatDuration(groupWallTime)}${COLORS.reset}`
    );

    for (const result of groupResults) {
      if (result.exitCode !== 0 || result.showOutputOnSuccess === true) {
        printOutput(result);
      }
    }

    failures.push(...groupFailures);
  }

  const sequentialTime = results.reduce(
    (total, result) => total + result.durationMs,
    0
  );
  const savedTime = Math.max(0, sequentialTime - wallTimeMs);

  console.log(
    `\n${COLORS.dim}total ${formatDuration(wallTimeMs)} · ` +
      `saved ${formatDuration(savedTime)} vs sequential${COLORS.reset}`
  );

  if (failures.length === 0) {
    console.log(
      `\n${COLORS.green}${COLORS.bold}All checks passed${COLORS.reset}`
    );
  } else {
    const failedGroups = [...new Set(failures.map((result) => result.group))];
    console.error(
      `\n${COLORS.red}${COLORS.bold}Failed:${COLORS.reset} ${failedGroups.join(', ')}`
    );
  }

  return failures;
}
