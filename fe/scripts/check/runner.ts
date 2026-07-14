import { availableParallelism } from 'node:os';
import process from 'node:process';
import type { Task, TaskResult } from './types';

function readConcurrency(taskCount: number): number {
  if (taskCount === 0) {
    return 0;
  }

  const configured = process.env.LAW_CHECK_CONCURRENCY;
  if (configured !== undefined && configured !== '') {
    const value = Number(configured);

    if (!Number.isInteger(value) || value < 1) {
      throw new Error('LAW_CHECK_CONCURRENCY must be a positive integer.');
    }

    return Math.min(value, taskCount);
  }

  const cpuBudget = Math.max(1, Math.floor(availableParallelism() / 2));

  return Math.min(cpuBudget, 8, taskCount);
}

export async function runTask(task: Task): Promise<TaskResult> {
  const start = performance.now();
  const child = Bun.spawn(task.command, {
    env: {
      ...process.env,
      ...(process.env.NO_COLOR === undefined ? { FORCE_COLOR: '1' } : {})
    },
    stderr: 'pipe',
    stdout: 'pipe'
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);

  return {
    ...task,
    durationMs: Math.round(performance.now() - start),
    exitCode,
    stderr,
    stdout
  };
}

export async function runTasks(tasks: readonly Task[]): Promise<TaskResult[]> {
  const concurrency = readConcurrency(tasks.length);
  const results = new Array<TaskResult>(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await runTask(tasks[index]!);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return results;
}
