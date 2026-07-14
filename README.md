# Diwan — Legal Case Management SaaS

A multi-tenant case, hearing/deadline, document, and payment-ledger system for small Palestinian law firms — replacing the paper/Excel/WhatsApp stack they run on today. Built by IzTechValley to the same engineering and design discipline as the company's other vertical SaaS products.

Arabic-RTL-only, per-seat SaaS pricing, Convex backend, design-partner-led rollout. See [`PRD.md`](PRD.md) for the full product rationale.

## Status

**Foundation implementation is active.** The Convex backend and shared domain
contract are implemented under `be/` and `packages/shared/`. The React/Vite
frontend workspace exists under `fe/` as an intentionally blank application
shell, ready for the designed v1 screens.

## Development

Requires [Bun](https://bun.sh/) 1.3 or newer.

```bash
bun install
bun run dev
```

`bun run dev` starts the complete local stack without a Convex account:

- blank Vite frontend at `http://localhost:3000`
- anonymous local Convex API at `http://127.0.0.1:3212`
- anonymous local Convex site endpoint at `http://127.0.0.1:3213`

The launcher identifies and stops existing listeners on those ports before
startup. Override any port in a root `.env` using the variables documented in
`.env.example`.

Use `bun run preview` for a production frontend build served at
`http://localhost:4300` alongside the local backend.

```bash
bun run check
bun run check:fix
bun run build
bun run test
bun run verify
```

The frontend check is the Naab-derived quality gate: cached parallel ESLint,
Prettier, strict TypeScript, architecture budgets, source reachability, and
unused exports. `check:fix` runs its writers sequentially and then verifies the
repaired tree. `verify` is the pre-push and CI command for checks, builds, and
frontend-checker/backend tests. Turborepo schedules and caches workspace tasks
while respecting the shared package dependency graph.

## Workspace

| Path | Purpose |
|---|---|
| [`fe/`](fe/) | React 19 + Vite frontend |
| [`be/`](be/) | Convex backend and backend tests |
| [`packages/shared/`](packages/shared/) | Shared FE/BE domain contract |
| [`scripts/`](scripts/) | Full-stack development and preview orchestration |

## Where things are

| | |
|---|---|
| [`PRD.md`](PRD.md) | Product requirements — market, scope, architecture decisions, what's explicitly *not* in v1 and why |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Milestone-by-milestone build plan: schema, backend functions, frontend routes, per-module Definition of Done |
| [`docs/design/`](docs/design/README.md) | Every v1 screen/state, organized by breakpoint and flow — start here to see what's being built |
| [`des.pen`](des.pen) | The editable design source (Pencil). See the note in `docs/design/README.md` about it needing a live edit to flush current state to disk before re-exporting. |
| [`docs/standards/`](docs/standards/) | The company's Backend and Frontend Manifestos — the actual engineering/design constitution this whole build follows. Referenced constantly in `IMPLEMENTATION_PLAN.md`; read them before writing code. |
| [`docs/feedback-for-saladin-prd-v0.2.md`](docs/feedback-for-saladin-prd-v0.2.md) | PO coaching notes from the PRD rewrite (v0.2 → v0.3) — useful context on what changed and why, not required reading to build the product |
| [`docs/LCMS-architecture-ar.pdf`](docs/LCMS-architecture-ar.pdf) | Arabic-language architecture explainer, built for non-technical stakeholder review |

## Next step

Continue `IMPLEMENTATION_PLAN.md` from the current backend milestone and build
the frontend tokens/primitives in `fe/` before feature screens. The plan
explains why that order matters.
