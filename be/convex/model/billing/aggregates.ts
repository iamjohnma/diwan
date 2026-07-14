import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import type { FinancialCounterScope } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
// Mirrors ledger.ts's ReadCtx — getFeeBalance is read-only and must be
// callable from both firmQuery (getWhoOwesWhom) and firmMutation
// (recordPayment's remainingBalance calc) contexts. Unlike WriteCtx's
// getOrCreateCounter, this path never inserts: a query's ctx.db has no
// write methods at all (Convex enforces queries as read-only), so a
// missing counter row must simply read as balance 0, not be created.
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

interface CounterRow {
  id: Id<'financialCounters'>;
  outstandingBalance: number;
}

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
