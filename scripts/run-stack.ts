import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import { closePorts } from './lib/ports.ts';

type StackMode = 'dev' | 'preview';

const DEFAULT_FE_DEV_PORT = 3000;
const DEFAULT_FE_PREVIEW_PORT = 4300;
const DEFAULT_CONVEX_PORT = 3212;
const DEFAULT_CONVEX_SITE_PORT = 3213;
const FORCE_STOP_TIMEOUT_MS = 5_000;

function readPort(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }

  return port;
}

function readMode(value: string | undefined): StackMode {
  if (value === 'dev' || value === 'preview') {
    return value;
  }

  throw new Error('Usage: bun scripts/run-stack.ts <dev|preview>');
}

function signalProcessTree(
  child: ChildProcess,
  signal: NodeJS.Signals,
): void {
  if (
    child.pid === undefined ||
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  if (process.platform === 'win32') {
    if (signal === 'SIGKILL') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
      });
    } else {
      child.kill(signal);
    }
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ESRCH'
    ) {
      return;
    }
    throw error;
  }
}

async function run(): Promise<void> {
  const mode = readMode(process.argv[2]);
  const frontendPort = readPort(
    mode === 'dev' ? 'LAW_FE_DEV_PORT' : 'LAW_FE_PREVIEW_PORT',
    mode === 'dev' ? DEFAULT_FE_DEV_PORT : DEFAULT_FE_PREVIEW_PORT,
  );
  const convexPort = readPort('LAW_CONVEX_PORT', DEFAULT_CONVEX_PORT);
  const convexSitePort = readPort(
    'LAW_CONVEX_SITE_PORT',
    DEFAULT_CONVEX_SITE_PORT,
  );

  const ports = [frontendPort, convexPort, convexSitePort];
  if (new Set(ports).size !== ports.length) {
    throw new Error('Frontend and Convex ports must be distinct.');
  }

  await closePorts(ports);

  const root = path.join(import.meta.dir, '..');
  const env = {
    ...process.env,
    CONVEX_AGENT_MODE: process.env.CONVEX_AGENT_MODE || 'anonymous',
    LAW_CONVEX_PORT: String(convexPort),
    LAW_CONVEX_SITE_PORT: String(convexSitePort),
    LAW_FE_DEV_PORT: String(
      readPort('LAW_FE_DEV_PORT', DEFAULT_FE_DEV_PORT),
    ),
    LAW_FE_PREVIEW_PORT: String(
      readPort('LAW_FE_PREVIEW_PORT', DEFAULT_FE_PREVIEW_PORT),
    ),
  };

  console.log(
    `[stack] Starting Diwan ${mode}: frontend http://localhost:${frontendPort}, ` +
      `Convex http://127.0.0.1:${convexPort}.`,
  );

  const child = spawn(process.execPath, ['x', 'turbo', 'run', mode], {
    cwd: root,
    detached: process.platform !== 'win32',
    env,
    stdio: 'inherit',
  });

  let stopping = false;
  let forceStopTimer: ReturnType<typeof setTimeout> | undefined;

  const stop = (signal: NodeJS.Signals): void => {
    if (stopping) {
      return;
    }

    stopping = true;
    console.log(`\n[stack] Stopping Diwan ${mode}...`);
    signalProcessTree(child, signal);
    forceStopTimer = setTimeout(() => {
      signalProcessTree(child, 'SIGKILL');
    }, FORCE_STOP_TIMEOUT_MS);
    forceStopTimer.unref();
  };

  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? (stopping ? 0 : 1)));
  });

  if (forceStopTimer !== undefined) {
    clearTimeout(forceStopTimer);
  }

  process.exitCode = exitCode;
}

await run();
