import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { applyFeeBalanceDelta } from './aggregates.ts';
import type { LedgerAccountType, LedgerDirection, LedgerEntryType } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;
type CaseAccountType = Exclude<LedgerAccountType, 'fee'>;

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

export type PersistedLedgerEntry = Omit<Doc<'ledgerEntries'>, '_creationTime'>;

async function applyCaseAccountBalanceDelta(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  caseId: Id<'cases'>,
  accountType: CaseAccountType,
  delta: number,
): Promise<void> {
  const existing = await ctx.db
    .query('caseAccountBalances')
    .withIndex('by_case_account_type', (query) =>
      query.eq('caseId', caseId).eq('accountType', accountType),
    )
    .unique();
  const updatedAt = Date.now();
  if (existing) {
    await ctx.db.patch('caseAccountBalances', existing._id, {
      balance: existing.balance + delta,
      updatedAt,
    });
    return;
  }

  await ctx.db.insert('caseAccountBalances', {
    firmId,
    caseId,
    accountType,
    balance: delta,
    updatedAt,
  });
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
): Promise<PersistedLedgerEntry> {
  if (fields.amount <= 0) {
    throw new AppError(ERROR_CODES.INVALID_LEDGER_AMOUNT);
  }
  if (fields.accountType === 'fee') {
    const delta = fields.direction === 'credit' ? -fields.amount : fields.amount;
    await applyFeeBalanceDelta(ctx, firmId, lawyerId, delta, true);
  } else {
    const delta = fields.direction === 'credit' ? fields.amount : -fields.amount;
    await applyCaseAccountBalanceDelta(ctx, firmId, fields.caseId, fields.accountType, delta);
  }
  const values = {
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
  };
  const _id = await ctx.db.insert('ledgerEntries', values);
  return { _id, ...values };
}

/**
 * Traces a ledgerEntries row back from the record that caused it (e.g. a
 * receipt or a check).
 *
 * Manual entries intentionally have no external record to trace back to and
 * must not be looked up through this helper.
 */
export async function findLedgerEntryByRef(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  refType: string,
  refId: string,
): Promise<Doc<'ledgerEntries'> | null> {
  const entry = await ctx.db
    .query('ledgerEntries')
    .withIndex('by_firm_ref_type_ref_id', (q) =>
      q.eq('firmId', firmId).eq('refType', refType).eq('refId', refId),
    )
    .unique();
  return entry;
}

/**
 * Trust/client balances use a transactionally maintained per-case counter.
 * The append-only ledger remains the reconciliation source of truth.
 */
export async function computeCaseAccountBalance(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
  accountType: CaseAccountType,
): Promise<number> {
  const counter = await ctx.db
    .query('caseAccountBalances')
    .withIndex('by_case_account_type', (query) =>
      query.eq('caseId', caseId).eq('accountType', accountType),
    )
    .unique();
  return counter?.balance ?? 0;
}

export async function computeCaseTrustBalance(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
): Promise<number> {
  return await computeCaseAccountBalance(ctx, caseId, 'trust');
}
