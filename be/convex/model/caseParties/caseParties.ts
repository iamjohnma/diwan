import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { PaginationOptions, PaginationResult } from 'convex/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { boundedPagination } from '../../lib/pagination.ts';
import { filterCaseScopedPage } from '../authz/owned.ts';
import type { PartyRole, PermissionString } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

interface ScopedCtx {
  userId: Id<'users'>;
  permissions: ReadonlySet<PermissionString>;
}

export interface AddCasePartyFields {
  role: PartyRole;
  representingLawyerId?: Id<'users'>;
  powerOfAttorneyRef?: string;
}

export async function addCaseParty(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  caseId: Id<'cases'>,
  partyId: Id<'parties'>,
  fields: AddCasePartyFields,
): Promise<Id<'caseParties'>> {
  const existing = await ctx.db
    .query('caseParties')
    .withIndex('by_case_party_role', (query) =>
      query.eq('caseId', caseId).eq('partyId', partyId).eq('role', fields.role),
    )
    .unique();
  if (existing) throw new AppError(ERROR_CODES.CASE_PARTY_ALREADY_EXISTS);

  return await ctx.db.insert('caseParties', {
    firmId,
    caseId,
    partyId,
    role: fields.role,
    representingLawyerId: fields.representingLawyerId,
    powerOfAttorneyRef: fields.powerOfAttorneyRef,
    createdAt: Date.now(),
  });
}

export async function listPartiesForCase(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Doc<'caseParties'>>> {
  return await ctx.db
    .query('caseParties')
    .withIndex('by_case', (q) => q.eq('caseId', caseId))
    .paginate(boundedPagination(paginationOpts));
}

/**
 * Case-level read-scoping for a party's caseParties links. Mirrors
 * requireAccessibleCase's own-vs-all rule (Owner wildcard OR
 * CASES_READ_ALL, OR caller is the case's primaryLawyerId AND holds
 * CASES_READ_OWN) so a caller can never enumerate case associations for a
 * case they aren't otherwise permitted to read — listForCase already
 * enforces this at the case level; this is the party-indexed counterpart.
 *
 * The underlying caseParties query is paginated (bounded by the caller's
 * own paginationOpts on the by_party index), and each row's case is then
 * checked for accessibility — a bounded per-page fan-out, not an unbounded
 * firm-wide scan.
 */
export async function listCasesForParty(
  ctx: ReadCtx & ScopedCtx,
  firmId: Id<'firms'>,
  partyId: Id<'parties'>,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Doc<'caseParties'>>> {
  const result = await ctx.db
    .query('caseParties')
    .withIndex('by_party', (q) => q.eq('partyId', partyId))
    .paginate(boundedPagination(paginationOpts));

  return await filterCaseScopedPage(ctx, firmId, result);
}
