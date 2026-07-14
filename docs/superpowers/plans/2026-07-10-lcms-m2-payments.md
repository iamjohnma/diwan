# Diwan M2 Plan 3: Payments & Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core money backend — append-only ledger, gapless sequential receipt numbering, checks with a bounced-check cascade, installment schedules, a fee-receivables aggregate, and the who-owes-whom read models.

**Architecture:** Same four-zone Backend Manifesto pattern as Plans 1–2: thin `convex/{payments,checks,installments}.ts` surfaces over a fat `convex/model/billing/`, `convex/model/installments/`, and `convex/model/missions/` model layer. One structural choke point — `appendLedgerEntry` — is the *only* code path in the entire codebase allowed to insert into `ledgerEntries`; every money-writing mutation calls it rather than touching the table directly, which is what makes the append-only and counter-consistency Definition-of-Done criteria structural rather than something to audit by hand.

**Tech Stack:** Convex (schema, queries/mutations), `convex-test` for TDD (including real concurrency tests via parallel `t.mutation()` calls), TypeScript strict mode. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-07-10-lcms-m2-payments-design.md` — read it before starting; every decision below traces back to a numbered section there.

## Global Constraints

- `ctx.db.get`/`.patch`/`.replace`/`.delete` all take the **table name first**: `ctx.db.get('ledgerEntries', id)`, never `ctx.db.get(id)`.
- Use `.withIndex()` / `.withSearchIndex()`, never `.filter()`, for any query gated on more than "give me everything."
- Every paginated query returns `paginationResultValidator(...)` from `convex/server`, reconstructed explicitly as `{ ...result, page: result.page.map(toDetail) }`.
- Every function has an explicit `returns:` validator. No `v.any()` anywhere.
- All new error codes are added to `convex/lib/errors.ts`'s `ERROR_CODES` *before* ever being thrown.
- Every mutating operation calls `recordAuditEvent` (`convex/model/audit/recordAuditEvent.ts`) with `entityType` matching the table it wrote to (`'ledgerEntries'`, `'receipts'`, `'checks'`, `'installmentPlans'`) — not always `'payments'`; be precise about which row the event describes.
- **`ledgerEntries` is never patched, replaced, or deleted anywhere in this codebase, full stop.** `appendLedgerEntry` (`convex/model/billing/ledger.ts`, Task 1) is the *only* function in the entire codebase that calls `ctx.db.insert('ledgerEntries', ...)`. Every money-writing surface mutation (`recordPayment`, `recordAdjustment`, `recordRefund`, `disburse`, the bounced-check reversal) calls `appendLedgerEntry` — never `ctx.db.insert('ledgerEntries', ...)` directly. Corrections are always new rows with an inverted `direction`, never edits.
- **Convex mutation atomicity, empirically verified during M1 Plan 2** (see `convex/model/documents/versions.ts`'s `validateUploadedBlob` docstring on the merged PR): a single mutation call is fully atomic across *every* side effect it performs — every `ctx.db.insert`/`patch`/`delete` call commits or rolls back together, with no partial-persistence window, even when a `throw` happens after some calls already executed. This is the guarantee `appendLedgerEntry` leans on to combine a negative-balance check + two `financialCounters` patches + the `ledgerEntries` insert in one mutation, and it's the guarantee that makes `receiptCounters`' read-then-patch pattern safe under Convex's OCC (a concurrent writer on the same counter row forces a retry, never a lost update or duplicate).
- Money amounts are always positive numbers; `direction` (`'credit'` | `'debit'`) carries the sign for balance purposes. `appendLedgerEntry` throws `INVALID_LEDGER_AMOUNT` for `amount <= 0`.
- `financialCounters.outstandingBalance` tracks **fee receivables only** (`accountType: 'fee'` entries). `direction: 'credit'` (a fee payment received) decreases it; `direction: 'debit'` (a fee charge or a refund reversing a prior payment) increases it. `accountType: 'trust'`/`'client'` entries are written to `ledgerEntries` normally but never touch `financialCounters` — a case's trust balance is a direct sum over that case's `accountType: 'trust'` entries, computed on read, not pre-aggregated (design spec §2.8).
- RBAC: payments is a lawyer-scoped, own/all resource like `cases` (`packages/shared/src/rbac.ts`'s own comment: "cases and payments are the two lawyer-scoped resources using the Own/All action pair"). Every case-scoped payments mutation/query follows the **same two-step pattern as `caseParties.add`**: (1) `requireAccessibleCase(ctx, ctx.firmId, args.caseId)` for scope (case exists, not deleted, caller can at least read it); (2) `requireLawyerScopedAccess(ctx, caseDoc.primaryLawyerId, PERMISSIONS.PAYMENTS_{READ,WRITE}_OWN, PERMISSIONS.PAYMENTS_{READ,WRITE}_ALL)` for the actual own-vs-all write/read gate. `recordRefund` and `disburse` additionally require `requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_APPROVE)` on top of the base write gate — a caller must hold *both* a write-tier permission *and* approve to refund or disburse. `recordAdjustment` requires only the base write gate, no approve.
- One mutation per operation — no unified "record a money event" entry point.

---

## Task 1: Foundation — schema, errors, aggregates, ledger choke point, receiptCounters, recordPayment (cash)

**Files:**
- Modify: `convex/schema.ts` (new `receiptCounters` table; retype `installmentPlans.status` and `financialCounters.scope` to shared enums)
- Modify: `convex/lib/errors.ts`
- Modify: `packages/shared/src/billing.ts` (new `INSTALLMENT_STATUSES`, `FINANCIAL_COUNTER_SCOPES` enums)
- Create: `convex/model/billing/aggregates.ts`
- Create: `convex/model/billing/ledger.ts`
- Create: `convex/model/billing/receipts.ts`
- Create: `convex/payments.ts`
- Create: `convex/payments.test.ts`

**Interfaces:**
- Consumes: `requireAccessibleCase`, `requireLawyerScopedAccess` (`convex/model/authz/owned.ts`); `firmQuery`, `firmMutation`, `requireFirmPermission` (`convex/functions.ts`); `recordAuditEvent` (`convex/model/audit/recordAuditEvent.ts`); `requireAccessibleParty` (`convex/model/parties/parties.ts`); `PERMISSIONS`, `PAYMENT_METHODS`, `LEDGER_ACCOUNT_TYPES`, `LEDGER_DIRECTIONS`, `LEDGER_ENTRY_TYPES` (`@diwan/shared`); `makeTest`, `bootstrapFirm`, `addFirmMember`, `expectRejectedWithCode` (`convex/testHelpers.ts`).
- Produces (used by later tasks in this plan): `appendLedgerEntry(ctx, firmId, lawyerId, fields)`, `findLedgerEntryByRef(ctx, firmId, refType, refId)` (`model/billing/ledger.ts`); `applyFeeBalanceDelta(ctx, firmId, lawyerId, delta, guardAgainstNegative)`, `getFeeBalance(ctx, firmId, scope, lawyerId?)` (`model/billing/aggregates.ts`); `nextReceiptNo(ctx, firmId)` (`model/billing/receipts.ts`); `ledgerEntryDetailValidator`, `receiptDetailValidator`, `toLedgerEntryDetail`, `toReceiptDetail` (`convex/payments.ts`, module-private, referenced by name in later tasks' steps).

- [ ] **Step 1: Write the failing tests**

Create `convex/payments.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

type Test = ReturnType<typeof makeTest>;
type Owner = Awaited<ReturnType<typeof bootstrapFirm>>['owner'];
type Member = Awaited<ReturnType<typeof addFirmMember>>;

async function seedCaseType(t: Test, owner: Owner) {
  return await owner.authed.mutation(api.caseTypes.create, {
    key: 'civil-claim',
    label: 'Civil Claim',
    requiredPartyRoles: ['plaintiff', 'defendant'],
    requiredDocumentChecklist: [],
  });
}

async function seedCase(t: Test, caseTypeId: string, lawyer: Member, internalNumber = 'C-2000') {
  return await lawyer.authed.mutation(api.cases.create, {
    internalNumber,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caseTypeId: caseTypeId as any,
    primaryLawyerId: lawyer.userId,
  });
}

async function seedParty(t: Test, owner: Owner, nationalId: string, fullName: string) {
  return await owner.authed.mutation(api.parties.create, { nationalId, fullName });
}

describe('payments', () => {
  test('recordPayment (cash) creates a ledger entry and a receipt with receiptNo 1', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000001', 'Payer One');

    // accountType 'trust', not 'fee': this test is about receipt/ledger-
    // entry creation mechanics (receiptNo numbering), not balance
    // mechanics — 'trust' never touches the negative-balance guard, so it
    // doesn't need a prior recordAdjustment to establish a balance first
    // (unlike Test 2 below, which specifically tests fee-balance effects
    // and correctly sets one up). Using 'fee' with no prior balance here
    // would incorrectly reject a $500 credit against a $0 balance.
    const result = await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 500,
      method: 'cash',
      date: Date.now(),
    });

    expect(result.receipt.receiptNo).toBe(1);
    expect(result.receipt.amount).toBe(500);
    expect(result.ledgerEntry.direction).toBe('credit');
    expect(result.ledgerEntry.accountType).toBe('trust');
  });

  test('recordPayment (fee, credit) decreases the firm and lawyer outstanding balance', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000002', 'Payer Two');

    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 1000,
      reason: 'Initial fee charge',
    });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'fee',
      amount: 300,
      method: 'cash',
      date: Date.now(),
    });

    const lawyerBalance = await lawyer.authed.query(api.payments.getWhoOwesWhom, { scope: 'lawyer' });
    expect(lawyerBalance.outstandingBalance).toBe(700);
    const firmBalance = await owner.authed.query(api.payments.getWhoOwesWhom, { scope: 'firm' });
    expect(firmBalance.outstandingBalance).toBe(700);
  });

  test('recordPayment rejects an amount of zero', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000003', 'Payer Three');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'fee',
        amount: 0,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INVALID_LEDGER_AMOUNT,
    );
  });

  test('recordPayment (fee, credit) rejects overpayment past the outstanding balance', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000004', 'Payer Four');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'fee',
        amount: 100,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.LEDGER_BALANCE_WOULD_GO_NEGATIVE,
    );
  });

  test('receiptNo is gapless and non-colliding under concurrent recordPayment calls', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000005', 'Payer Five');
    // Establish enough of an owed balance that 10 concurrent $10 payments never trip the negative guard.
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 1000,
      reason: 'Bulk fee charge',
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        lawyer.authed.mutation(api.payments.recordPayment, {
          caseId,
          payerId,
          accountType: 'fee',
          amount: 10,
          method: 'cash',
          date: Date.now(),
        }),
      ),
    );

    const receiptNos = results.map((r) => r.receipt.receiptNo).sort((a, b) => a - b);
    expect(receiptNos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('an Associate cannot recordPayment at all — holds only payments:readOwn', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const caseId = await seedCase(t, caseTypeId, associate);
    const payerId = await seedParty(t, owner, '900000006', 'Payer Six');

    await expectRejectedWithCode(
      associate.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'fee',
        amount: 100,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('a Secretary CAN recordPayment on any lawyer\'s case (writeAll)', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000007', 'Payer Seven');
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 200,
      reason: 'Fee charge',
    });

    const result = await secretary.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'fee',
      amount: 200,
      method: 'cash',
      date: Date.now(),
    });
    expect(result.receipt.receiptNo).toBe(1);
  });

  test('a Paralegal cannot recordPayment — zero payments permissions at all', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const paralegal = await addFirmMember(t, firmId, 'paralegal', { name: 'Pat', email: 'pat@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000008', 'Payer Eight');

    await expectRejectedWithCode(
      paralegal.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'fee',
        amount: 100,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('recordPayment (trust account) never touches financialCounters', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000009', 'Payer Nine');

    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 5000,
      method: 'cash',
      date: Date.now(),
    });

    const lawyerBalance = await lawyer.authed.query(api.payments.getWhoOwesWhom, { scope: 'lawyer' });
    expect(lawyerBalance.outstandingBalance).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- payments.test.ts`
Expected: FAIL — `api.payments` is undefined (module doesn't exist yet).

- [ ] **Step 3: Add the new shared enums**

Modify `packages/shared/src/billing.ts` — append at the end of the file:

```typescript

// Stored status only ever transitions scheduled->paid (M2 Plan design
// spec §2.6) — 'overdue' is never written to the row, only computed at
// read time (dueDate < now && status === 'scheduled'), so it isn't a
// third enum value here.
export const INSTALLMENT_STATUSES = ['scheduled', 'paid'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const FINANCIAL_COUNTER_SCOPES = ['firm', 'lawyer'] as const;
export type FinancialCounterScope = (typeof FINANCIAL_COUNTER_SCOPES)[number];
```

- [ ] **Step 4: Add new error codes**

Modify `convex/lib/errors.ts` — add codes to `ERROR_CODES`, after `PARTY_NOT_FOUND` and before `LEDGER_BALANCE_WOULD_GO_NEGATIVE`:

```typescript
  PARTY_NOT_FOUND: 'PARTY_NOT_FOUND',
  RECEIPT_NOT_FOUND: 'RECEIPT_NOT_FOUND',
  CHECK_NOT_FOUND: 'CHECK_NOT_FOUND',
  CHECK_DETAILS_REQUIRED: 'CHECK_DETAILS_REQUIRED',
  INSTALLMENT_PLAN_NOT_FOUND: 'INSTALLMENT_PLAN_NOT_FOUND',
  INVALID_LEDGER_AMOUNT: 'INVALID_LEDGER_AMOUNT',
  DISBURSEMENT_BLOCKED_UNCLEARED_FUNDS: 'DISBURSEMENT_BLOCKED_UNCLEARED_FUNDS',
  INVALID_CHECK_STATUS_TRANSITION: 'INVALID_CHECK_STATUS_TRANSITION',
  LEDGER_BALANCE_WOULD_GO_NEGATIVE: 'LEDGER_BALANCE_WOULD_GO_NEGATIVE',
```

- [ ] **Step 5: Update the schema**

Modify `convex/schema.ts` — add the two new imports to the top `@diwan/shared` import block (find the existing import listing `LEDGER_ACCOUNT_TYPES, LEDGER_DIRECTIONS, LEDGER_ENTRY_TYPES` and add `INSTALLMENT_STATUSES, FINANCIAL_COUNTER_SCOPES` to that same import statement, alphabetical position doesn't matter, just add them to the existing named-import list from `'@diwan/shared'`).

Then replace the existing `installmentPlans` and `financialCounters` table definitions with:

```typescript
  // Schedule rows feeding the notification escalation ladder (PLAN §3) —
  // one row per installment, not an array field on a parent plan. Status
  // only ever transitions scheduled->paid; 'overdue' is computed at read
  // time in convex/installments.ts, never stored (M2 Plan design §2.6).
  installmentPlans: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    amount: v.number(),
    dueDate: v.number(),
    status: literalUnion(INSTALLMENT_STATUSES),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_firm', ['firmId'])
    .index('by_case', ['caseId'])
    .index('by_firm_due_date_status', ['firmId', 'dueDate', 'status']),

  // Running who-owes-whom totals, maintained by a before/after delta on
  // every ledger write and patched in the same transaction (PLAN §3) —
  // never recomputed from scratch on read. `scope`/`lawyerId` together
  // key both the firm-wide and per-lawyer aggregate rows. Tracks fee
  // receivables only, not trust balances (M2 Plan design §2.8).
  financialCounters: defineTable({
    firmId: v.id('firms'),
    scope: literalUnion(FINANCIAL_COUNTER_SCOPES),
    lawyerId: v.optional(v.id('users')),
    outstandingBalance: v.number(),
    updatedAt: v.number(),
  })
    .index('by_firm_scope', ['firmId', 'scope'])
    .index('by_firm_scope_lawyer', ['firmId', 'scope', 'lawyerId']),

  // One narrow row per firm — the entire concurrency-safety mechanism for
  // receiptNo (M2 Plan design §2.2). Convex's OCC serializes concurrent
  // writers on this exact document, so two concurrent receipt creations
  // can never collide or skip a number.
  receiptCounters: defineTable({
    firmId: v.id('firms'),
    nextReceiptNo: v.number(),
    updatedAt: v.number(),
  })
    .index('by_firm', ['firmId']),
```

- [ ] **Step 6: Create the aggregates model helper**

Create `convex/model/billing/aggregates.ts`:

```typescript
import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import type { FinancialCounterScope } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
// Mirrors ledger.ts's ReadCtx — getFeeBalance is read-only and must be
// callable from both firmQuery (getWhoOwesWhom) and firmMutation
// (recordPayment's remainingBalance calc) contexts. A query's ctx.db has
// no write methods at all (Convex enforces queries as read-only), so
// getFeeBalance cannot reuse getOrCreateCounter (which inserts on a
// missing row) — it does its own read-only lookup and returns 0 for a
// missing counter instead of creating one.
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

interface CounterRow {
  id: Id<'financialCounters'>;
  outstandingBalance: number;
}

/** Shared by getOrCreateCounter (insert-if-missing) and getFeeBalance (return-0-if-missing) — one place owns the index lookup shape. */
async function findCounter(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  scope: FinancialCounterScope,
  lawyerId: Id<'users'> | undefined,
): Promise<Doc<'financialCounters'> | null> {
  return scope === 'firm'
    ? await ctx.db
        .query('financialCounters')
        .withIndex('by_firm_scope', (q) => q.eq('firmId', firmId).eq('scope', 'firm'))
        .unique()
    : await ctx.db
        .query('financialCounters')
        .withIndex('by_firm_scope_lawyer', (q) =>
          q.eq('firmId', firmId).eq('scope', 'lawyer').eq('lawyerId', lawyerId),
        )
        .unique();
}

async function getOrCreateCounter(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  scope: FinancialCounterScope,
  lawyerId: Id<'users'> | undefined,
): Promise<CounterRow> {
  const existing = await findCounter(ctx, firmId, scope, lawyerId);
  if (existing) return { id: existing._id, outstandingBalance: existing.outstandingBalance };
  const now = Date.now();
  const id = await ctx.db.insert('financialCounters', {
    firmId,
    scope,
    lawyerId,
    outstandingBalance: 0,
    updatedAt: now,
  });
  return { id, outstandingBalance: 0 };
}

/**
 * Applies the same signed delta to both the firm-scope and the given
 * lawyer-scope financialCounters row, reading both BEFORE writing either
 * (so the negative-balance guard sees each scope's true resulting balance
 * — a firm-wide balance staying positive does not guarantee a specific
 * lawyer's own balance does, since other lawyers' balances can mask an
 * overpayment on one case). Both reads/writes happen in the caller's one
 * mutation call, so the guard-then-write is atomic (Global Constraints).
 */
export async function applyFeeBalanceDelta(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  lawyerId: Id<'users'>,
  delta: number,
  guardAgainstNegative: boolean,
): Promise<void> {
  const firmCounter = await getOrCreateCounter(ctx, firmId, 'firm', undefined);
  const lawyerCounter = await getOrCreateCounter(ctx, firmId, 'lawyer', lawyerId);
  const newFirmBalance = firmCounter.outstandingBalance + delta;
  const newLawyerBalance = lawyerCounter.outstandingBalance + delta;
  if (guardAgainstNegative && (newFirmBalance < 0 || newLawyerBalance < 0)) {
    throw new AppError(ERROR_CODES.LEDGER_BALANCE_WOULD_GO_NEGATIVE);
  }
  const now = Date.now();
  await ctx.db.patch('financialCounters', firmCounter.id, { outstandingBalance: newFirmBalance, updatedAt: now });
  await ctx.db.patch('financialCounters', lawyerCounter.id, {
    outstandingBalance: newLawyerBalance,
    updatedAt: now,
  });
}

export async function getFeeBalance(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  scope: FinancialCounterScope,
  lawyerId: Id<'users'> | undefined,
): Promise<number> {
  const existing = await findCounter(ctx, firmId, scope, lawyerId);
  return existing ? existing.outstandingBalance : 0;
}
```

- [ ] **Step 7: Create the ledger choke point**

Create `convex/model/billing/ledger.ts`:

```typescript
import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { applyFeeBalanceDelta } from './aggregates.ts';
import type { LedgerAccountType, LedgerDirection, LedgerEntryType } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

export interface AppendLedgerEntryFields {
  caseId: Id<'cases'>;
  accountType: LedgerAccountType;
  personId: Id<'parties'>;
  amount: number;
  direction: LedgerDirection;
  type: LedgerEntryType;
  refType: string;
  refId: string;
  createdBy: Id<'users'>;
}

/**
 * The ONLY function in this codebase that inserts into ledgerEntries
 * (Global Constraints). Validates amount, applies the fee-receivables
 * delta (accountType 'fee' only — trust/client entries never touch
 * financialCounters, design spec §2.8), then inserts the row. Every
 * money-writing mutation calls this instead of ctx.db.insert directly.
 */
export async function appendLedgerEntry(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  lawyerId: Id<'users'>,
  fields: AppendLedgerEntryFields,
): Promise<Id<'ledgerEntries'>> {
  if (fields.amount <= 0) {
    throw new AppError(ERROR_CODES.INVALID_LEDGER_AMOUNT);
  }
  if (fields.accountType === 'fee') {
    const delta = fields.direction === 'credit' ? -fields.amount : fields.amount;
    await applyFeeBalanceDelta(ctx, firmId, lawyerId, delta, true);
  }
  return await ctx.db.insert('ledgerEntries', {
    firmId,
    caseId: fields.caseId,
    accountType: fields.accountType,
    personId: fields.personId,
    amount: fields.amount,
    direction: fields.direction,
    type: fields.type,
    refType: fields.refType,
    refId: fields.refId,
    createdBy: fields.createdBy,
    createdAt: Date.now(),
  });
}

/** Traces a ledgerEntries row back from the record that caused it (e.g. a receipt or a check). */
export async function findLedgerEntryByRef(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  refType: string,
  refId: string,
): Promise<Doc<'ledgerEntries'> | null> {
  const entry = await ctx.db
    .query('ledgerEntries')
    .withIndex('by_ref', (q) => q.eq('refType', refType).eq('refId', refId))
    .unique();
  if (!entry || entry.firmId !== firmId) return null;
  return entry;
}
```

- [ ] **Step 8: Create the receipts counter helper**

Create `convex/model/billing/receipts.ts`:

```typescript
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';

type WriteCtx = Pick<MutationCtx, 'db'>;

/**
 * Reads and patches the firm's single receiptCounters row in one mutation
 * call — Convex's OCC serializes concurrent writers on this exact
 * document, so two concurrent calls can never return the same number or
 * skip one (design spec §2.2). Creates the counter row on first use.
 */
export async function nextReceiptNo(ctx: WriteCtx, firmId: Id<'firms'>): Promise<number> {
  const existing = await ctx.db
    .query('receiptCounters')
    .withIndex('by_firm', (q) => q.eq('firmId', firmId))
    .unique();
  const now = Date.now();
  if (!existing) {
    await ctx.db.insert('receiptCounters', { firmId, nextReceiptNo: 2, updatedAt: now });
    return 1;
  }
  const thisReceiptNo = existing.nextReceiptNo;
  await ctx.db.patch('receiptCounters', existing._id, { nextReceiptNo: thisReceiptNo + 1, updatedAt: now });
  return thisReceiptNo;
}
```

- [ ] **Step 9: Create the payments surface**

Create `convex/payments.ts`:

```typescript
import { v } from 'convex/values';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { requireAccessibleCase, requireLawyerScopedAccess } from './model/authz/owned.ts';
import { requireAccessibleParty } from './model/parties/parties.ts';
import { appendLedgerEntry } from './model/billing/ledger.ts';
import { nextReceiptNo } from './model/billing/receipts.ts';
import { getFeeBalance } from './model/billing/aggregates.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { literalUnion } from './lib/validators.ts';
import {
  PERMISSIONS,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_DIRECTIONS,
  LEDGER_ENTRY_TYPES,
  PAYMENT_METHODS,
  CHECK_STATUSES,
  FINANCIAL_COUNTER_SCOPES,
} from '@diwan/shared';

const accountTypeValidator = literalUnion(LEDGER_ACCOUNT_TYPES);
const paymentMethodValidator = literalUnion(PAYMENT_METHODS);
const financialCounterScopeValidator = literalUnion(FINANCIAL_COUNTER_SCOPES);

export const ledgerEntryDetailValidator = v.object({
  _id: v.id('ledgerEntries'),
  caseId: v.id('cases'),
  accountType: accountTypeValidator,
  personId: v.id('parties'),
  amount: v.number(),
  direction: literalUnion(LEDGER_DIRECTIONS),
  type: literalUnion(LEDGER_ENTRY_TYPES),
  refType: v.string(),
  refId: v.string(),
  createdAt: v.number(),
});

export function toLedgerEntryDetail(entry: {
  _id: import('./_generated/dataModel').Id<'ledgerEntries'>;
  caseId: import('./_generated/dataModel').Id<'cases'>;
  accountType: (typeof LEDGER_ACCOUNT_TYPES)[number];
  personId: import('./_generated/dataModel').Id<'parties'>;
  amount: number;
  direction: (typeof LEDGER_DIRECTIONS)[number];
  type: (typeof LEDGER_ENTRY_TYPES)[number];
  refType: string;
  refId: string;
  createdAt: number;
}) {
  return {
    _id: entry._id,
    caseId: entry.caseId,
    accountType: entry.accountType,
    personId: entry.personId,
    amount: entry.amount,
    direction: entry.direction,
    type: entry.type,
    refType: entry.refType,
    refId: entry.refId,
    createdAt: entry.createdAt,
  };
}

export const receiptDetailValidator = v.object({
  _id: v.id('receipts'),
  caseId: v.id('cases'),
  receiptNo: v.number(),
  payerId: v.id('parties'),
  payeeId: v.optional(v.id('parties')),
  amount: v.number(),
  method: paymentMethodValidator,
  date: v.number(),
  remainingBalance: v.number(),
  signatureRef: v.optional(v.string()),
  createdAt: v.number(),
});

export function toReceiptDetail(receipt: {
  _id: import('./_generated/dataModel').Id<'receipts'>;
  caseId: import('./_generated/dataModel').Id<'cases'>;
  receiptNo: number;
  payerId: import('./_generated/dataModel').Id<'parties'>;
  payeeId?: import('./_generated/dataModel').Id<'parties'>;
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  date: number;
  remainingBalance: number;
  signatureRef?: string;
  createdAt: number;
}) {
  return {
    _id: receipt._id,
    caseId: receipt.caseId,
    receiptNo: receipt.receiptNo,
    payerId: receipt.payerId,
    payeeId: receipt.payeeId,
    amount: receipt.amount,
    method: receipt.method,
    date: receipt.date,
    remainingBalance: receipt.remainingBalance,
    signatureRef: receipt.signatureRef,
    createdAt: receipt.createdAt,
  };
}

export const recordPayment = firmMutation({
  args: {
    caseId: v.id('cases'),
    payerId: v.id('parties'),
    accountType: accountTypeValidator,
    amount: v.number(),
    method: paymentMethodValidator,
    date: v.number(),
    signatureRef: v.optional(v.string()),
  },
  returns: v.object({ ledgerEntry: ledgerEntryDetailValidator, receipt: receiptDetailValidator }),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    await requireAccessibleParty(ctx, ctx.firmId, args.payerId);

    // Receipt created FIRST so its _id is known before the ledger entry is
    // ever inserted — ledgerEntries is never patched (Global Constraints),
    // so refType/refId must be correct from the single insert call, not
    // backfilled after. remainingBalance is computed from the
    // pre-payment balance minus this payment; if appendLedgerEntry below
    // throws (bad amount, would-go-negative), the whole mutation —
    // including this receipt insert and the receiptNo incrementing it —
    // rolls back together (Global Constraints' atomicity guarantee), so a
    // receipt row is never left behind for a rejected payment.
    const receiptNo = await nextReceiptNo(ctx, ctx.firmId);
    const balanceBefore = await getFeeBalance(ctx, ctx.firmId, 'lawyer', caseDoc.primaryLawyerId);
    const remainingBalance = args.accountType === 'fee' ? balanceBefore - args.amount : balanceBefore;
    const now = Date.now();
    const receiptId = await ctx.db.insert('receipts', {
      firmId: ctx.firmId,
      caseId: args.caseId,
      receiptNo,
      payerId: args.payerId,
      amount: args.amount,
      method: args.method,
      date: args.date,
      remainingBalance,
      signatureRef: args.signatureRef,
      createdBy: ctx.userId,
      createdAt: now,
    });

    const ledgerEntryId = await appendLedgerEntry(ctx, ctx.firmId, caseDoc.primaryLawyerId, {
      caseId: args.caseId,
      accountType: args.accountType,
      personId: args.payerId,
      amount: args.amount,
      direction: 'credit',
      type: 'payment',
      refType: 'receipts',
      refId: receiptId,
      createdBy: ctx.userId,
    });

    const ledgerEntry = await ctx.db.get('ledgerEntries', ledgerEntryId);
    const receipt = await ctx.db.get('receipts', receiptId);
    if (!ledgerEntry || !receipt) throw new Error('unreachable: just inserted');

    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'receipts',
      entityId: receiptId,
      action: 'create',
      after: { caseId: args.caseId, payerId: args.payerId, amount: args.amount, method: args.method },
    });
    return { ledgerEntry: toLedgerEntryDetail(ledgerEntry), receipt: toReceiptDetail(receipt) };
  },
});

export const recordAdjustment = firmMutation({
  args: {
    caseId: v.id('cases'),
    personId: v.id('parties'),
    amount: v.number(),
    reason: v.string(),
  },
  returns: ledgerEntryDetailValidator,
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    await requireAccessibleParty(ctx, ctx.firmId, args.personId);

    const ledgerEntryId = await appendLedgerEntry(ctx, ctx.firmId, caseDoc.primaryLawyerId, {
      caseId: args.caseId,
      accountType: 'fee',
      personId: args.personId,
      amount: args.amount,
      direction: 'debit',
      type: 'adjustment',
      refType: 'manual',
      refId: '',
      createdBy: ctx.userId,
    });
    const ledgerEntry = await ctx.db.get('ledgerEntries', ledgerEntryId);
    if (!ledgerEntry) throw new Error('unreachable: just inserted');

    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'ledgerEntries',
      entityId: ledgerEntryId,
      action: 'recordAdjustment',
      after: { caseId: args.caseId, personId: args.personId, amount: args.amount, reason: args.reason },
    });
    return toLedgerEntryDetail(ledgerEntry);
  },
});

export const getWhoOwesWhom = firmQuery({
  args: { scope: financialCounterScopeValidator },
  returns: v.object({ scope: financialCounterScopeValidator, outstandingBalance: v.number() }),
  handler: async (ctx, args) => {
    if (args.scope === 'firm') {
      requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_READ_ALL);
      const outstandingBalance = await getFeeBalance(ctx, ctx.firmId, 'firm', undefined);
      return { scope: 'firm' as const, outstandingBalance };
    }
    requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_READ_OWN);
    const outstandingBalance = await getFeeBalance(ctx, ctx.firmId, 'lawyer', ctx.userId);
    return { scope: 'lawyer' as const, outstandingBalance };
  },
});
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `bun run test -- payments.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 11: Regenerate Convex types and typecheck**

Run: `bunx convex dev --once && bun run check`
Expected: both exit cleanly. Commit whatever `convex/_generated/*` changes this produces along with the rest of this task's files — every prior plan in this series has hit review failures from forgetting this step.

- [ ] **Step 12: Commit**

```bash
git add convex/schema.ts convex/lib/errors.ts packages/shared/src/billing.ts \
  convex/model/billing/aggregates.ts convex/model/billing/ledger.ts convex/model/billing/receipts.ts \
  convex/payments.ts convex/payments.test.ts convex/_generated
git commit -m "feat: add payments recordPayment/recordAdjustment/getWhoOwesWhom with ledger choke point"
```

---

## Task 2: Checks — check-method payments, check lifecycle, bounced-check cascade

**Files:**
- Modify: `convex/payments.ts` (extend `recordPayment` with an optional check-details arg)
- Modify: `convex/payments.test.ts` (append a check-method test)
- Create: `convex/model/billing/checks.ts`
- Create: `convex/model/missions/createFromEvent.ts`
- Create: `convex/checks.ts`
- Create: `convex/checks.test.ts`

**Interfaces:**
- Consumes: `appendLedgerEntry`, `findLedgerEntryByRef` (Task 1, `model/billing/ledger.ts`); `requireAccessibleCase`, `requireLawyerScopedAccess` (`convex/model/authz/owned.ts`); `MISSION_TYPES`, `MISSION_PRIORITIES`, `MISSION_STATUSES` (`@diwan/shared`, already exist from Phase 0).
- Produces: `createCheck(ctx, firmId, fields)`, `requireAccessibleCheck(ctx, firmId, checkId)`, `listChecksForCase(ctx, caseId)` (also consumed by Task 4's disbursement funds-cleared check), `bounceCheck(ctx, firmId, lawyerId, caseId, check, actorId)`, `clearCheck(ctx, firmId, lawyerId, caseId, check, actorId)` (`model/billing/checks.ts`); `createMissionFromEvent(ctx, firmId, fields)` (`model/missions/createFromEvent.ts`) — this plan's only consumer of `createMissionFromEvent`, but a future M3 plan will import it too.

- [ ] **Step 1: Write the failing tests**

Create `convex/checks.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

type Test = ReturnType<typeof makeTest>;
type Owner = Awaited<ReturnType<typeof bootstrapFirm>>['owner'];
type Member = Awaited<ReturnType<typeof addFirmMember>>;

async function seedCaseType(t: Test, owner: Owner) {
  return await owner.authed.mutation(api.caseTypes.create, {
    key: 'civil-claim',
    label: 'Civil Claim',
    requiredPartyRoles: ['plaintiff', 'defendant'],
    requiredDocumentChecklist: [],
  });
}

async function seedCase(t: Test, caseTypeId: string, lawyer: Member, internalNumber = 'C-2100') {
  return await lawyer.authed.mutation(api.cases.create, {
    internalNumber,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caseTypeId: caseTypeId as any,
    primaryLawyerId: lawyer.userId,
  });
}

async function seedParty(t: Test, owner: Owner, nationalId: string, fullName: string) {
  return await owner.authed.mutation(api.parties.create, { nationalId, fullName });
}

async function seedCheckPayment(t: Test, owner: Owner, lawyer: Member, caseId: string, payerId: string, amount: number) {
  return await lawyer.authed.mutation(api.payments.recordPayment, {
    caseId: caseId as never,
    payerId: payerId as never,
    accountType: 'trust',
    amount,
    method: 'check',
    date: Date.now(),
    checkDetails: { checkNumber: 'CHK-001', bank: 'Bank of Palestine', dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000 },
  });
}

describe('checks', () => {
  test('recordPayment (check method) creates a checks row in status received', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001001', 'Payer A');

    const result = await seedCheckPayment(t, owner, lawyer, caseId, payerId, 5000);
    expect(result.check?.status).toBe('received');
    expect(result.check?.checkNumber).toBe('CHK-001');
  });

  test('recordPayment (check method) without checkDetails is rejected', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001002', 'Payer B');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'trust',
        amount: 1000,
        method: 'check',
        date: Date.now(),
      }),
      ERROR_CODES.CHECK_DETAILS_REQUIRED,
    );
  });

  test('markDeposited then markCleared: normal clear path writes no reversal ledger entry', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001003', 'Payer C');
    const { check } = await seedCheckPayment(t, owner, lawyer, caseId, payerId, 2000);
    if (!check) throw new Error('missing check');

    await lawyer.authed.mutation(api.checks.markDeposited, { checkId: check._id });
    await lawyer.authed.mutation(api.checks.markCleared, { checkId: check._id });

    const listed = await lawyer.authed.query(api.checks.listChecks, { caseId });
    expect(listed.find((c) => c._id === check._id)?.status).toBe('cleared');

    // The name promises "writes no reversal ledger entry" — assert it,
    // not just the status transition. Only the original recordPayment
    // entry should exist; a normal clear (not a reinstatement) must not
    // add a second row.
    const entries = await t.run(async (ctx) =>
      ctx.db
        .query('ledgerEntries')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect(),
    );
    expect(entries).toHaveLength(1);
  });

  test('markBounced (from deposited) produces a reversing ledger entry, bounced status, and a mission', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001004', 'Payer D');
    const { check } = await seedCheckPayment(t, owner, lawyer, caseId, payerId, 3000);
    if (!check) throw new Error('missing check');
    await lawyer.authed.mutation(api.checks.markDeposited, { checkId: check._id });

    const result = await lawyer.authed.mutation(api.checks.markBounced, { checkId: check._id });
    expect(result.check.status).toBe('bounced');
    expect(result.reversingEntry.direction).toBe('debit');
    expect(result.reversingEntry.amount).toBe(3000);

    const mission = await t.run(async (ctx) => ctx.db.get('missions', result.missionId));
    expect(mission?.assigneeId).toBe(lawyer.userId);
    expect(mission?.priority).toBe('high');
  });

  test('markCleared (reinstatement, from bounced) produces a second reversing entry restoring the original direction', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001005', 'Payer E');
    const { check } = await seedCheckPayment(t, owner, lawyer, caseId, payerId, 4000);
    if (!check) throw new Error('missing check');
    await lawyer.authed.mutation(api.checks.markDeposited, { checkId: check._id });
    await lawyer.authed.mutation(api.checks.markBounced, { checkId: check._id });

    const reinstated = await lawyer.authed.mutation(api.checks.markCleared, { checkId: check._id });
    expect(reinstated.status).toBe('cleared');

    const entries = await t.run(async (ctx) =>
      ctx.db
        .query('ledgerEntries')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect(),
    );
    // Original credit (recordPayment) + bounce debit (markBounced) + reinstatement credit (markCleared) = 3.
    expect(entries).toHaveLength(3);
    const directions = entries.map((e) => e.direction).sort();
    expect(directions).toEqual(['credit', 'credit', 'debit']);
  });

  test('markBounced from received (not yet deposited) is rejected', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001006', 'Payer F');
    const { check } = await seedCheckPayment(t, owner, lawyer, caseId, payerId, 1000);
    if (!check) throw new Error('missing check');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.checks.markBounced, { checkId: check._id }),
      ERROR_CODES.INVALID_CHECK_STATUS_TRANSITION,
    );
  });

  test('an Associate cannot markDeposited — holds only payments:readOwn', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, associate, 'C-2101');
    const payerId = await seedParty(t, owner, '900001007', 'Payer G');
    const { check } = await seedCheckPayment(t, owner, secretary, caseId, payerId, 1500);
    if (!check) throw new Error('missing check');

    await expectRejectedWithCode(
      associate.authed.mutation(api.checks.markDeposited, { checkId: check._id }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- checks.test.ts`
Expected: FAIL — `api.checks` is undefined, and `recordPayment`'s `checkDetails` arg / `check` return field don't exist yet.

- [ ] **Step 3: Create the missions event helper**

Create `convex/model/missions/createFromEvent.ts`:

```typescript
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import type { MissionType, MissionPriority } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;

export interface MissionEventFields {
  caseId: Id<'cases'>;
  title: string;
  type: MissionType;
  assigneeId: Id<'users'>;
  dueDate: number;
  priority: MissionPriority;
}

/**
 * Inserts one mission row from a structured event. Deliberately minimal
 * (design spec §2.4) — just the insert path the bounced-check cascade
 * needs, not the missions module itself. M3 builds list/complete/UI
 * around the same table and is expected to reuse this exact helper for
 * its own verdict/hearing-driven auto-generation
 * (packages/shared/src/missions.ts's DEADLINE_CRITICAL_MISSION_TYPES
 * comment already anticipates this function by name).
 */
export async function createMissionFromEvent(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  fields: MissionEventFields,
): Promise<Id<'missions'>> {
  const now = Date.now();
  return await ctx.db.insert('missions', {
    firmId,
    caseId: fields.caseId,
    title: fields.title,
    type: fields.type,
    assigneeId: fields.assigneeId,
    dueDate: fields.dueDate,
    priority: fields.priority,
    status: 'todo',
    checklist: [],
    createdAt: now,
    updatedAt: now,
  });
}
```

- [ ] **Step 4: Create the checks model layer**

Create `convex/model/billing/checks.ts`:

```typescript
import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { appendLedgerEntry, findLedgerEntryByRef } from './ledger.ts';
import { createMissionFromEvent } from '../missions/createFromEvent.ts';
import type { CheckStatus } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

/**
 * Branching lifecycle, not linear like cases' CASE_STATUS_TRANSITIONS — a
 * deposited check can bounce, and a bounced check can be reinstated back
 * to cleared (PRD §3: "a reinstated check inserts the exact positive
 * counter-row back").
 */
const CHECK_STATUS_TRANSITIONS: Record<CheckStatus, readonly CheckStatus[]> = {
  received: ['deposited'],
  deposited: ['cleared', 'bounced'],
  cleared: [],
  bounced: ['cleared'],
};

export function requireValidCheckStatusTransition(from: CheckStatus, to: CheckStatus): void {
  if (!CHECK_STATUS_TRANSITIONS[from].includes(to)) {
    throw new AppError(ERROR_CODES.INVALID_CHECK_STATUS_TRANSITION);
  }
}

export interface CreateCheckFields {
  receiptId: Id<'receipts'>;
  checkNumber: string;
  bank: string;
  dueDate: number;
}

export async function createCheck(ctx: WriteCtx, firmId: Id<'firms'>, fields: CreateCheckFields): Promise<Id<'checks'>> {
  const now = Date.now();
  return await ctx.db.insert('checks', {
    firmId,
    receiptId: fields.receiptId,
    checkNumber: fields.checkNumber,
    bank: fields.bank,
    dueDate: fields.dueDate,
    status: 'received',
    createdAt: now,
    updatedAt: now,
  });
}

export async function requireAccessibleCheck(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  checkId: Id<'checks'>,
): Promise<Doc<'checks'>> {
  const check = await ctx.db.get('checks', checkId);
  if (!check || check.firmId !== firmId) {
    throw new AppError(ERROR_CODES.CHECK_NOT_FOUND);
  }
  return check;
}

/**
 * checks has no direct caseId (only receiptId) and no by-case index —
 * collects the case's receipts first (bounded to one case, same
 * precedent as listPartiesForCase/computeChecklistStatus), then each
 * receipt's checks via the by_receipt index (0-1 checks per receipt in
 * practice). Shared by the listChecks surface query and
 * model/billing/disbursement.ts's funds-cleared check — the one place
 * "all of this case's checks" is collected, so both stay consistent.
 */
export async function listChecksForCase(ctx: ReadCtx, caseId: Id<'cases'>): Promise<Doc<'checks'>[]> {
  const receipts = await ctx.db
    .query('receipts')
    .withIndex('by_case', (q) => q.eq('caseId', caseId))
    .collect();
  const checksPerReceipt = await Promise.all(
    receipts.map((receipt) =>
      ctx.db
        .query('checks')
        .withIndex('by_receipt', (q) => q.eq('receiptId', receipt._id))
        .collect(),
    ),
  );
  return checksPerReceipt.flat();
}

async function transitionCheckStatus(ctx: WriteCtx, check: Doc<'checks'>, nextStatus: CheckStatus): Promise<void> {
  requireValidCheckStatusTransition(check.status, nextStatus);
  await ctx.db.patch('checks', check._id, { status: nextStatus, updatedAt: Date.now() });
}

export async function markCheckDeposited(ctx: WriteCtx, check: Doc<'checks'>): Promise<void> {
  await transitionCheckStatus(ctx, check, 'deposited');
}

export interface BounceCheckResult {
  reversingEntryId: Id<'ledgerEntries'>;
  missionId: Id<'missions'>;
}

/**
 * The bounced-check cascade (design spec §2.4, IMPLEMENTATION_PLAN.md
 * §3): transitions the check to 'bounced', writes a reversing ledger
 * entry inverting the original payment's direction, and raises a mission
 * assigned to the case's lawyer — all in the caller's one mutation.
 * Atomic by construction (Global Constraints): if any step throws,
 * nothing persists.
 */
export async function bounceCheck(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  lawyerId: Id<'users'>,
  caseId: Id<'cases'>,
  check: Doc<'checks'>,
  actorId: Id<'users'>,
): Promise<BounceCheckResult> {
  await transitionCheckStatus(ctx, check, 'bounced');

  const original = await findLedgerEntryByRef(ctx, firmId, 'receipts', check.receiptId);
  if (!original) throw new AppError(ERROR_CODES.RECEIPT_NOT_FOUND);
  const reversingEntryId = await appendLedgerEntry(ctx, firmId, lawyerId, {
    caseId,
    accountType: original.accountType,
    personId: original.personId,
    amount: original.amount,
    direction: original.direction === 'credit' ? 'debit' : 'credit',
    type: 'adjustment',
    // 'checks_bounce', not 'checks': clearCheck's reinstatement entry
    // below also traces back to this same check, so a shared refType
    // would give findLedgerEntryByRef's .unique() two matching rows once
    // a check goes through the full bounced->cleared path and throw at
    // runtime for the very next caller that looks this check up.
    refType: 'checks_bounce',
    refId: check._id,
    createdBy: actorId,
  });

  const missionId = await createMissionFromEvent(ctx, firmId, {
    caseId,
    title: `Check #${check.checkNumber} bounced — follow up with payer`,
    type: 'other',
    assigneeId: lawyerId,
    dueDate: Date.now() + 24 * 60 * 60 * 1000,
    priority: 'high',
  });

  return { reversingEntryId, missionId };
}

export interface ClearCheckResult {
  reinstatementEntryId: Id<'ledgerEntries'> | null;
}

/**
 * A normal deposited->cleared transition writes no ledger entry at all —
 * the original payment entry from recordPayment already covers it;
 * clearing just confirms it. A bounced->cleared transition (reinstatement)
 * writes a second reversing entry restoring the original direction,
 * undoing bounceCheck's reversal (PRD §3).
 */
export async function clearCheck(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  lawyerId: Id<'users'>,
  caseId: Id<'cases'>,
  check: Doc<'checks'>,
  actorId: Id<'users'>,
): Promise<ClearCheckResult> {
  const isReinstatement = check.status === 'bounced';
  await transitionCheckStatus(ctx, check, 'cleared');
  if (!isReinstatement) return { reinstatementEntryId: null };

  const original = await findLedgerEntryByRef(ctx, firmId, 'receipts', check.receiptId);
  if (!original) throw new AppError(ERROR_CODES.RECEIPT_NOT_FOUND);
  const reinstatementEntryId = await appendLedgerEntry(ctx, firmId, lawyerId, {
    caseId,
    accountType: original.accountType,
    personId: original.personId,
    amount: original.amount,
    direction: original.direction,
    type: 'adjustment',
    // 'checks_reinstatement', distinct from bounceCheck's 'checks_bounce'
    // — same reasoning, keeps each ref-type/ref-id tuple unique.
    refType: 'checks_reinstatement',
    refId: check._id,
    createdBy: actorId,
  });
  return { reinstatementEntryId };
}
```

- [ ] **Step 5: Extend recordPayment for check-method payments**

Replace the entire contents of `convex/payments.ts` with (this adds the `checkDetails` arg, check-row creation, and the `check` field on the return value — every other export is unchanged from Task 1):

```typescript
import { v } from 'convex/values';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { requireAccessibleCase, requireLawyerScopedAccess } from './model/authz/owned.ts';
import { requireAccessibleParty } from './model/parties/parties.ts';
import { appendLedgerEntry } from './model/billing/ledger.ts';
import { nextReceiptNo } from './model/billing/receipts.ts';
import { getFeeBalance } from './model/billing/aggregates.ts';
import { createCheck } from './model/billing/checks.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { literalUnion } from './lib/validators.ts';
import { AppError, ERROR_CODES } from './lib/errors.ts';
import {
  PERMISSIONS,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_DIRECTIONS,
  LEDGER_ENTRY_TYPES,
  PAYMENT_METHODS,
  CHECK_STATUSES,
  FINANCIAL_COUNTER_SCOPES,
} from '@diwan/shared';

const accountTypeValidator = literalUnion(LEDGER_ACCOUNT_TYPES);
const paymentMethodValidator = literalUnion(PAYMENT_METHODS);
const financialCounterScopeValidator = literalUnion(FINANCIAL_COUNTER_SCOPES);

export const ledgerEntryDetailValidator = v.object({
  _id: v.id('ledgerEntries'),
  caseId: v.id('cases'),
  accountType: accountTypeValidator,
  personId: v.id('parties'),
  amount: v.number(),
  direction: literalUnion(LEDGER_DIRECTIONS),
  type: literalUnion(LEDGER_ENTRY_TYPES),
  refType: v.string(),
  refId: v.string(),
  createdAt: v.number(),
});

export function toLedgerEntryDetail(entry: {
  _id: import('./_generated/dataModel').Id<'ledgerEntries'>;
  caseId: import('./_generated/dataModel').Id<'cases'>;
  accountType: (typeof LEDGER_ACCOUNT_TYPES)[number];
  personId: import('./_generated/dataModel').Id<'parties'>;
  amount: number;
  direction: (typeof LEDGER_DIRECTIONS)[number];
  type: (typeof LEDGER_ENTRY_TYPES)[number];
  refType: string;
  refId: string;
  createdAt: number;
}) {
  return {
    _id: entry._id,
    caseId: entry.caseId,
    accountType: entry.accountType,
    personId: entry.personId,
    amount: entry.amount,
    direction: entry.direction,
    type: entry.type,
    refType: entry.refType,
    refId: entry.refId,
    createdAt: entry.createdAt,
  };
}

export const receiptDetailValidator = v.object({
  _id: v.id('receipts'),
  caseId: v.id('cases'),
  receiptNo: v.number(),
  payerId: v.id('parties'),
  payeeId: v.optional(v.id('parties')),
  amount: v.number(),
  method: paymentMethodValidator,
  date: v.number(),
  remainingBalance: v.number(),
  signatureRef: v.optional(v.string()),
  createdAt: v.number(),
});

export function toReceiptDetail(receipt: {
  _id: import('./_generated/dataModel').Id<'receipts'>;
  caseId: import('./_generated/dataModel').Id<'cases'>;
  receiptNo: number;
  payerId: import('./_generated/dataModel').Id<'parties'>;
  payeeId?: import('./_generated/dataModel').Id<'parties'>;
  amount: number;
  method: (typeof PAYMENT_METHODS)[number];
  date: number;
  remainingBalance: number;
  signatureRef?: string;
  createdAt: number;
}) {
  return {
    _id: receipt._id,
    caseId: receipt.caseId,
    receiptNo: receipt.receiptNo,
    payerId: receipt.payerId,
    payeeId: receipt.payeeId,
    amount: receipt.amount,
    method: receipt.method,
    date: receipt.date,
    remainingBalance: receipt.remainingBalance,
    signatureRef: receipt.signatureRef,
    createdAt: receipt.createdAt,
  };
}

const checkDetailValidator = v.object({
  _id: v.id('checks'),
  receiptId: v.id('receipts'),
  checkNumber: v.string(),
  bank: v.string(),
  dueDate: v.number(),
  status: literalUnion(CHECK_STATUSES),
});

function toCheckDetail(check: {
  _id: import('./_generated/dataModel').Id<'checks'>;
  receiptId: import('./_generated/dataModel').Id<'receipts'>;
  checkNumber: string;
  bank: string;
  dueDate: number;
  status: (typeof CHECK_STATUSES)[number];
}) {
  return {
    _id: check._id,
    receiptId: check.receiptId,
    checkNumber: check.checkNumber,
    bank: check.bank,
    dueDate: check.dueDate,
    status: check.status,
  };
}

export const recordPayment = firmMutation({
  args: {
    caseId: v.id('cases'),
    payerId: v.id('parties'),
    accountType: accountTypeValidator,
    amount: v.number(),
    method: paymentMethodValidator,
    date: v.number(),
    signatureRef: v.optional(v.string()),
    checkDetails: v.optional(
      v.object({
        checkNumber: v.string(),
        bank: v.string(),
        dueDate: v.number(),
      }),
    ),
  },
  returns: v.object({
    ledgerEntry: ledgerEntryDetailValidator,
    receipt: receiptDetailValidator,
    check: v.optional(checkDetailValidator),
  }),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    await requireAccessibleParty(ctx, ctx.firmId, args.payerId);
    if (args.method === 'check' && !args.checkDetails) {
      throw new AppError(ERROR_CODES.CHECK_DETAILS_REQUIRED);
    }

    // Receipt created FIRST so its _id is known before the ledger entry is
    // ever inserted — ledgerEntries is never patched (Global Constraints),
    // so refType/refId must be correct from the single insert call, not
    // backfilled after. remainingBalance is computed from the
    // pre-payment balance minus this payment; if appendLedgerEntry below
    // throws (bad amount, would-go-negative), the whole mutation —
    // including this receipt insert and the receiptNo incrementing it —
    // rolls back together (Global Constraints' atomicity guarantee), so a
    // receipt row is never left behind for a rejected payment.
    const receiptNo = await nextReceiptNo(ctx, ctx.firmId);
    const balanceBefore = await getFeeBalance(ctx, ctx.firmId, 'lawyer', caseDoc.primaryLawyerId);
    const remainingBalance = args.accountType === 'fee' ? balanceBefore - args.amount : balanceBefore;
    const now = Date.now();
    const receiptId = await ctx.db.insert('receipts', {
      firmId: ctx.firmId,
      caseId: args.caseId,
      receiptNo,
      payerId: args.payerId,
      amount: args.amount,
      method: args.method,
      date: args.date,
      remainingBalance,
      signatureRef: args.signatureRef,
      createdBy: ctx.userId,
      createdAt: now,
    });

    const ledgerEntryId = await appendLedgerEntry(ctx, ctx.firmId, caseDoc.primaryLawyerId, {
      caseId: args.caseId,
      accountType: args.accountType,
      personId: args.payerId,
      amount: args.amount,
      direction: 'credit',
      type: 'payment',
      refType: 'receipts',
      refId: receiptId,
      createdBy: ctx.userId,
    });

    let checkId = null;
    if (args.method === 'check' && args.checkDetails) {
      checkId = await createCheck(ctx, ctx.firmId, {
        receiptId,
        checkNumber: args.checkDetails.checkNumber,
        bank: args.checkDetails.bank,
        dueDate: args.checkDetails.dueDate,
      });
    }

    const ledgerEntry = await ctx.db.get('ledgerEntries', ledgerEntryId);
    const receipt = await ctx.db.get('receipts', receiptId);
    const check = checkId ? await ctx.db.get('checks', checkId) : null;
    if (!ledgerEntry || !receipt) throw new Error('unreachable: just inserted');

    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'receipts',
      entityId: receiptId,
      action: 'create',
      after: { caseId: args.caseId, payerId: args.payerId, amount: args.amount, method: args.method },
    });
    return {
      ledgerEntry: toLedgerEntryDetail(ledgerEntry),
      receipt: toReceiptDetail(receipt),
      check: check ? toCheckDetail(check) : undefined,
    };
  },
});

export const recordAdjustment = firmMutation({
  args: {
    caseId: v.id('cases'),
    personId: v.id('parties'),
    amount: v.number(),
    reason: v.string(),
  },
  returns: ledgerEntryDetailValidator,
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    await requireAccessibleParty(ctx, ctx.firmId, args.personId);

    const ledgerEntryId = await appendLedgerEntry(ctx, ctx.firmId, caseDoc.primaryLawyerId, {
      caseId: args.caseId,
      accountType: 'fee',
      personId: args.personId,
      amount: args.amount,
      direction: 'debit',
      type: 'adjustment',
      refType: 'manual',
      refId: '',
      createdBy: ctx.userId,
    });
    const ledgerEntry = await ctx.db.get('ledgerEntries', ledgerEntryId);
    if (!ledgerEntry) throw new Error('unreachable: just inserted');

    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'ledgerEntries',
      entityId: ledgerEntryId,
      action: 'recordAdjustment',
      after: { caseId: args.caseId, personId: args.personId, amount: args.amount, reason: args.reason },
    });
    return toLedgerEntryDetail(ledgerEntry);
  },
});

export const getWhoOwesWhom = firmQuery({
  args: { scope: financialCounterScopeValidator },
  returns: v.object({ scope: financialCounterScopeValidator, outstandingBalance: v.number() }),
  handler: async (ctx, args) => {
    if (args.scope === 'firm') {
      requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_READ_ALL);
      const outstandingBalance = await getFeeBalance(ctx, ctx.firmId, 'firm', undefined);
      return { scope: 'firm' as const, outstandingBalance };
    }
    requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_READ_OWN);
    const outstandingBalance = await getFeeBalance(ctx, ctx.firmId, 'lawyer', ctx.userId);
    return { scope: 'lawyer' as const, outstandingBalance };
  },
});
```

- [ ] **Step 6: Create the checks surface**

Create `convex/checks.ts`:

```typescript
import { v } from 'convex/values';
import { firmQuery, firmMutation } from './functions.ts';
import { requireAccessibleCase, requireLawyerScopedAccess } from './model/authz/owned.ts';
import {
  requireAccessibleCheck,
  markCheckDeposited,
  bounceCheck,
  clearCheck,
  listChecksForCase,
} from './model/billing/checks.ts';
import { ledgerEntryDetailValidator, toLedgerEntryDetail } from './payments.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { AppError, ERROR_CODES } from './lib/errors.ts';
import { literalUnion } from './lib/validators.ts';
import { PERMISSIONS, CHECK_STATUSES } from '@diwan/shared';

const checkStatusValidator = literalUnion(CHECK_STATUSES);

const checkDetailValidator = v.object({
  _id: v.id('checks'),
  receiptId: v.id('receipts'),
  checkNumber: v.string(),
  bank: v.string(),
  dueDate: v.number(),
  status: checkStatusValidator,
});

function toCheckDetail(check: {
  _id: import('./_generated/dataModel').Id<'checks'>;
  receiptId: import('./_generated/dataModel').Id<'receipts'>;
  checkNumber: string;
  bank: string;
  dueDate: number;
  status: (typeof CHECK_STATUSES)[number];
}) {
  return {
    _id: check._id,
    receiptId: check.receiptId,
    checkNumber: check.checkNumber,
    bank: check.bank,
    dueDate: check.dueDate,
    status: check.status,
  };
}

/** Loads the check's receipt and case, and applies the standard scope+action gate. Returns all three for reuse. */
async function loadCheckContext(
  ctx: Parameters<typeof requireAccessibleCheck>[0] & Parameters<typeof requireAccessibleCase>[0],
  firmId: import('./_generated/dataModel').Id<'firms'>,
  checkId: import('./_generated/dataModel').Id<'checks'>,
) {
  const check = await requireAccessibleCheck(ctx, firmId, checkId);
  const receipt = await ctx.db.get('receipts', check.receiptId);
  if (!receipt) throw new AppError(ERROR_CODES.RECEIPT_NOT_FOUND);
  const caseDoc = await requireAccessibleCase(ctx, firmId, receipt.caseId);
  requireLawyerScopedAccess(
    ctx,
    caseDoc.primaryLawyerId,
    PERMISSIONS.PAYMENTS_WRITE_OWN,
    PERMISSIONS.PAYMENTS_WRITE_ALL,
  );
  return { check, receipt, caseDoc };
}

export const markDeposited = firmMutation({
  args: { checkId: v.id('checks') },
  returns: checkDetailValidator,
  handler: async (ctx, args) => {
    const { check } = await loadCheckContext(ctx, ctx.firmId, args.checkId);
    await markCheckDeposited(ctx, check);
    const updated = await ctx.db.get('checks', check._id);
    if (!updated) throw new Error('unreachable: just patched');
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'checks',
      entityId: check._id,
      action: 'markDeposited',
      before: { status: check.status },
      after: { status: 'deposited' },
    });
    return toCheckDetail(updated);
  },
});

export const markCleared = firmMutation({
  args: { checkId: v.id('checks') },
  returns: checkDetailValidator,
  handler: async (ctx, args) => {
    const { check, receipt, caseDoc } = await loadCheckContext(ctx, ctx.firmId, args.checkId);
    await clearCheck(ctx, ctx.firmId, caseDoc.primaryLawyerId, receipt.caseId, check, ctx.userId);
    const updated = await ctx.db.get('checks', check._id);
    if (!updated) throw new Error('unreachable: just patched');
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'checks',
      entityId: check._id,
      action: 'markCleared',
      before: { status: check.status },
      after: { status: 'cleared' },
    });
    return toCheckDetail(updated);
  },
});

export const markBounced = firmMutation({
  args: { checkId: v.id('checks') },
  returns: v.object({ check: checkDetailValidator, reversingEntry: ledgerEntryDetailValidator, missionId: v.id('missions') }),
  handler: async (ctx, args) => {
    const { check, receipt, caseDoc } = await loadCheckContext(ctx, ctx.firmId, args.checkId);
    const { reversingEntryId, missionId } = await bounceCheck(
      ctx,
      ctx.firmId,
      caseDoc.primaryLawyerId,
      receipt.caseId,
      check,
      ctx.userId,
    );
    const updated = await ctx.db.get('checks', check._id);
    const reversingEntry = await ctx.db.get('ledgerEntries', reversingEntryId);
    if (!updated || !reversingEntry) throw new Error('unreachable: just inserted/patched');
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'checks',
      entityId: check._id,
      action: 'markBounced',
      before: { status: check.status },
      after: { status: 'bounced', reversingEntryId, missionId },
    });
    return { check: toCheckDetail(updated), reversingEntry: toLedgerEntryDetail(reversingEntry), missionId };
  },
});

export const listChecks = firmQuery({
  args: { caseId: v.id('cases') },
  returns: v.array(checkDetailValidator),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_READ_OWN,
      PERMISSIONS.PAYMENTS_READ_ALL,
    );
    const checks = await listChecksForCase(ctx, args.caseId);
    return checks.map(toCheckDetail);
  },
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun run test -- checks.test.ts payments.test.ts`
Expected: PASS (checks.test.ts: 7 tests; payments.test.ts: still 9 tests, unaffected by the recordPayment extension since `checkDetails`/`check` are both optional/additive).

- [ ] **Step 8: Regenerate Convex types and typecheck**

Run: `bunx convex dev --once && bun run check`
Expected: both exit cleanly.

- [ ] **Step 9: Commit**

```bash
git add convex/payments.ts convex/payments.test.ts convex/model/billing/checks.ts \
  convex/model/missions/createFromEvent.ts convex/checks.ts convex/checks.test.ts convex/_generated
git commit -m "feat: add check-method payments, check lifecycle, and the bounced-check cascade"
```

---

## Task 3: Refunds

**Files:**
- Modify: `convex/payments.ts` (add `recordRefund`)
- Modify: `convex/payments.test.ts` (append refund tests)

**Interfaces:**
- Consumes: `appendLedgerEntry` (Task 1); `ledgerEntryDetailValidator`, `toLedgerEntryDetail`, `accountTypeValidator` (Task 1, module-private in `convex/payments.ts` — same file, no cross-file import needed).
- Produces: `recordRefund` (`convex/payments.ts`) — no later task in this plan consumes it directly.

- [ ] **Step 1: Write the failing tests**

Modify `convex/payments.test.ts` — insert these tests directly before the final closing `});` of the `describe('payments', ...)` block:

```typescript
  test('recordRefund (debit) increases the outstanding balance back up', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2200');
    const payerId = await seedParty(t, owner, '900002001', 'Payer R1');
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 1000,
      reason: 'Fee charge',
    });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'fee',
      amount: 1000,
      method: 'cash',
      date: Date.now(),
    });

    const refund = await lawyer.authed.mutation(api.payments.recordRefund, {
      caseId,
      personId: payerId,
      accountType: 'fee',
      amount: 400,
      reason: 'Overcollected',
    });
    expect(refund.direction).toBe('debit');
    expect(refund.type).toBe('refund');

    const balance = await lawyer.authed.query(api.payments.getWhoOwesWhom, { scope: 'lawyer' });
    expect(balance.outstandingBalance).toBe(400);
  });

  test('a Secretary cannot recordRefund — writeAll but no approve', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2201');
    const payerId = await seedParty(t, owner, '900002002', 'Payer R2');

    await expectRejectedWithCode(
      secretary.authed.mutation(api.payments.recordRefund, {
        caseId,
        personId: payerId,
        accountType: 'fee',
        amount: 100,
        reason: 'Test',
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('an Accountant CAN recordRefund on any case — writeAll + approve', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const accountant = await addFirmMember(t, firmId, 'accountant', { name: 'Adam', email: 'adam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2202');
    const payerId = await seedParty(t, owner, '900002003', 'Payer R3');
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 500,
      reason: 'Fee charge',
    });

    const refund = await accountant.authed.mutation(api.payments.recordRefund, {
      caseId,
      personId: payerId,
      accountType: 'fee',
      amount: 200,
      reason: 'Goodwill adjustment',
    });
    expect(refund.amount).toBe(200);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- payments.test.ts`
Expected: FAIL — `api.payments.recordRefund` is undefined.

- [ ] **Step 3: Add recordRefund**

Modify `convex/payments.ts` — append this export at the end of the file:

```typescript

export const recordRefund = firmMutation({
  args: {
    caseId: v.id('cases'),
    personId: v.id('parties'),
    accountType: accountTypeValidator,
    amount: v.number(),
    reason: v.string(),
  },
  returns: ledgerEntryDetailValidator,
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_APPROVE);
    await requireAccessibleParty(ctx, ctx.firmId, args.personId);

    const ledgerEntryId = await appendLedgerEntry(ctx, ctx.firmId, caseDoc.primaryLawyerId, {
      caseId: args.caseId,
      accountType: args.accountType,
      personId: args.personId,
      amount: args.amount,
      direction: 'debit',
      type: 'refund',
      refType: 'manual',
      refId: '',
      createdBy: ctx.userId,
    });
    const ledgerEntry = await ctx.db.get('ledgerEntries', ledgerEntryId);
    if (!ledgerEntry) throw new Error('unreachable: just inserted');

    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'ledgerEntries',
      entityId: ledgerEntryId,
      action: 'recordRefund',
      after: { caseId: args.caseId, personId: args.personId, amount: args.amount, reason: args.reason },
    });
    return toLedgerEntryDetail(ledgerEntry);
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- payments.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Regenerate Convex types and typecheck**

Run: `bunx convex dev --once && bun run check`
Expected: both exit cleanly.

- [ ] **Step 6: Commit**

```bash
git add convex/payments.ts convex/payments.test.ts convex/_generated
git commit -m "feat: add payments recordRefund, gated on payments:approve"
```

---

## Task 4: Disbursement

**Files:**
- Create: `convex/model/billing/disbursement.ts`
- Modify: `convex/payments.ts` (add `disburse`)
- Modify: `convex/payments.test.ts` (append disbursement tests)

**Interfaces:**
- Consumes: `listPartiesForCase` (`convex/model/caseParties/caseParties.ts`, from Plan 1); `listChecksForCase` (Task 2, `model/billing/checks.ts`); `appendLedgerEntry`, `nextReceiptNo`, `getFeeBalance` (Task 1).
- Produces: `isPartyPlaintiffOnCase(ctx, caseId, partyId)`, `areCaseFundsCleared(ctx, caseId)` (`model/billing/disbursement.ts`) — no later task in this plan consumes these directly.

- [ ] **Step 1: Write the failing tests**

Modify `convex/payments.test.ts` — insert these tests directly before the final closing `});` of the `describe('payments', ...)` block:

```typescript
  test('disburse to a plaintiff succeeds when the case has no checks at all', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2300');
    const defendantId = await seedParty(t, owner, '900003001', 'Defendant D1');
    const plaintiffId = await seedParty(t, owner, '900003002', 'Plaintiff P1');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });

    const result = await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: plaintiffId,
      amount: 1000,
      method: 'cash',
      date: Date.now(),
    });
    expect(result.ledgerEntry.direction).toBe('debit');
    expect(result.ledgerEntry.accountType).toBe('trust');
    expect(result.receipt.receiptNo).toBe(1);
  });

  test('disburse to a plaintiff is blocked when a check on the case has not cleared', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2301');
    const defendantId = await seedParty(t, owner, '900003003', 'Defendant D2');
    const plaintiffId = await seedParty(t, owner, '900003004', 'Plaintiff P2');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'check',
      date: Date.now(),
      checkDetails: { checkNumber: 'CHK-900', bank: 'Bank of Palestine', dueDate: Date.now() + 86400000 },
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.disburse, {
        caseId,
        payerId: defendantId,
        payeeId: plaintiffId,
        amount: 1000,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.DISBURSEMENT_BLOCKED_UNCLEARED_FUNDS,
    );
  });

  test('disburse to a plaintiff succeeds with an overrideReason despite an uncleared check, and it is audited', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2302');
    const defendantId = await seedParty(t, owner, '900003005', 'Defendant D3');
    const plaintiffId = await seedParty(t, owner, '900003006', 'Plaintiff P3');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'check',
      date: Date.now(),
      checkDetails: { checkNumber: 'CHK-901', bank: 'Bank of Palestine', dueDate: Date.now() + 86400000 },
    });

    const result = await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: plaintiffId,
      amount: 1000,
      method: 'cash',
      date: Date.now(),
      overrideReason: 'Client urgently needs partial funds; firm accepts the risk.',
    });
    expect(result.receipt.amount).toBe(1000);

    const events = await t.run(async (ctx) =>
      ctx.db
        .query('auditLog')
        .withIndex('by_firm_entity', (q) => q.eq('firmId', firmId).eq('entityType', 'receipts').eq('entityId', result.receipt._id))
        .collect(),
    );
    expect(events.some((e) => e.action === 'disburseWithOverride')).toBe(true);
  });

  test('disburse to a NON-plaintiff payee is never blocked, even with uncleared checks', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2303');
    const defendantId = await seedParty(t, owner, '900003007', 'Defendant D4');
    const thirdPartyId = await seedParty(t, owner, '900003008', 'Court Fee Recipient');
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'check',
      date: Date.now(),
      checkDetails: { checkNumber: 'CHK-902', bank: 'Bank of Palestine', dueDate: Date.now() + 86400000 },
    });

    const result = await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: thirdPartyId,
      amount: 200,
      method: 'cash',
      date: Date.now(),
    });
    expect(result.receipt.amount).toBe(200);
  });

  test('a Secretary cannot disburse — writeAll but no approve', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2304');
    const defendantId = await seedParty(t, owner, '900003009', 'Defendant D5');
    const plaintiffId = await seedParty(t, owner, '900003010', 'Plaintiff P5');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });

    await expectRejectedWithCode(
      secretary.authed.mutation(api.payments.disburse, {
        caseId,
        payerId: defendantId,
        payeeId: plaintiffId,
        amount: 100,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- payments.test.ts`
Expected: FAIL — `api.payments.disburse` is undefined.

- [ ] **Step 3: Create the disbursement model helper**

Create `convex/model/billing/disbursement.ts`:

```typescript
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { listPartiesForCase } from '../caseParties/caseParties.ts';
import { listChecksForCase } from './checks.ts';

type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

/** The signal that marks a payment as a "disbursement" (design spec §2.3) rather than an ordinary payment. */
export async function isPartyPlaintiffOnCase(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
  partyId: Id<'parties'>,
): Promise<boolean> {
  const links = await listPartiesForCase(ctx, caseId);
  return links.some((link) => link.partyId === partyId && link.role === 'plaintiff');
}

/**
 * Conservative by design (design spec's implementation note): ANY
 * uncleared check on the case blocks disbursement to a plaintiff, not
 * just checks tied to trust-account entries specifically — erring toward
 * over-caution for money-safety, not under-caution. A case with zero
 * checks at all (e.g. cash-only trust deposits) is trivially cleared.
 */
export async function areCaseFundsCleared(ctx: ReadCtx, caseId: Id<'cases'>): Promise<boolean> {
  const checks = await listChecksForCase(ctx, caseId);
  return checks.every((check) => check.status === 'cleared');
}
```

- [ ] **Step 4: Add disburse**

Modify `convex/payments.ts` — add one new import line (`isPartyPlaintiffOnCase`, `areCaseFundsCleared` from the file just created):

```typescript
import { isPartyPlaintiffOnCase, areCaseFundsCleared } from './model/billing/disbursement.ts';
```

Then append this export at the end of the file:

```typescript

export const disburse = firmMutation({
  args: {
    caseId: v.id('cases'),
    payerId: v.id('parties'),
    payeeId: v.id('parties'),
    amount: v.number(),
    method: paymentMethodValidator,
    date: v.number(),
    signatureRef: v.optional(v.string()),
    overrideReason: v.optional(v.string()),
  },
  returns: v.object({ ledgerEntry: ledgerEntryDetailValidator, receipt: receiptDetailValidator }),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_APPROVE);
    await requireAccessibleParty(ctx, ctx.firmId, args.payerId);
    await requireAccessibleParty(ctx, ctx.firmId, args.payeeId);

    const isPlaintiff = await isPartyPlaintiffOnCase(ctx, args.caseId, args.payeeId);
    const usedOverride = isPlaintiff && Boolean(args.overrideReason);
    if (isPlaintiff && !args.overrideReason) {
      const fundsCleared = await areCaseFundsCleared(ctx, args.caseId);
      if (!fundsCleared) {
        throw new AppError(ERROR_CODES.DISBURSEMENT_BLOCKED_UNCLEARED_FUNDS);
      }
    }

    // Receipt created FIRST — same reasoning as recordPayment (Task 1):
    // ledgerEntries is never patched, so refType/refId must be correct
    // from the single insert call.
    const receiptNo = await nextReceiptNo(ctx, ctx.firmId);
    const now = Date.now();
    const receiptId = await ctx.db.insert('receipts', {
      firmId: ctx.firmId,
      caseId: args.caseId,
      receiptNo,
      payerId: args.payerId,
      payeeId: args.payeeId,
      amount: args.amount,
      method: args.method,
      date: args.date,
      remainingBalance: await getFeeBalance(ctx, ctx.firmId, 'lawyer', caseDoc.primaryLawyerId),
      signatureRef: args.signatureRef,
      createdBy: ctx.userId,
      createdAt: now,
    });

    const ledgerEntryId = await appendLedgerEntry(ctx, ctx.firmId, caseDoc.primaryLawyerId, {
      caseId: args.caseId,
      accountType: 'trust',
      personId: args.payeeId,
      amount: args.amount,
      direction: 'debit',
      type: 'payment',
      refType: 'receipts',
      refId: receiptId,
      createdBy: ctx.userId,
    });

    const ledgerEntry = await ctx.db.get('ledgerEntries', ledgerEntryId);
    const receipt = await ctx.db.get('receipts', receiptId);
    if (!ledgerEntry || !receipt) throw new Error('unreachable: just inserted');

    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'receipts',
      entityId: receiptId,
      action: usedOverride ? 'disburseWithOverride' : 'disburse',
      after: {
        caseId: args.caseId,
        payeeId: args.payeeId,
        amount: args.amount,
        overrideReason: args.overrideReason,
      },
    });
    return { ledgerEntry: toLedgerEntryDetail(ledgerEntry), receipt: toReceiptDetail(receipt) };
  },
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- payments.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 6: Regenerate Convex types and typecheck**

Run: `bunx convex dev --once && bun run check`
Expected: both exit cleanly.

- [ ] **Step 7: Commit**

```bash
git add convex/model/billing/disbursement.ts convex/payments.ts convex/payments.test.ts convex/_generated
git commit -m "feat: add payments disburse with plaintiff-role-triggered clear-funds block"
```

---

## Task 5: Installment plans

**Files:**
- Create: `convex/model/installments/installments.ts`
- Create: `convex/installments.ts`
- Create: `convex/installments.test.ts`

**Interfaces:**
- Consumes: `requireAccessibleCase`, `requireLawyerScopedAccess` (`convex/model/authz/owned.ts`); `INSTALLMENT_STATUSES` (`@diwan/shared`, Task 1).
- Produces: nothing consumed by later tasks in this plan — installments are self-contained; M3's notification escalation will read `installmentPlans` directly later.

- [ ] **Step 1: Write the failing tests**

Create `convex/installments.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

type Test = ReturnType<typeof makeTest>;
type Owner = Awaited<ReturnType<typeof bootstrapFirm>>['owner'];
type Member = Awaited<ReturnType<typeof addFirmMember>>;

async function seedCaseType(t: Test, owner: Owner) {
  return await owner.authed.mutation(api.caseTypes.create, {
    key: 'civil-claim',
    label: 'Civil Claim',
    requiredPartyRoles: ['plaintiff', 'defendant'],
    requiredDocumentChecklist: [],
  });
}

async function seedCase(t: Test, caseTypeId: string, lawyer: Member, internalNumber = 'C-2400') {
  return await lawyer.authed.mutation(api.cases.create, {
    internalNumber,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caseTypeId: caseTypeId as any,
    primaryLawyerId: lawyer.userId,
  });
}

describe('installments', () => {
  test('create + list: a future-dated installment is scheduled and not overdue', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);

    await lawyer.authed.mutation(api.installments.create, {
      caseId,
      amount: 500,
      dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    const listed = await lawyer.authed.query(api.installments.list, {
      caseId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page).toHaveLength(1);
    expect(listed.page[0]?.status).toBe('scheduled');
    expect(listed.page[0]?.overdue).toBe(false);
  });

  test('a past-due, still-scheduled installment is computed as overdue at read time', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);

    await lawyer.authed.mutation(api.installments.create, {
      caseId,
      amount: 300,
      dueDate: Date.now() - 24 * 60 * 60 * 1000,
    });

    const listed = await lawyer.authed.query(api.installments.list, {
      caseId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page[0]?.overdue).toBe(true);

    const stored = await t.run(async (ctx) => ctx.db.query('installmentPlans').withIndex('by_case', (q) => q.eq('caseId', caseId)).first());
    expect(stored?.status).toBe('scheduled');
  });

  test('markPaid: a past-due installment stops being overdue once paid', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const installmentPlanId = await lawyer.authed.mutation(api.installments.create, {
      caseId,
      amount: 300,
      dueDate: Date.now() - 24 * 60 * 60 * 1000,
    });

    await lawyer.authed.mutation(api.installments.markPaid, { installmentPlanId });

    const listed = await lawyer.authed.query(api.installments.list, {
      caseId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page[0]?.status).toBe('paid');
    expect(listed.page[0]?.overdue).toBe(false);
  });

  test('an Associate cannot create an installment plan — holds only payments:readOwn', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const caseId = await seedCase(t, caseTypeId, associate, 'C-2401');

    await expectRejectedWithCode(
      associate.authed.mutation(api.installments.create, { caseId, amount: 100, dueDate: Date.now() }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('a Secretary CAN create an installment plan on any lawyer\'s case (writeAll)', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2402');

    const installmentPlanId = await secretary.authed.mutation(api.installments.create, {
      caseId,
      amount: 100,
      dueDate: Date.now(),
    });
    expect(installmentPlanId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- installments.test.ts`
Expected: FAIL — `api.installments` is undefined.

- [ ] **Step 3: Create the installments model layer**

Create `convex/model/installments/installments.ts`:

```typescript
import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { PaginationOptions, PaginationResult } from 'convex/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

export interface CreateInstallmentPlanFields {
  caseId: Id<'cases'>;
  amount: number;
  dueDate: number;
}

export async function createInstallmentPlan(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  fields: CreateInstallmentPlanFields,
): Promise<Id<'installmentPlans'>> {
  const now = Date.now();
  return await ctx.db.insert('installmentPlans', {
    firmId,
    caseId: fields.caseId,
    amount: fields.amount,
    dueDate: fields.dueDate,
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
  });
}

export async function requireAccessibleInstallmentPlan(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  installmentPlanId: Id<'installmentPlans'>,
): Promise<Doc<'installmentPlans'>> {
  const plan = await ctx.db.get('installmentPlans', installmentPlanId);
  if (!plan || plan.firmId !== firmId) {
    throw new AppError(ERROR_CODES.INSTALLMENT_PLAN_NOT_FOUND);
  }
  return plan;
}

/** Stored status only ever transitions scheduled->paid (design spec §2.6) — 'overdue' is never written here. */
export async function markInstallmentPaid(ctx: WriteCtx, plan: Doc<'installmentPlans'>): Promise<void> {
  await ctx.db.patch('installmentPlans', plan._id, { status: 'paid', updatedAt: Date.now() });
}

export async function listInstallmentPlansForCase(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Doc<'installmentPlans'>>> {
  return await ctx.db
    .query('installmentPlans')
    .withIndex('by_case', (q) => q.eq('caseId', caseId))
    .paginate(paginationOpts);
}
```

- [ ] **Step 4: Create the installments surface**

Create `convex/installments.ts`:

```typescript
import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmQuery, firmMutation } from './functions.ts';
import { requireAccessibleCase, requireLawyerScopedAccess } from './model/authz/owned.ts';
import {
  createInstallmentPlan,
  requireAccessibleInstallmentPlan,
  markInstallmentPaid,
  listInstallmentPlansForCase,
} from './model/installments/installments.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { literalUnion } from './lib/validators.ts';
import { PERMISSIONS, INSTALLMENT_STATUSES } from '@diwan/shared';

const installmentStatusValidator = literalUnion(INSTALLMENT_STATUSES);

const installmentPlanDetailValidator = v.object({
  _id: v.id('installmentPlans'),
  caseId: v.id('cases'),
  amount: v.number(),
  dueDate: v.number(),
  status: installmentStatusValidator,
  overdue: v.boolean(),
});

function toInstallmentPlanDetail(plan: {
  _id: import('./_generated/dataModel').Id<'installmentPlans'>;
  caseId: import('./_generated/dataModel').Id<'cases'>;
  amount: number;
  dueDate: number;
  status: (typeof INSTALLMENT_STATUSES)[number];
}) {
  return {
    _id: plan._id,
    caseId: plan.caseId,
    amount: plan.amount,
    dueDate: plan.dueDate,
    status: plan.status,
    overdue: plan.status === 'scheduled' && plan.dueDate < Date.now(),
  };
}

export const create = firmMutation({
  args: { caseId: v.id('cases'), amount: v.number(), dueDate: v.number() },
  returns: v.id('installmentPlans'),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    const planId = await createInstallmentPlan(ctx, ctx.firmId, {
      caseId: args.caseId,
      amount: args.amount,
      dueDate: args.dueDate,
    });
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'installmentPlans',
      entityId: planId,
      action: 'create',
      after: { caseId: args.caseId, amount: args.amount, dueDate: args.dueDate },
    });
    return planId;
  },
});

export const markPaid = firmMutation({
  args: { installmentPlanId: v.id('installmentPlans') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const plan = await requireAccessibleInstallmentPlan(ctx, ctx.firmId, args.installmentPlanId);
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, plan.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    await markInstallmentPaid(ctx, plan);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'installmentPlans',
      entityId: plan._id,
      action: 'markPaid',
      before: { status: plan.status },
      after: { status: 'paid' },
    });
    return null;
  },
});

export const list = firmQuery({
  args: { caseId: v.id('cases'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(installmentPlanDetailValidator),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_READ_OWN,
      PERMISSIONS.PAYMENTS_READ_ALL,
    );
    const result = await listInstallmentPlansForCase(ctx, args.caseId, args.paginationOpts);
    return { ...result, page: result.page.map(toInstallmentPlanDetail) };
  },
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- installments.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Regenerate Convex types and typecheck**

Run: `bunx convex dev --once && bun run check`
Expected: both exit cleanly.

- [ ] **Step 7: Commit**

```bash
git add convex/model/installments/installments.ts convex/installments.ts convex/installments.test.ts convex/_generated
git commit -m "feat: add installment plans create/markPaid/list with computed overdue"
```

---

## Task 6: Case-level ledger reads, trust balance, and the reconciliation test

**Files:**
- Modify: `convex/model/billing/ledger.ts` (add `computeCaseTrustBalance`)
- Modify: `convex/payments.ts` (add `listLedgerForCase`, `getCaseTrustBalance`)
- Modify: `convex/payments.test.ts` (append trust-balance and reconciliation tests)

**Interfaces:**
- Consumes: `ledgerEntryDetailValidator`, `toLedgerEntryDetail` (Task 1, module-private in `convex/payments.ts`).
- Produces: `computeCaseTrustBalance(ctx, caseId)` (`model/billing/ledger.ts`) — this plan's final task; nothing downstream consumes it further.

- [ ] **Step 1: Write the failing tests**

Modify `convex/payments.test.ts` — insert these tests directly before the final closing `});` of the `describe('payments', ...)` block:

```typescript
  test('getCaseTrustBalance sums trust-account credits minus debits for the case, independent of financialCounters', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2401');
    const defendantId = await seedParty(t, owner, '900004001', 'Defendant T1');
    const plaintiffId = await seedParty(t, owner, '900004002', 'Plaintiff T1');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });

    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'cash',
      date: Date.now(),
    });
    await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: plaintiffId,
      amount: 2000,
      method: 'cash',
      date: Date.now(),
    });

    const trustBalance = await lawyer.authed.query(api.payments.getCaseTrustBalance, { caseId });
    expect(trustBalance).toBe(3000);
    // Trust movements never touch the fee-receivables counter.
    const feeBalance = await lawyer.authed.query(api.payments.getWhoOwesWhom, { scope: 'lawyer' });
    expect(feeBalance.outstandingBalance).toBe(0);
  });

  test('listLedgerForCase returns every ledger entry for the case, paginated', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2402');
    const payerId = await seedParty(t, owner, '900004003', 'Payer T2');
    await lawyer.authed.mutation(api.payments.recordAdjustment, { caseId, personId: payerId, amount: 300, reason: 'Charge' });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'fee',
      amount: 300,
      method: 'cash',
      date: Date.now(),
    });

    const listed = await lawyer.authed.query(api.payments.listLedgerForCase, {
      caseId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page).toHaveLength(2);
  });

  test('financialCounters (firm scope) stays consistent with a full re-sum of fee ledgerEntries after concurrent writes', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2403');
    const payerId = await seedParty(t, owner, '900004004', 'Payer Recon');
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 10000,
      reason: 'Bulk charge',
    });

    await Promise.all([
      ...Array.from({ length: 5 }, () =>
        lawyer.authed.mutation(api.payments.recordPayment, {
          caseId,
          payerId,
          accountType: 'fee',
          amount: 100,
          method: 'cash',
          date: Date.now(),
        }),
      ),
      ...Array.from({ length: 3 }, () =>
        lawyer.authed.mutation(api.payments.recordAdjustment, {
          caseId,
          personId: payerId,
          amount: 50,
          reason: 'Extra charge',
        }),
      ),
    ]);

    const trueSum = await t.run(async (ctx) => {
      const entries = await ctx.db
        .query('ledgerEntries')
        .withIndex('by_firm', (q) => q.eq('firmId', firmId))
        .collect();
      return entries
        .filter((e) => e.accountType === 'fee')
        .reduce((sum, e) => sum + (e.direction === 'credit' ? -e.amount : e.amount), 0);
    });

    const counterBalance = await owner.authed.query(api.payments.getWhoOwesWhom, { scope: 'firm' });
    expect(counterBalance.outstandingBalance).toBe(trueSum);
    expect(trueSum).toBe(10000 - 5 * 100 + 3 * 50);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- payments.test.ts`
Expected: FAIL — `api.payments.getCaseTrustBalance`/`listLedgerForCase` are undefined.

- [ ] **Step 3: Add computeCaseTrustBalance**

Modify `convex/model/billing/ledger.ts` — append this function at the end of the file:

```typescript

/**
 * A case's trust balance is a direct sum over its accountType:'trust'
 * ledger entries, computed on read — never pre-aggregated into
 * financialCounters (design spec §2.8). .collect() on by_case is bounded
 * to one case's entries, same precedent as listPartiesForCase/
 * computeChecklistStatus/listChecksForCase.
 */
export async function computeCaseTrustBalance(ctx: ReadCtx, caseId: Id<'cases'>): Promise<number> {
  const entries = await ctx.db
    .query('ledgerEntries')
    .withIndex('by_case', (q) => q.eq('caseId', caseId))
    .collect();
  return entries
    .filter((e) => e.accountType === 'trust')
    .reduce((sum, e) => sum + (e.direction === 'credit' ? e.amount : -e.amount), 0);
}
```

- [ ] **Step 4: Add listLedgerForCase and getCaseTrustBalance**

Modify `convex/payments.ts` — add `paginationOptsValidator, paginationResultValidator` to the top `convex/server` import (this file didn't need pagination before Task 6):

```typescript
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
```

Add `computeCaseTrustBalance` to the existing `model/billing/ledger.ts` import line (find `import { appendLedgerEntry } from './model/billing/ledger.ts';` and change it to):

```typescript
import { appendLedgerEntry, computeCaseTrustBalance } from './model/billing/ledger.ts';
```

Then append these exports at the end of the file:

```typescript

export const listLedgerForCase = firmQuery({
  args: { caseId: v.id('cases'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(ledgerEntryDetailValidator),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_READ_OWN,
      PERMISSIONS.PAYMENTS_READ_ALL,
    );
    const result = await ctx.db
      .query('ledgerEntries')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toLedgerEntryDetail) };
  },
});

export const getCaseTrustBalance = firmQuery({
  args: { caseId: v.id('cases') },
  returns: v.number(),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.PAYMENTS_READ_OWN,
      PERMISSIONS.PAYMENTS_READ_ALL,
    );
    return await computeCaseTrustBalance(ctx, args.caseId);
  },
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- payments.test.ts`
Expected: PASS (20 tests).

- [ ] **Step 6: Regenerate Convex types, typecheck, and run the full suite**

Run: `bunx convex dev --once && bun run check && bun run test`
Expected: all green — the full suite (Plans 1–2's tests + this plan's `payments.test.ts`/`checks.test.ts`/`installments.test.ts`) passes, not just this plan's files in isolation.

- [ ] **Step 7: Commit**

```bash
git add convex/model/billing/ledger.ts convex/payments.ts convex/payments.test.ts convex/_generated
git commit -m "feat: add listLedgerForCase, getCaseTrustBalance, and the fee-balance reconciliation test"
```

---

## Self-Review Notes

- **Spec coverage:** every design-spec section maps to a task above — §2.1 (advisory-only secretary approval: no code needed, absence is the implementation, verified by `recordPayment` never checking an approval state), §2.2 (`receiptCounters`, Task 1), §2.3 (`disburse`, Task 4), §2.4 (`createMissionFromEvent` + `bounceCheck`, Task 2), §2.5 (`recordRefund`, Task 3), §2.6 (computed `overdue`, Task 5), §2.7 (`appendLedgerEntry` choke point, Task 1), §2.8 (fee-receivables-only counters + `computeCaseTrustBalance`, Tasks 1 & 6). All 5 DoD criteria are directly tested (Task 1: append-only + receiptNo concurrency; Task 2: bounced cascade; Task 4: disbursement block; Task 6: reconciliation).
- **Cross-task consistency:** `ledgerEntryDetailValidator`/`toLedgerEntryDetail`/`receiptDetailValidator`/`toReceiptDetail`/`accountTypeValidator`/`paymentMethodValidator`/`financialCounterScopeValidator` are all defined once in Task 1 and reused by name (not redefined) in every later task's steps. The two-gate RBAC pattern (`requireAccessibleCase` + `requireLawyerScopedAccess` with `PAYMENTS_{READ,WRITE}_{OWN,ALL}`, plus `PAYMENTS_APPROVE` for refund/disburse) is applied identically across every case-scoped mutation/query in every task — no drift.
- **Placeholder scan:** no TBD/TODO markers; every step shows complete code.
- **Fixed during authoring, not left for review:** an initial draft of Task 1's `recordPayment` patched `ledgerEntries` after insert to backfill `refId` — caught during self-review as a direct violation of the Global Constraints' "never patched" rule (and the DoD's own append-only grep check would have failed against it). Fixed by creating the receipt first so its `_id` is known before the ledger entry is ever inserted. `listChecks`'s first draft paginated `checks.by_firm` before filtering by case, which would silently drop a case's checks whenever they didn't land on the scanned page — fixed to collect per-case via `listChecksForCase` (also caught the chance to DRY this against Task 4's funds-cleared check). `applyFeeBalanceDelta`'s first draft only guarded the firm-scope balance against going negative — reasoned through a concrete counter-example (one lawyer overpaying while others' positive balances mask it at the firm level) and fixed to guard both scopes independently. Several validators/type-annotations were hand-typed literal unions instead of importing the shared enum constants (`LEDGER_DIRECTIONS`, `LEDGER_ENTRY_TYPES`, `CHECK_STATUSES`) — fixed for consistency with the established "no enum gets hand-typed twice" convention.
