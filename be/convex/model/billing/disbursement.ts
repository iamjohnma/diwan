import type { Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { areAllChecksCleared } from './checks.ts';

type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

/** The signal that marks a payment as a "disbursement" (design spec §2.3) rather than an ordinary payment. */
export async function isPartyPlaintiffOnCase(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
  partyId: Id<'parties'>,
): Promise<boolean> {
  const link = await ctx.db
    .query('caseParties')
    .withIndex('by_case_party_role', (query) =>
      query.eq('caseId', caseId).eq('partyId', partyId).eq('role', 'plaintiff'),
    )
    .first();
  return link !== null;
}

/**
 * Conservative by design (design spec's implementation note): ANY
 * uncleared check on the case blocks disbursement to a plaintiff, not
 * just checks tied to trust-account entries specifically — erring toward
 * over-caution for money-safety, not under-caution. A case with zero
 * checks at all (e.g. cash-only trust deposits) is trivially cleared.
 */
export async function areCaseFundsCleared(ctx: ReadCtx, caseId: Id<'cases'>): Promise<boolean> {
  return await areAllChecksCleared(ctx, caseId);
}
