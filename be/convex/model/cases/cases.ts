import type { PaginationOptions, PaginationResult } from 'convex/server';
import {
  type CaseStatus,
  PERMISSIONS,
  type PermissionString,
  RBAC
} from '@diwan/shared';
import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { boundedPagination } from '../../lib/pagination.ts';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText.ts';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

export interface CaseStatusCounts {
  intake: number;
  filed: number;
  in_hearings: number;
  verdict: number;
  execution: number;
  closed: number;
  archived: number;
}

interface ScopedCtx {
  userId: Id<'users'>;
  permissions: ReadonlySet<PermissionString>;
}

/**
 * Linear lifecycle, matching IMPLEMENTATION_PLAN.md §2's
 * "Intake→Filed→InHearings→Verdict→Execution→Closed→Archived" exactly.
 * Not a graph — each status has exactly one legal next status. Revisit if a
 * pilot firm needs postponement/reopen transitions that skip backwards.
 */
const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus | null> = {
  intake: 'filed',
  filed: 'in_hearings',
  in_hearings: 'verdict',
  verdict: 'execution',
  execution: 'closed',
  closed: 'archived',
  archived: null
};

function emptyCaseStatusCounts(): CaseStatusCounts {
  return {
    intake: 0,
    filed: 0,
    in_hearings: 0,
    verdict: 0,
    execution: 0,
    closed: 0,
    archived: 0
  };
}

async function updateCaseTableMetric(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  primaryLawyerId: Id<'users'> | undefined,
  update: (current: { total: number; statusCounts: CaseStatusCounts }) => {
    total: number;
    statusCounts: CaseStatusCounts;
  }
): Promise<void> {
  const scope = primaryLawyerId === undefined ? 'firm' : 'lawyer';
  const metric =
    scope === 'firm'
      ? await ctx.db
          .query('caseTableMetrics')
          .withIndex('by_firm_and_scope', (q) =>
            q.eq('firmId', firmId).eq('scope', scope)
          )
          .unique()
      : await ctx.db
          .query('caseTableMetrics')
          .withIndex('by_firm_and_scope_and_lawyer', (q) =>
            q
              .eq('firmId', firmId)
              .eq('scope', scope)
              .eq('primaryLawyerId', primaryLawyerId)
          )
          .unique();
  const next = update({
    total: metric?.total ?? 0,
    statusCounts: metric?.statusCounts ?? emptyCaseStatusCounts()
  });
  const normalized = {
    total: Math.max(0, next.total),
    statusCounts: {
      intake: Math.max(0, next.statusCounts.intake),
      filed: Math.max(0, next.statusCounts.filed),
      in_hearings: Math.max(0, next.statusCounts.in_hearings),
      verdict: Math.max(0, next.statusCounts.verdict),
      execution: Math.max(0, next.statusCounts.execution),
      closed: Math.max(0, next.statusCounts.closed),
      archived: Math.max(0, next.statusCounts.archived)
    },
    updatedAt: Date.now()
  };

  if (metric) {
    await ctx.db.patch('caseTableMetrics', metric._id, normalized);
    return;
  }

  await ctx.db.insert('caseTableMetrics', {
    firmId,
    scope,
    primaryLawyerId,
    ...normalized
  });
}

async function incrementCaseMetrics(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  primaryLawyerId: Id<'users'>,
  status: CaseStatus,
  delta: 1 | -1
): Promise<void> {
  const update = (current: {
    total: number;
    statusCounts: CaseStatusCounts;
  }) => ({
    total: current.total + delta,
    statusCounts: {
      ...current.statusCounts,
      [status]: current.statusCounts[status] + delta
    }
  });
  await updateCaseTableMetric(ctx, firmId, undefined, update);
  await updateCaseTableMetric(ctx, firmId, primaryLawyerId, update);
}

async function transitionCaseMetrics(
  ctx: WriteCtx,
  caseDoc: Doc<'cases'>,
  nextStatus: CaseStatus
): Promise<void> {
  const update = (current: {
    total: number;
    statusCounts: CaseStatusCounts;
  }) => ({
    total: current.total,
    statusCounts: {
      ...current.statusCounts,
      [caseDoc.status]: current.statusCounts[caseDoc.status] - 1,
      [nextStatus]: current.statusCounts[nextStatus] + 1
    }
  });
  await updateCaseTableMetric(ctx, caseDoc.firmId, undefined, update);
  await updateCaseTableMetric(
    ctx,
    caseDoc.firmId,
    caseDoc.primaryLawyerId,
    update
  );
}

function requireValidStatusTransition(from: CaseStatus, to: CaseStatus): void {
  if (CASE_STATUS_TRANSITIONS[from] !== to) {
    throw new AppError(ERROR_CODES.INVALID_STATUS_TRANSITION);
  }
}

/** Creation has no existing resource to scope against — a Lawyer/Associate
 * may only assign themselves as primaryLawyerId; Secretary/Owner (holding
 * the firm-wide write permission) may assign any lawyer, for intake. */
export function requireCanAssignLawyer(
  ctx: ScopedCtx,
  primaryLawyerId: Id<'users'>
): void {
  if (ctx.permissions.has(RBAC.OWNER_WILDCARD as PermissionString)) return;
  if (ctx.permissions.has(PERMISSIONS.CASES_WRITE_ALL)) return;
  if (
    ctx.userId === primaryLawyerId &&
    ctx.permissions.has(PERMISSIONS.CASES_WRITE_OWN)
  )
    return;
  throw new AppError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
}

export interface CreateCaseFields {
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseTypeId: Id<'caseTypes'>;
  claimAmount?: number;
  primaryLawyerId: Id<'users'>;
}

// Every case starts life at 'intake' — the actual start of the lifecycle
// (IMPLEMENTATION_PLAN.md's status sequence). Deliberately not a
// caller-suppliable field: exposing it would let a caller bypass the
// CASES_CLOSE gate and the linear transition-graph validation that
// updateCaseStatus enforces for every subsequent transition.
export async function createCase(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  fields: CreateCaseFields
): Promise<Id<'cases'>> {
  const now = Date.now();
  const caseId = await ctx.db.insert('cases', {
    firmId,
    internalNumber: fields.internalNumber,
    courtNumber: fields.courtNumber,
    courtName: fields.courtName,
    caseTypeId: fields.caseTypeId,
    claimAmount: fields.claimAmount,
    primaryLawyerId: fields.primaryLawyerId,
    status: 'intake',
    searchText: normalizeSearchText(fields.internalNumber),
    createdAt: now,
    updatedAt: now
  });
  await incrementCaseMetrics(ctx, firmId, fields.primaryLawyerId, 'intake', 1);
  return caseId;
}

export async function updateCaseStatus(
  ctx: WriteCtx,
  caseDoc: Doc<'cases'>,
  nextStatus: CaseStatus
): Promise<void> {
  requireValidStatusTransition(caseDoc.status, nextStatus);
  await ctx.db.patch('cases', caseDoc._id, {
    status: nextStatus,
    updatedAt: Date.now()
  });
  await transitionCaseMetrics(ctx, caseDoc, nextStatus);
}

export async function softDeleteCase(
  ctx: WriteCtx,
  caseDoc: Doc<'cases'>
): Promise<void> {
  await ctx.db.patch('cases', caseDoc._id, {
    deletedAt: Date.now(),
    updatedAt: Date.now()
  });
  await incrementCaseMetrics(
    ctx,
    caseDoc.firmId,
    caseDoc.primaryLawyerId,
    caseDoc.status,
    -1
  );
}

/**
 * Own-vs-all scoping for the firm's case list. Unlike a single-resource
 * check (requireLawyerScopedAccess), there's no one case to inspect yet —
 * the permission set alone decides which index-backed query to run.
 */
export async function listCasesForCaller(
  ctx: ReadCtx & ScopedCtx,
  firmId: Id<'firms'>,
  paginationOpts: PaginationOptions
): Promise<PaginationResult<Doc<'cases'>>> {
  if (
    ctx.permissions.has(RBAC.OWNER_WILDCARD as PermissionString) ||
    ctx.permissions.has(PERMISSIONS.CASES_READ_ALL)
  ) {
    return await ctx.db
      .query('cases')
      .withIndex('by_firm_deleted_created', (q) =>
        q.eq('firmId', firmId).eq('deletedAt', undefined)
      )
      .paginate(boundedPagination(paginationOpts));
  }
  if (ctx.permissions.has(PERMISSIONS.CASES_READ_OWN)) {
    return await ctx.db
      .query('cases')
      .withIndex('by_firm_lawyer_deleted_created', (q) =>
        q
          .eq('firmId', firmId)
          .eq('primaryLawyerId', ctx.userId)
          .eq('deletedAt', undefined)
      )
      .paginate(boundedPagination(paginationOpts));
  }
  throw new AppError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
}

/**
 * Referential-integrity guard for case creation/reassignment: a
 * primaryLawyerId must actually be an active member of the firm the case
 * belongs to, not merely any Id<'users'> the caller happens to pass.
 * Mirrors loadMemberContext's by_firm_user index usage
 * (convex/model/authz/memberContext.ts) but only needs the membership row
 * itself, not the full permission-resolution pipeline.
 */
export async function requireLawyerIsFirmMember(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  lawyerUserId: Id<'users'>
): Promise<void> {
  const member = await ctx.db
    .query('firmMembers')
    .withIndex('by_firm_user', (q) =>
      q.eq('firmId', firmId).eq('userId', lawyerUserId)
    )
    .unique();
  if (!member || member.status !== 'active' || member.deletedAt !== undefined) {
    throw new AppError(ERROR_CODES.NOT_A_FIRM_MEMBER);
  }
}
