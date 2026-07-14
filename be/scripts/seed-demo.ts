// One-command demo seed for the local anonymous Convex deployment.
//
//   bun run seed:demo          (root or be/)
//
// Requires the local backend to be running (`bun run dev`). Idempotent:
//   1. Sets JWT_PRIVATE_KEY + JWKS on the deployment when absent (sign-in
//      fails without them).
//   2. Ensures the demo login owner@diwan.test / Diwan123! exists and is
//      verified (internal/seedDemo:ensureLogin).
//   3. Provisions "Diwan Demo Firm" with the owner role and seeds the five
//      default case types — skipped when the user already has a firm.
import { join } from 'node:path';
import { $ } from 'bun';
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';
import { Scrypt } from 'lucia';

const DEMO_EMAIL = 'owner@diwan.test';
const DEMO_PASSWORD = 'Diwan123!';
const DEMO_NAME = 'Demo Owner';
const DEMO_FIRM = { firmName: 'Diwan Demo Firm', firmSlug: 'diwan-demo', seatLimit: 5 };

$.cwd(join(import.meta.dir, '..'));

// The convex CLI can crash during process teardown on Windows (libuv
// assertion) after the command itself succeeded, so success is judged by
// output, never by exit code.
async function convexCli(...args: string[]) {
  const result = await $`bunx convex ${args}`.nothrow().quiet();
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

async function convexRun(fn: string, args: Record<string, unknown>) {
  const result = await convexCli('run', fn, JSON.stringify(args));
  // The CLI pretty-prints the return value as the last thing on stdout;
  // anything before the first "{" is function log output.
  const start = result.stdout.indexOf('{');
  const end = result.stdout.lastIndexOf('}');
  try {
    return JSON.parse(result.stdout.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error(
      `convex run ${fn} failed (exit ${result.code}):\n${result.stdout}${result.stderr}`
    );
  }
}

async function listEnvNames() {
  const result = await convexCli('env', 'list');
  if (result.code !== 0 && !result.stdout.trim()) {
    throw new Error(
      'Could not reach the local deployment — start it first with `bun run dev`.\n' +
        result.stderr
    );
  }
  return new Set(
    result.stdout
      .split('\n')
      .map((line) => line.split('=', 1)[0]?.trim())
      .filter(Boolean)
  );
}

async function ensureAuthKeys() {
  const names = await listEnvNames();
  if (names.has('JWT_PRIVATE_KEY') && names.has('JWKS')) {
    console.log('Auth keys already set — skipping.');
    return;
  }

  console.log('Generating RS256 keypair for Convex Auth...');
  const { privateKey, publicKey } = await generateKeyPair('RS256', {
    extractable: true,
  });
  // Same normalization @convex-dev/auth's own CLI applies: PKCS8 with
  // newlines flattened to spaces survives env-var round-trips.
  const pem = (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, ' ');
  const jwks = JSON.stringify({
    keys: [{ use: 'sig', ...(await exportJWK(publicKey)) }],
  });
  await convexCli('env', 'set', '--', 'JWT_PRIVATE_KEY', pem);
  await convexCli('env', 'set', '--', 'JWKS', jwks);

  const verify = await listEnvNames();
  if (!verify.has('JWT_PRIVATE_KEY') || !verify.has('JWKS')) {
    throw new Error('Setting auth keys failed — check the deployment logs.');
  }
  console.log('Auth keys set.');
}

await ensureAuthKeys();

const secret = await new Scrypt().hash(DEMO_PASSWORD);
const login = await convexRun('internal/seedDemo:ensureLogin', {
  email: DEMO_EMAIL,
  name: DEMO_NAME,
  secret,
});
console.log(
  login.createdUser
    ? `Created demo user ${DEMO_EMAIL}.`
    : `Demo user ${DEMO_EMAIL} already exists — password refreshed.`
);

if (login.activeFirmId === null) {
  const firm = await convexRun('internal/provisioning:createFirmWithOwner', {
    ...DEMO_FIRM,
    ownerUserId: login.userId,
  });
  const seeded = await convexRun('internal/caseTypes:seedDefaults', {
    firmId: firm.firmId,
  });
  console.log(
    `Provisioned "${DEMO_FIRM.firmName}" (case types created: ${seeded.created}, skipped: ${seeded.skipped}).`
  );
} else {
  console.log('User already has a firm — skipping provisioning.');
}

console.log(`\nDemo login ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
