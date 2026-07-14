import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmMutation, firmQuery, requireFirmPermission } from './functions.ts';
import { boundedPagination } from './lib/pagination.ts';
import { requireCasePermission } from './model/authz/owned.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { getFeeBalance } from './model/billing/aggregates.ts';
import {
  accountTypeValidator,
  checkDetailValidator,
  checkInputValidator,
  financialCounterScopeValidator,
  ledgerEntryDetailValidator,
  paymentMethodValidator,
  receiptDetailValidator,
  toCheckDetail,
  toLedgerEntryDetail,
  toReceiptDetail,
} from './model/billing/dto.ts';
import { appendLedgerEntry, computeCaseTrustBalance } from './model/billing/ledger.ts';
import {
  recordDisbursementFlow,
  recordPaymentFlow,
  recordRefundFlow,
} from './model/billing/paymentFlows.ts';
import { requireAccessibleParty } from './model/parties/parties.ts';
import { PERMISSIONS } from '@diwan/shared';

export const recordPayment = firmMutation({
  args: {
    caseId: v.id('cases'),
    payerId: v.id('parties'),
    accountType: accountTypeValidator,
    amount: v.number(),
    method: paymentMethodValidator,
    date: v.number(),
    signatureRef: v.optional(v.string()),
    checkDetails: v.optional(checkInputValidator),
  },
  returns: v.object({
    ledgerEntry: ledgerEntryDetailValidator,
    receipt: receiptDetailValidator,
    check: v.optional(checkDetailValidator),
  }),
  handler: async (ctx, args) => {
    const caseDoc = await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    await requireAccessibleParty(ctx, ctx.firmId, args.payerId);

    const result = await recordPaymentFlow(ctx, {
      ...args,
      firmId: ctx.firmId,
      actorId: ctx.userId,
      lawyerId: caseDoc.primaryLawyerId,
    });
    return {
      ledgerEntry: toLedgerEntryDetail(result.ledgerEntry),
      receipt: toReceiptDetail(result.receipt),
      check: result.check ? toCheckDetail(result.check) : undefined,
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
    const caseDoc = await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    await requireAccessibleParty(ctx, ctx.firmId, args.personId);

    const ledgerEntry = await appendLedgerEntry(ctx, ctx.firmId, caseDoc.primaryLawyerId, {
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
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'ledgerEntries',
      entityId: ledgerEntry._id,
      action: 'recordAdjustment',
      after: {
        caseId: args.caseId,
        personId: args.personId,
        amount: args.amount,
        reason: args.reason,
      },
    });
    return toLedgerEntryDetail(ledgerEntry);
  },
});

export const getWhoOwesWhom = firmQuery({
  args: { scope: financialCounterScopeValidator },
  returns: v.object({
    scope: financialCounterScopeValidator,
    outstandingBalance: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.scope === 'firm') {
      requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_READ_ALL);
      return {
        scope: 'firm' as const,
        outstandingBalance: await getFeeBalance(ctx, ctx.firmId, 'firm', undefined),
      };
    }
    requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_READ_OWN);
    return {
      scope: 'lawyer' as const,
      outstandingBalance: await getFeeBalance(ctx, ctx.firmId, 'lawyer', ctx.userId),
    };
  },
});

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
    const caseDoc = await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_APPROVE);
    await requireAccessibleParty(ctx, ctx.firmId, args.personId);

    const ledgerEntry = await recordRefundFlow(ctx, {
      ...args,
      firmId: ctx.firmId,
      actorId: ctx.userId,
      lawyerId: caseDoc.primaryLawyerId,
    });
    return toLedgerEntryDetail(ledgerEntry);
  },
});

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
  returns: v.object({
    ledgerEntry: ledgerEntryDetailValidator,
    receipt: receiptDetailValidator,
  }),
  handler: async (ctx, args) => {
    const caseDoc = await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.PAYMENTS_WRITE_OWN,
      PERMISSIONS.PAYMENTS_WRITE_ALL,
    );
    requireFirmPermission(ctx, PERMISSIONS.PAYMENTS_APPROVE);
    await requireAccessibleParty(ctx, ctx.firmId, args.payerId);
    await requireAccessibleParty(ctx, ctx.firmId, args.payeeId);

    const result = await recordDisbursementFlow(ctx, {
      ...args,
      firmId: ctx.firmId,
      actorId: ctx.userId,
      lawyerId: caseDoc.primaryLawyerId,
    });
    return {
      ledgerEntry: toLedgerEntryDetail(result.ledgerEntry),
      receipt: toReceiptDetail(result.receipt),
    };
  },
});

export const listLedgerForCase = firmQuery({
  args: {
    caseId: v.id('cases'),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(ledgerEntryDetailValidator),
  handler: async (ctx, args) => {
    await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.PAYMENTS_READ_OWN,
      PERMISSIONS.PAYMENTS_READ_ALL,
    );
    const result = await ctx.db
      .query('ledgerEntries')
      .withIndex('by_case', (query) => query.eq('caseId', args.caseId))
      .paginate(boundedPagination(args.paginationOpts));
    return { ...result, page: result.page.map(toLedgerEntryDetail) };
  },
});

export const getCaseTrustBalance = firmQuery({
  args: { caseId: v.id('cases') },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.PAYMENTS_READ_OWN,
      PERMISSIONS.PAYMENTS_READ_ALL,
    );
    return await computeCaseTrustBalance(ctx, args.caseId);
  },
});
