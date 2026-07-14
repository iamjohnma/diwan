import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmQuery, firmMutation } from './functions.ts';
import { requireCasePermission } from './model/authz/owned.ts';
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

function toInstallmentPlanDetail(
  plan: {
    _id: import('./_generated/dataModel').Id<'installmentPlans'>;
    caseId: import('./_generated/dataModel').Id<'cases'>;
    amount: number;
    dueDate: number;
    status: (typeof INSTALLMENT_STATUSES)[number];
  },
  asOf: number,
) {
  return {
    _id: plan._id,
    caseId: plan.caseId,
    amount: plan.amount,
    dueDate: plan.dueDate,
    status: plan.status,
    overdue: plan.status === 'scheduled' && plan.dueDate < asOf,
  };
}

export const create = firmMutation({
  args: { caseId: v.id('cases'), amount: v.number(), dueDate: v.number() },
  returns: v.id('installmentPlans'),
  handler: async (ctx, args) => {
    await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
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
    await requireCasePermission(
      ctx,
      ctx.firmId,
      plan.caseId,
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
  args: {
    caseId: v.id('cases'),
    asOf: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(installmentPlanDetailValidator),
  handler: async (ctx, args) => {
    await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.PAYMENTS_READ_OWN,
      PERMISSIONS.PAYMENTS_READ_ALL,
    );
    const result = await listInstallmentPlansForCase(ctx, args.caseId, args.paginationOpts);
    return {
      ...result,
      page: result.page.map((plan) => toInstallmentPlanDetail(plan, args.asOf)),
    };
  },
});
