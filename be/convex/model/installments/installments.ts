import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { PaginationOptions, PaginationResult } from 'convex/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { boundedPagination } from '../../lib/pagination.ts';

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
  if (fields.amount <= 0) {
    throw new AppError(ERROR_CODES.INVALID_INSTALLMENT_AMOUNT);
  }
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

/**
 * Stored status only ever transitions scheduled->paid (design spec §2.6)
 * — 'overdue' is never written here. Guards against re-patching an
 * already-paid plan: without this, calling markPaid twice silently
 * writes a duplicate, uninformative audit row every time.
 */
export async function markInstallmentPaid(ctx: WriteCtx, plan: Doc<'installmentPlans'>): Promise<void> {
  if (plan.status === 'paid') {
    throw new AppError(ERROR_CODES.INVALID_STATUS_TRANSITION);
  }
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
    .paginate(boundedPagination(paginationOpts));
}
