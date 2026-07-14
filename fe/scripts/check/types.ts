export type CheckMode = 'check' | 'fix';

export interface Task {
  command: string[];
  group: string;
  label: string;
  showOutputOnSuccess?: boolean;
}

export interface TaskResult extends Task {
  durationMs: number;
  exitCode: number;
  stderr: string;
  stdout: string;
}
