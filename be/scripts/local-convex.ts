import { spawn } from 'node:child_process';
import process from 'node:process';

const DEFAULT_CLOUD_PORT = 3212;
const DEFAULT_SITE_PORT = 3213;

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

const cloudPort = readPort('LAW_CONVEX_PORT', DEFAULT_CLOUD_PORT);
const sitePort = readPort('LAW_CONVEX_SITE_PORT', DEFAULT_SITE_PORT);

if (cloudPort === sitePort) {
  throw new Error('LAW_CONVEX_PORT and LAW_CONVEX_SITE_PORT must be different.');
}

const child = spawn(
  process.execPath,
  [
    'x',
    'convex',
    'dev',
    '--local-cloud-port',
    String(cloudPort),
    '--local-site-port',
    String(sitePort),
    ...process.argv.slice(2),
  ],
  {
    env: {
      ...process.env,
      CONVEX_AGENT_MODE: process.env.CONVEX_AGENT_MODE || 'anonymous',
    },
    stdio: 'inherit',
  },
);

let stopping = false;

function forwardSignal(signal: NodeJS.Signals): void {
  stopping = true;
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
}

process.once('SIGINT', () => forwardSignal('SIGINT'));
process.once('SIGTERM', () => forwardSignal('SIGTERM'));

const exitCode = await new Promise<number>((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? (stopping ? 0 : 1)));
});

process.exitCode = exitCode;
