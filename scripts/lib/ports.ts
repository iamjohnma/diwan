import { spawnSync } from 'node:child_process';
import process from 'node:process';

export interface PortOwner {
  command: string;
  pid: number;
  port: number;
}

const STOP_TIMEOUT_MS = 3_000;
const POLL_INTERVAL_MS = 100;

function isMissingCommand(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function readCommand(pid: number): string {
  if (process.platform === 'win32') {
    const result = spawnSync(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { encoding: 'utf8', windowsHide: true },
    );
    const match = result.stdout.match(/^"([^"]+)"/);
    return match?.[1] ?? 'unknown process';
  }

  const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], {
    encoding: 'utf8',
  });
  return result.stdout.trim() || 'unknown process';
}

function findWindowsPortOwners(port: number): PortOwner[] {
  const result = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  const pids = new Set<number>();
  for (const line of result.stdout.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0] !== 'TCP' || parts[3] !== 'LISTENING') {
      continue;
    }

    const localPort = Number(parts[1]?.match(/:(\d+)$/)?.[1]);
    const pid = Number(parts.at(-1));
    if (localPort === port && Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return [...pids].map((pid) => ({
    command: readCommand(pid),
    pid,
    port,
  }));
}

function findUnixPortOwners(port: number): PortOwner[] {
  const result = spawnSync(
    'lsof',
    ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'],
    { encoding: 'utf8' },
  );

  if (result.error) {
    if (isMissingCommand(result.error)) {
      throw new Error(
        'Port cleanup requires `lsof` on Linux and macOS. Install it and retry.',
        { cause: result.error },
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    return [];
  }

  const pids = new Set(
    result.stdout
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0),
  );

  return [...pids].map((pid) => ({
    command: readCommand(pid),
    pid,
    port,
  }));
}

export function findPortOwners(port: number): PortOwner[] {
  return process.platform === 'win32'
    ? findWindowsPortOwners(port)
    : findUnixPortOwners(port);
}

function stopProcess(pid: number, force: boolean): void {
  if (process.platform === 'win32') {
    const args = ['/PID', String(pid), '/T'];
    if (force) {
      args.push('/F');
    }
    spawnSync('taskkill', args, { windowsHide: true });
    return;
  }

  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
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

async function waitForPortsToClose(
  ports: readonly number[],
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ports.every((port) => findPortOwners(port).length === 0)) {
      return true;
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }

  return ports.every((port) => findPortOwners(port).length === 0);
}

export async function closePorts(ports: readonly number[]): Promise<void> {
  const uniquePorts = [...new Set(ports)].sort((left, right) => left - right);
  const owners = uniquePorts.flatMap(findPortOwners);

  if (owners.length === 0) {
    console.log(`[stack] Ports ${uniquePorts.join(', ')} are available.`);
    return;
  }

  const currentProcessIds = new Set([process.pid, process.ppid]);
  const protectedOwner = owners.find((owner) =>
    currentProcessIds.has(owner.pid),
  );
  if (protectedOwner) {
    throw new Error(
      `Refusing to stop the current launcher process on port ${protectedOwner.port}.`,
    );
  }

  const ownersByPid = new Map<number, PortOwner>();
  for (const owner of owners) {
    ownersByPid.set(owner.pid, owner);
  }

  for (const owner of ownersByPid.values()) {
    const ownedPorts = owners
      .filter((candidate) => candidate.pid === owner.pid)
      .map((candidate) => candidate.port)
      .join(', ');
    console.log(
      `[stack] Stopping PID ${owner.pid} (${owner.command}) on port(s) ${ownedPorts}.`,
    );
    stopProcess(owner.pid, false);
  }

  if (await waitForPortsToClose(uniquePorts, STOP_TIMEOUT_MS)) {
    return;
  }

  const remainingOwners = uniquePorts.flatMap(findPortOwners);
  const remainingPids = new Set(remainingOwners.map((owner) => owner.pid));
  for (const pid of remainingPids) {
    console.warn(`[stack] PID ${pid} did not stop gracefully; forcing it.`);
    stopProcess(pid, true);
  }

  if (!(await waitForPortsToClose(uniquePorts, STOP_TIMEOUT_MS))) {
    const blockedPorts = uniquePorts.filter(
      (port) => findPortOwners(port).length > 0,
    );
    throw new Error(`Could not clear port(s): ${blockedPorts.join(', ')}.`);
  }
}
