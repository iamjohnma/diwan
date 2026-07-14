import type { Id, Doc } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import type { PaginationResult } from 'convex/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { RBAC, PERMISSIONS, type PermissionString } from '@diwan/shared';

interface ScopedCtx {
  userId: Id<'users'>;
  permissions: ReadonlySet<PermissionString>;
}

// The Lawyer "own vs. assigned" pattern (PRD §6: Lawyer "own/assigned cases
// full access", Associate "assigned cases ... per assignment"). Owner's
// wildcard or the firm-wide "other/all" permission always passes;
// otherwise the caller must actually be the resource's lawyer AND hold the
// "own" permission. Centralized here so no handler hand-rolls an access
// decision — this is Diwan's equivalent of the reference's dentist-scoping
// helper, simplified: there is no separate "lawyers" identity table, so
// "own" is just ctx.userId === the resource's primaryLawyerId.
export function requireLawyerScopedAccess(
  ctx: ScopedCtx,
  resourceLawyerId: Id<'users'>,
  ownPermission: PermissionString,
  otherPermission: PermissionString,
): void {
  if (ctx.permissions.has(RBAC.OWNER_WILDCARD as PermissionString)) return;
  if (ctx.permissions.has(otherPermission)) return;
  if (ctx.userId === resourceLawyerId && ctx.permissions.has(ownPermission)) return;
  throw new AppError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
}

type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'> & ScopedCtx;

// Loads a case, verifies it belongs to the caller's firm and isn't
// soft-deleted, and applies the own-vs-all read scoping — the one place
// "can this caller see this case" is decided, so every M1+ handler that
// touches a case calls this instead of re-deriving the rule.
export async function requireAccessibleCase(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  caseId: Id<'cases'>,
): Promise<Doc<'cases'>> {
  const caseDoc = await ctx.db.get('cases', caseId);
  if (!caseDoc || caseDoc.firmId !== firmId || caseDoc.deletedAt !== undefined) {
    throw new AppError(ERROR_CODES.CASE_NOT_FOUND);
  }
  requireLawyerScopedAccess(
    ctx,
    caseDoc.primaryLawyerId,
    PERMISSIONS.CASES_READ_OWN,
    PERMISSIONS.CASES_READ_ALL,
  );
  return caseDoc;
}

/**
 * Applies the common parent-case read check and a domain-specific own/all
 * permission in one call. Callers still pass explicit permissions, so the
 * authorization rule remains visible at each entrypoint.
 */
export async function requireCasePermission(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  caseId: Id<'cases'>,
  ownPermission: PermissionString,
  otherPermission: PermissionString,
): Promise<Doc<'cases'>> {
  const caseDoc = await requireAccessibleCase(ctx, firmId, caseId);
  requireLawyerScopedAccess(ctx, caseDoc.primaryLawyerId, ownPermission, otherPermission);
  return caseDoc;
}

/**
 * Applies case inheritance to one already-paginated page. Convex permits one
 * paginate call per function, so callers keep the database cursor unchanged
 * and clients may receive a short page when inaccessible rows were filtered.
 */
export async function filterCaseScopedPage<TRow extends { caseId: Id<'cases'> }>(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  result: PaginationResult<TRow>,
): Promise<PaginationResult<TRow>> {
  const canReadAll =
    ctx.permissions.has(RBAC.OWNER_WILDCARD as PermissionString) ||
    ctx.permissions.has(PERMISSIONS.CASES_READ_ALL);
  const page: TRow[] = [];

  for (const row of result.page) {
    const caseDoc = await ctx.db.get('cases', row.caseId);
    if (!caseDoc || caseDoc.firmId !== firmId || caseDoc.deletedAt !== undefined) continue;
    if (
      canReadAll ||
      (ctx.userId === caseDoc.primaryLawyerId && ctx.permissions.has(PERMISSIONS.CASES_READ_OWN))
    ) {
      page.push(row);
    }
  }

  return { ...result, page };
}
