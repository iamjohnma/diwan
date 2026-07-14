# Frontend quality gate

`bun run check` runs one CPU-aware gate for the frontend:

- ESLint with the Diwan-specific React, hooks, permission, RTL, compact-JSX, and
  module rules
- Prettier with deterministic import ordering
- strict TypeScript with unused locals and parameters enabled
- one consolidated architecture scan for source layout, barrels, file budgets,
  class composition, and empty folders
- one TypeScript-aware reachability and unused-export scan
- i18n locale parity between `src/integrations/i18n/locales/{ar,en}.json`

All findings are blocking. Unlike the Naab reference, heuristic checks are not
silently downgraded to report-only results.

`bun run check:fix` formats first, applies ESLint fixes second, and then runs the
complete read-only gate. The two writers never race on the same file.

Set `LAW_CHECK_CONCURRENCY` to a positive integer only when a constrained
machine needs a lower subprocess cap. Normal runs derive their limit from
`availableParallelism()` so container CPU limits are respected.

Domain-specific checks are intentionally added only with their prerequisite
feature. Router and dialog-layout checks belong here once Diwan has those real
modules; placeholder files must not be added solely to satisfy a checker.

`bun test scripts/check/checkers.test.ts` runs isolated fixture projects through
the architecture and dead-code analyzers. Add a regression fixture whenever a
new syntax form or module boundary is supported.
