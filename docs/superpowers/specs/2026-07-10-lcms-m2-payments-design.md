# Diwan M2 — Payments & Billing Design

**Status:** Approved, ready for implementation plan
**Based on:** PRD.md §7 (Money & who-owes-whom), §4 (v1 scope, Payments row), §6 (Users & roles), §11 (open questions); IMPLEMENTATION_PLAN.md §3 (M2 — Money); `convex/schema.ts` (M2 tables scaffolded in Phase 0); current `main` (M1 Plan 1 merged) — see `docs/superpowers/specs/2026-07-10-lcms-m1-documents-design.md` for the sibling M1 Plan 2 design this mirrors process-wise.
**Precedes:** M2 Plan 3 implementation plan (`docs/superpowers/plans/`)

## 1. Scope

This is the third backend plan (M1 Plan 1: core entities, merged; M1 Plan 2: documents/versioning/uploads, PR open) and the first for M2. It covers the full core money-mechanics backend in one plan:

- Append-only ledger (`ledgerEntries`) with a single insert choke point
- Receipts with a gapless, concurrency-safe sequential counter per firm
- Checks (received→deposited→cleared/bounced) and the bounced-check cascade (reversing ledger entry + check status + mission)
- Installment plans (schedule rows; overdue computed at read time, no cron)
- `financialCounters` (fee-receivables aggregate) and the two who-owes-whom read models
- Disbursement-to-plaintiff blocked-until-cleared, with an audited override
- A minimal `model/missions/createFromEvent` helper (writes to the already-scaffolded `missions` table; M3 builds the rest of that module later)

Scope check (per brainstorming's decomposition guidance): M2's tables are tightly interdependent — `checks` references `receipts`, `financialCounters` derives from `ledgerEntries`, and the DoD ties append-only-ledger + receiptNo + bounced-check-cascade + counter-consistency together as one interlocking invariant set. Unlike the M1 Plan1/Plan2 split (which had a clean technical seam: plain CRUD vs. file storage), no equally clean seam exists here — so this stays one plan, broken into more tasks than Plan 1/2 given the module's complexity and highest-liability status (explicitly called out in both PRD.md and IMPLEMENTATION_PLAN.md as needing more design care than any other module).

Out of scope for this plan (explicitly deferred): the full `missions` module (list/complete/UI — M3), notification escalation for installments (M3), frontend (routes, payment wizard, receipt PDFs — all per IMPLEMENTATION_PLAN.md §3's frontend section), a per-firm disbursement-block toggle, a literal pending→approved staging workflow for secretary-recorded payments, a refund request→approve two-step workflow, and any resolution of PRD §11's still-open trust-accounting-obligations question.

## 2. Key Decisions

### 2.1 Secretary payment recording: advisory, not gated

PRD §6 says Secretary "registers cash/check payments (pending lawyer approval)." `ledgerEntries` has no status field, and the DoD requires zero `patch`/`delete` calls on it ever — a literal pending→approved gate would need a separate staging table.

**Decision:** Secretary's `PAYMENTS_WRITE_ALL` lets them record a payment directly; it's a real ledger entry immediately, visible on the lawyer's dashboard for awareness. "Pending lawyer approval" describes the firm's real-world process, not something v1 enforces server-side.

**Why:** keeps `ledgerEntries` purely append-only with no staging table — a real scope increase nothing else in the PRD calls for explicitly. Revisit if a pilot firm needs a hard gate.

### 2.2 receiptNo: dedicated counter table

**Decision:** new `receiptCounters` table — one narrow row per firm (`firmId`, `nextReceiptNo`, `updatedAt`). Creating a receipt reads+patches this single row in the same mutation as the ledger/receipt insert; Convex's OCC serializes concurrent writers on that exact document.

**Why:** the DoD requires this be "provable under concurrent writes, not just in a single-threaded test." A dedicated row makes correctness obvious (one document, one writer at a time, by construction) rather than relying on a subtler argument about how Convex tracks index-range read dependencies for a derived-from-max approach. Matches the PRD's own framing that this needs real design attention, not a shortcut.

### 2.3 Disbursement = its own mutation, gated on the payee's plaintiff role; always-on block, no config toggle

**Correction from brainstorming's original phrasing:** money coming in (`recordPayment`) and money going out to a plaintiff (`disburse`) are different enough operations — different direction semantics, and a clear-funds check that only ever applies to the outbound case — that conflating them into one mutation with an implicit branch would be a worse, more surprising API than two mutations sharing the same underlying model-layer helpers. `disburse` is its own surface mutation (§4), not a branch inside `recordPayment`.

**Decision:** `disburse(caseId, payerId, payeeId, amount, method, date, signatureRef?, overrideReason?)` requires `payeeId`'s party to hold `role: 'plaintiff'` on the case (via `caseParties`) — this is what marks the operation as a disbursement rather than an ordinary payment, not an accountType flag. It always writes a trust-account debit (via `appendLedgerEntry`) and a receipt (payer/payee both set, via the same `nextReceiptNo` sequence `recordPayment` uses — PRD §7 explicitly lists payee as one of a receipt's fields, so a disbursement gets a numbered receipt too). Before writing, it checks whether the case's checks funding the trust balance are all `cleared`; if not, it throws unless the caller passes `overrideReason`, which gets audited via `recordAuditEvent`. The block is always-on in v1 — no per-firm toggle, despite PRD calling it "configurable."

**Why:** a dedicated `disburseToPlaintiff` mutation would duplicate most of the general payment-recording logic for no real benefit — the plaintiff-role check is the actual distinguishing signal, not a different write shape. On "configurable": nothing in the PRD specifies what the toggle's default or granularity would be, and no pilot firm has asked to change it — building settings-driven behavior for a setting nobody has exercised yet is exactly the kind of premature configurability YAGNI exists to prevent.

### 2.4 Bounced-check → mission: build a minimal `createFromEvent` now

IMPLEMENTATION_PLAN.md §3 requires a bounced check to raise a mission via `model/missions/createFromEvent`, called from `model/billing/`. The `missions` table already exists (scaffolded in Phase 0); the missions *module* (M3) doesn't.

**Decision:** add `model/missions/createFromEvent.ts` now — one function that inserts a `missions` row from a structured event (case, type, title, assignee, priority). No list/complete/UI; just the insert path M2 needs. M3 later builds the full module around the same table and will likely reuse this exact helper.

**Why:** the alternative (stub the cascade like Plan 2's `processOcr`) would ship M2's bounced-check flow without its mission side effect until M3 lands — but unlike OCR engine selection (a genuinely unresolved open question needing evaluation), there's no open question blocking a minimal mission-insert helper; the table and the shared enums (`MISSION_TYPES`, `MISSION_STATUSES`, `MISSION_PRIORITIES`) already exist.

### 2.5 Refunds: direct insert gated by `PAYMENTS_APPROVE`, not a request→approve workflow

**Decision:** one mutation (`recordRefund`) that any caller holding `PAYMENTS_APPROVE` (lawyer or accountant) can call directly — inserts a refund-type reversing ledger entry immediately via `appendLedgerEntry`. No separate request/pending state.

**Why:** matches the append-only, no-staging-table approach already chosen for secretary payments (§2.1). Accountant's PRD-stated framing as a v1 stub role ("permission scaffolding present, UI can be minimal") fits a direct-insert gate, not a full request/approve workflow — which would itself need a staging table, the exact pattern already rejected for a more central case (secretary payments).

### 2.6 Installment `overdue`: computed at read time, never stored

No cron/scheduled-function infrastructure exists yet in this codebase.

**Decision:** the stored `status` only ever transitions `scheduled` → `paid` (one `markPaid` mutation). `overdue` is derived in the list/get query (`dueDate < now && status === 'scheduled'`) for display, never written to the row.

**Why:** the actual consumer that would care about a stored `overdue` transition (notification escalation) is M3's, not built yet. Building cron infrastructure for a status that's a display concern until then is scope the PRD doesn't ask for.

### 2.7 Ledger write path: single `appendLedgerEntry` choke point

**Decision:** `model/billing/ledger.ts`'s `appendLedgerEntry(ctx, fields)` is the *only* code path that ever inserts into `ledgerEntries`. It inserts the row, computes the signed delta (§2.8), and patches both the firm-scope and the case's lawyer's lawyer-scope `financialCounters` rows — all inside the caller's mutation. Every higher-level operation (`recordPayment`, `recordRefund`, the bounced-check reversal, the disbursement path) calls only this function.

**Why:** makes DoD #1 (append-only) and DoD #4 (counter consistency) structurally true by construction rather than something to verify by auditing every mutation separately. Mirrors Plan 2's `insertVersion` choke-point pattern (Task 1/2, `model/documents/versions.ts`).

### 2.8 `financialCounters.outstandingBalance`: fee receivables only

PRD §7 describes two distinct things — "firm-wide trust balances" (a custodial liability) and "aging receivables" (fees owed to the firm) — but the schema has one signed number per scope row.

**Decision:** `outstandingBalance` tracks fee receivables only (`accountType: 'fee'` entries). `direction: 'credit'` (a fee payment received) decreases it; `direction: 'debit'` (an `adjustment`-type fee charge, or a `refund` reversing a prior payment) increases it — standard accounts-receivable convention. Trust balances are *not* pre-aggregated into a counter: a case's trust balance is a direct sum over that case's `accountType: 'trust'` ledger entries (already indexed `by_case`), computed on read.

A receivables model needs a way to *create* the receivable, not just pay it down — added `recordAdjustment` to the `payments.ts` surface (§4) for exactly this: a lawyer/secretary/accountant records a fee charge (debit, `type: 'adjustment'`), which is what gives a case's balance a positive "amount owed" in the first place. Without it, `outstandingBalance` could only ever decrease from zero — `recordPayment`/`recordRefund` alone can't establish an initial charge.

**Why:** a single unified balance mixing fee + trust + client entries wouldn't mean anything precise — a firm holding $10k in trust and owed $500 in fees would show one confusing net figure instead of two meaningful ones. Fee receivables is the well-defined "who owes whom" the PRD's lawyer dashboard (owed to me / I owe) is actually describing; trust tracking is naturally case-scoped already and doesn't need a fast pre-aggregated read in v1 (no evidence yet that a firm-wide trust dashboard needs sub-linear lookup).

## 3. Schema Changes

1. **New table `receiptCounters`**: `firmId: v.id('firms')`, `nextReceiptNo: v.number()`, `updatedAt: v.number()`, indexed `by_firm`.
2. **Promote `installmentPlans.status`** from an inline `['scheduled', 'paid', 'overdue'] as const` to a shared `INSTALLMENT_STATUSES` enum in `packages/shared/src/billing.ts` — matches the established convention every other status field already follows.
3. **Promote `financialCounters.scope`** the same way — `['firm', 'lawyer'] as const` → `FINANCIAL_COUNTER_SCOPES` in shared.
4. No changes to `ledgerEntries`, `receipts`, or `checks` — their existing Phase 0 schema already matches this design exactly.

## 4. Function Surface

### Model layer (`convex/model/billing/`)

| File | Responsibility |
|---|---|
| `ledger.ts` | `appendLedgerEntry(ctx, fields)` — the single insert choke point (§2.7); enforces `LEDGER_BALANCE_WOULD_GO_NEGATIVE` before inserting. |
| `receipts.ts` | Owns `receiptCounters`; `nextReceiptNo(ctx, firmId)` reads+patches the counter row, called once per receipt in the same mutation as the ledger/receipt insert. |
| `checks.ts` | Check lifecycle transitions, including the bounced-check cascade (reversing `appendLedgerEntry` call + check status patch + mission creation — one mutation). |
| `aggregates.ts` | The delta-computation helper `appendLedgerEntry` calls into — kept separate so "how do we compute a firm/lawyer counter delta" isn't buried inside the ledger-write function. |
| `whoOwesWhom.ts` | The two read models, straight from `financialCounters`. |

Plus `convex/model/missions/createFromEvent.ts` (§2.4) and `convex/model/installments/installments.ts` (create/markPaid/list-with-computed-overdue).

### Surface (three files, split by entity — mirrors Plan 1's cases/parties/caseParties split)

| File | Functions |
|---|---|
| `convex/payments.ts` | `recordPayment` (cash or check method; check method also creates a `checks` row), `recordAdjustment` (a fee charge — debit, establishes/increases what's owed, §2.8), `recordRefund`, `disburse` (plaintiff-payment path with the clear-funds check, §2.3), `listLedgerForCase`, `getWhoOwesWhom` (lawyer-scoped and firm-wide variants). |
| `convex/checks.ts` | `markDeposited`, `markCleared`, `markBounced` (the cascade), `listChecks`. |
| `convex/installments.ts` | `create`, `markPaid`, `list`. |

### RBAC gating (two-gate pattern: `requireAccessibleCase` for scope, a `PAYMENTS_*` permission for action)

- `recordPayment`/`recordAdjustment`/`recordRefund`: `PAYMENTS_WRITE_OWN` or `PAYMENTS_WRITE_ALL`. `recordRefund` additionally requires `PAYMENTS_APPROVE`. `recordAdjustment` does not require `PAYMENTS_APPROVE` — establishing a charge is a normal write, not an approval-gated correction, same tier as `recordPayment`.
- `disburse`: requires `PAYMENTS_APPROVE` (lawyer or accountant only).
- Reads (`listLedgerForCase`, `getWhoOwesWhom`, `listChecks`): `PAYMENTS_READ_OWN`/`PAYMENTS_READ_ALL`, same own-vs-all pattern as `cases`. `getWhoOwesWhom`'s firm-wide variant needs `PAYMENTS_READ_ALL`; the lawyer-scoped variant needs only `PAYMENTS_READ_OWN`.

### New error codes (`convex/lib/errors.ts`)

`RECEIPT_NOT_FOUND`, `CHECK_NOT_FOUND`, `INSTALLMENT_PLAN_NOT_FOUND`, `DISBURSEMENT_BLOCKED_UNCLEARED_FUNDS`, `INVALID_CHECK_STATUS_TRANSITION`. (`LEDGER_BALANCE_WOULD_GO_NEGATIVE` already exists, seeded in Phase 0.)

## 5. Testing Plan

- **Append-only proof:** no `ctx.db.patch`/`.replace`/`.delete` call targets `ledgerEntries` anywhere in the model layer — satisfied by construction (only `appendLedgerEntry` inserts).
- **receiptNo concurrency:** concurrent `recordPayment` calls produce a gapless, non-colliding `receiptNo` sequence (Convex's OCC serializes/retries on the `receiptCounters` row).
- **Bounced-check cascade:** one `markBounced` call produces all three effects (reversing ledger entry, check status → `bounced`, a `missions` row) in one transaction-equivalent flow; a subsequent reinstatement produces the exact positive counter-row back.
- **financialCounters consistency:** after a batch of concurrent payment/refund/adjustment writes, a full re-sum of `ledgerEntries` (fee accountType only) matches the `financialCounters` row — a reconciliation test, not just a happy-path check.
- **Disbursement block:** a payment to the case's plaintiff-role party is rejected when the case's checks aren't all `cleared`, and succeeds with an override reason that gets audited.
- **RBAC:** own-vs-all and approve-gating tests (secretary can `recordPayment` but not `disburse`; associate can read own but not approve a refund; paralegal has zero payments access).

## 6. Definition of Done

Directly from IMPLEMENTATION_PLAN.md §3 (all 5 criteria carry forward unchanged, now mapped onto this design):

1. Every `ledgerEntries` mutation is provably append-only — no `patch`/`replace`/`delete` call exists on it anywhere outside a migration (§2.7's choke point makes this structural).
2. `receiptNo` never collides and never has a gap traceable to anything other than a genuine void — provable under concurrent writes (§2.2).
3. A bounced check produces, in one transaction-equivalent flow, a reversing ledger entry + updated check status + a mission (§2.4).
4. The `financialCounters` aggregate is provably consistent with a full re-sum of `ledgerEntries` after a batch of concurrent writes (§2.7, §2.8).
5. Disbursement-blocked-until-cleared is enforced server-side, with the override path requiring a reason and writing an audit event (§2.3).

## 7. Explicitly Deferred

- The full `missions` module (list/complete/UI) — M3.
- Notification escalation reading `installmentPlans` — M3.
- Frontend (routes, payment wizard, receipt PDFs) — per IMPLEMENTATION_PLAN.md §3's frontend section, not this plan.
- A per-firm disbursement-block config toggle (§2.3).
- A literal pending→approved staging workflow for secretary-recorded payments (§2.1) or a refund request→approve workflow (§2.5).
- PRD §11's open question: "Does a Palestinian firm hold client money in a way that implies specific trust-accounting/reporting obligations we should model explicitly?" — this design's `accountType: trust/fee/client` model and the disbursement-block mechanism are the current best-guess shape, not a confirmed-sufficient answer to that question.
- Extending `PAYMENT_METHODS` beyond cash/check (bank transfer, etc.) — PRD's v1 scope names only cash and check explicitly.
