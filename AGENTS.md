# Agent instructions

Diwan (Legal Case Management) is a Bun 1.3 + Turborepo workspace:

- `fe/` — the React 19 + Vite application (populated: TanStack Router routes,
  pages, components, i18n, Convex client). The README/older notes calling it a
  "blank shell" are stale.
- `be/` — the Convex backend; functions live in `be/convex/`.
- `packages/shared/` — the `@diwan/shared` FE/BE contract.

Install dependencies once with `bun install` at the repository root. No
environment file is required for typechecking, builds, or backend tests.

On a fresh Linux agent environment, bootstrap the pinned toolchain first:
`curl -fsSL https://bun.sh/install | bash -s bun-v1.3.12` (needs egress to
`bun.sh`). Bun lands in `$HOME/.bun/bin`, which only `~/.bashrc` adds to
`PATH` — non-interactive shells don't source that, so call
`$HOME/.bun/bin/bun` by absolute path there. If the environment has no
`node`, symlink it to bun before installing
(`ln -sf "$HOME/.bun/bin/bun" "$HOME/.bun/bin/node"`) or the root
`prepare: husky` lifecycle script (shebang `#!/usr/bin/env node`) fails
`bun install`.

### Local stack and ports

- `bun run dev` clears the configured Diwan ports and starts the Vite frontend
  plus an anonymous local Convex watcher through Turborepo. Defaults:
  frontend `3000`, Convex API `3212`, Convex site `3213`.
- `bun run preview` clears the configured ports, builds the workspaces, and
  starts the Vite preview plus the local Convex watcher. The frontend preview
  defaults to `4300`.
- Port overrides live in the root `.env`: `LAW_FE_DEV_PORT`,
  `LAW_FE_PREVIEW_PORT`, `LAW_CONVEX_PORT`, and `LAW_CONVEX_SITE_PORT`.
- The root launchers intentionally stop listeners on their configured ports
  before startup. They use `lsof` on Linux/macOS and `netstat`/`taskkill` on
  Windows.

The backend wrapper defaults `CONVEX_AGENT_MODE=anonymous`, downloads/starts the
open-source backend without an account, and writes `CONVEX_URL`,
`CONVEX_SITE_URL`, and deployment metadata to `be/.env.local` (gitignored). Do
**not** pass `--configure`; that forces the cloud/login path.

With the local backend running, `bun run seed:demo` makes a fresh deployment
usable in one command: it generates and sets the Convex Auth JWT keys if
missing, seeds a verified demo login (`owner@diwan.test` / `Diwan123!`), and
provisions "Diwan Demo Firm" with the owner role, RBAC roles, and the five
default case types. Idempotent — safe to re-run. `bun run rbac:seed` seeds
roles alone. Run or inspect functions from `be/` with `bunx convex run <fn>`
and `bunx convex data <table>`.

### Running the app end-to-end (non-obvious gotchas)

- `fe` throws at boot unless `VITE_CONVEX_URL` is set, so `fe/.env.local` must
  exist (copy `fe/.env.example`; `VITE_CONVEX_URL=http://127.0.0.1:3212`).
  `VITE_ENABLE_GOOGLE_OAUTH` may be left empty: OAuth then auto-enables only
  when `VITE_GOOGLE_OAUTH_CLIENT_ID` is present.
- Convex **deployment** env vars (e.g. `GEMINI_API_KEY`, all optional) live in
  the local deployment (set via `bunx convex env set` from `be/`), not in
  `.env.local`, and are not auto-loaded from it. AI-assistant actions throw at
  runtime until `GEMINI_API_KEY` is set; everything else works without it.
- Convex Auth needs `JWT_PRIVATE_KEY` + `JWKS` set on the deployment or sign-in
  fails. `bun run seed:demo` generates and sets them automatically when absent.
- Account creation via the UI sign-up (auth `createAccount`) is **not wired**:
  the app's `users` table uses a `by_email` index but the auth library default
  expects an `email` index (`Index users.email not found`), and email OTP
  verification needs AWS SES (unconfigured locally). Sign-**in** works — use
  `bun run seed:demo` for a ready-made login. Onboarding is server-driven by
  design (see the comment in `be/convex/internal/provisioning.ts`).
- Sign-in is rate-limited (token bucket in the `authRateLimits` table); repeated
 rapid failed attempts lock the account out for a bit — space attempts out or
 clear that table. (A common trap: a lockout looks like a "wrong password".)
- Creating a case requires satisfying the selected case type's
 `requiredPartyRoles`. All 5 default case types require BOTH a `plaintiff` and a
 `defendant` party, so the create-case dialog will block submit until both roles
 are staged (adding a single party is not enough).
- Docker is NOT required for this stack (local Convex runs as a downloaded
 native binary in anonymous mode).

### Verification

- `bun run check` typechecks root/backend/shared tooling and runs the frontend
  ESLint, Prettier, TypeScript, architecture, reachability, and unused-export
  gate through Turborepo. Note: as of this setup the frontend `check` gate
  **fails** on pre-existing violations (ESLint, Prettier, ~6 tsc errors,
  architecture budgets, dead code); backend/shared checks pass. `bun run test`
  and `bun run build` pass. Don't assume a failing `check` means you broke it.
- `bun run check:fix` repairs frontend formatting/lint issues sequentially,
  then reruns the complete frontend gate. Use `LAW_CHECK_CONCURRENCY` only to
  cap subprocesses on a constrained machine.
- `bun run build` validates root tooling, typechecks the backend/shared package,
  and produces `fe/dist`.
- `bun run test` runs isolated frontend checker fixtures plus the backend Vitest
  + `convex-test` suite in process, with no cloud account or Docker.
- `bun run verify` runs check, build, and test; CI uses it. The pre-push hook
  runs only build + test until the pre-existing `check` violations are fixed.
- Focused commands are available through `bun run --cwd fe ...` and
  `bun run --cwd be ...`.

### Cursor Cloud specific instructions

- Cloud agents boot from a pinned VM snapshot declared in
  `.cursor/environment.json` (`snapshot` field). That committed file is the
  source of truth for the cloud environment, so any dashboard/snapshot-managed
  update script is a no-op — change the cloud setup by editing
  `.cursor/environment.json` (its `install` runs on startup and must stay
  idempotent). The snapshot preserves installed tooling and the Desktop
  browser's signed-in session; snapshots can expire after inactivity, in which
  case Cursor falls back to the base image, still runs `install`, and the
  signed-in state is lost (re-seed with `bun run seed:demo` and sign in as
  `owner@diwan.test` / `Diwan123!`).
- The local stack auto-starts via the `diwan-dev` `terminals` entry (`bun run
  dev`): Vite on `:3000`, anonymous local Convex API `:3212` / site `:3213`.
  Don't start a second `bun run dev` — inspect the existing `diwan-dev` tmux
  terminal first.
- `bun` lives at `$HOME/.bun/bin`; non-interactive shells don't source
  `~/.bashrc`, so `.cursor/environment.json` calls it by absolute path.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`be/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
