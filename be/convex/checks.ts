import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmMutation, firmQuery } from './functions.ts';
import { requireCasePermission } from './model/authz/owned.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import {
  bounceCheck,
  clearCheck,
  listChecksForCase,
  markCheckDeposited,
  requirePaymentCheckAccess,
} from './model/billing/checks.ts';
import {
  checkDetailValidator,
  ledgerEntryDetailValidator,
  toCheckDetail,
  toLedgerEntryDetail,
} from './model/billing/dto.ts';
import { PERMISSIONS } from '@diwan/shared';

export const markDeposited = firmMutation({
  args: { checkId: v.id('checks') },
  returns: checkDetailValidator,
  handler: async (ctx, args) => {
    const { check } = await requirePaymentCheckAccess(ctx, ctx.firmId, args.checkId);
    const updated = await markCheckDeposited(ctx, check);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'checks',
      entityId: check._id,
      action: 'markDeposited',
      before: { status: check.status },
      after: { status: updated.status },
    });
    return toCheckDetail(updated);
  },
});

export const markCleared = firmMutation({
  args: { checkId: v.id('checks') },
  returns: checkDetailValidator,
  handler: async (ctx, args) => {
    const { check, caseDoc } = await requirePaymentCheckAccess(
      ctx,
      ctx.firmId,
      args.checkId,
    );
    const result = await clearCheck(
      ctx,
      ctx.firmId,
      caseDoc.primaryLawyerId,
      check.caseId,
      check,
      ctx.userId,
    );
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'checks',
      entityId: check._id,
      action: 'markCleared',
      before: { status: check.status },
      after: {
        status: result.check.status,
        ...(result.reinstatementEntry
          ? { reinstatementEntryId: result.reinstatementEntry._id }
          : {}),
      },
    });
    return toCheckDetail(result.check);
  },
});

export const markBounced = firmMutation({
  args: { checkId: v.id('checks') },
  returns: v.object({
    check: checkDetailValidator,
    reversingEntry: ledgerEntryDetailValidator,
    missionId: v.id('missions'),
  }),
  handler: async (ctx, args) => {
    const { check, caseDoc } = await requirePaymentCheckAccess(
      ctx,
      ctx.firmId,
      args.checkId,
    );
    const result = await bounceCheck(
      ctx,
      ctx.firmId,
      caseDoc.primaryLawyerId,
      check.caseId,
      check,
      ctx.userId,
    );
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'checks',
      entityId: check._id,
      action: 'markBounced',
      before: { status: check.status },
      after: {
        status: result.check.status,
        reversingEntryId: result.reversingEntry._id,
        missionId: result.missionId,
      },
    });
    return {
      check: toCheckDetail(result.check),
      reversingEntry: toLedgerEntryDetail(result.reversingEntry),
      missionId: result.missionId,
    };
  },
});

export const listChecks = firmQuery({
  args: {
    caseId: v.id('cases'),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(checkDetailValidator),
  handler: async (ctx, args) => {
    await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.PAYMENTS_READ_OWN,
      PERMISSIONS.PAYMENTS_READ_ALL,
    );
    const result = await listChecksForCase(ctx, args.caseId, args.paginationOpts);
    return { ...result, page: result.page.map(toCheckDetail) };
  },
});
