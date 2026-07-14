import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { recordAuditEvent } from '../audit/recordAuditEvent.ts';
import { getFeeBalance } from './aggregates.ts';
import { createCheck, type PersistedCheck } from './checks.ts';
import { areCaseFundsCleared, isPartyPlaintiffOnCase } from './disbursement.ts';
import {
  appendLedgerEntry,
  computeCaseAccountBalance,
  computeCaseTrustBalance,
  type PersistedLedgerEntry,
} from './ledger.ts';
import type { LedgerAccountType, PaymentMethod } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;

export type PersistedReceipt = Omit<Doc<'receipts'>, '_creationTime'>;

interface CheckInput {
  checkNumber: string;
  bank: string;
  dueDate: number;
}

async function nextReceiptNo(ctx: WriteCtx, firmId: Id<'firms'>): Promise<number> {
  const existing = await ctx.db
    .query('receiptCounters')
    .withIndex('by_firm', (query) => query.eq('firmId', firmId))
    .unique();
  const now = Date.now();
  if (!existing) {
    await ctx.db.insert('receiptCounters', { firmId, nextReceiptNo: 2, updatedAt: now });
    return 1;
  }
  await ctx.db.patch('receiptCounters', existing._id, {
    nextReceiptNo: existing.nextReceiptNo + 1,
    updatedAt: now,
  });
  return existing.nextReceiptNo;
}

interface RecordPaymentFields {
  firmId: Id<'firms'>;
  actorId: Id<'users'>;
  lawyerId: Id<'users'>;
  caseId: Id<'cases'>;
  payerId: Id<'parties'>;
  accountType: LedgerAccountType;
  amount: number;
  method: PaymentMethod;
  date: number;
  signatureRef?: string;
  checkDetails?: CheckInput;
}

export interface RecordPaymentResult {
  ledgerEntry: PersistedLedgerEntry;
  receipt: PersistedReceipt;
  check?: PersistedCheck;
}

export async function recordPaymentFlow(
  ctx: WriteCtx,
  fields: RecordPaymentFields,
): Promise<RecordPaymentResult> {
  if (fields.method === 'check' && !fields.checkDetails) {
    throw new AppError(ERROR_CODES.CHECK_DETAILS_REQUIRED);
  }

  const receiptNo = await nextReceiptNo(ctx, fields.firmId);
  const remainingBalance =
    fields.accountType === 'fee'
      ? (await getFeeBalance(ctx, fields.firmId, 'lawyer', fields.lawyerId)) - fields.amount
      : (await computeCaseAccountBalance(ctx, fields.caseId, fields.accountType)) + fields.amount;
  const createdAt = Date.now();
  const receiptValues: Omit<PersistedReceipt, '_id'> = {
    firmId: fields.firmId,
    caseId: fields.caseId,
    receiptNo,
    payerId: fields.payerId,
    amount: fields.amount,
    method: fields.method,
    date: fields.date,
    remainingBalance,
    signatureRef: fields.signatureRef,
    createdBy: fields.actorId,
    createdAt,
  };
  const receiptId = await ctx.db.insert('receipts', receiptValues);
  const receipt = { _id: receiptId, ...receiptValues };

  const ledgerEntry = await appendLedgerEntry(ctx, fields.firmId, fields.lawyerId, {
    caseId: fields.caseId,
    accountType: fields.accountType,
    personId: fields.payerId,
    amount: fields.amount,
    direction: 'credit',
    type: 'payment',
    refType: 'receipts',
    refId: receiptId,
    createdBy: fields.actorId,
  });

  const check = fields.method === 'check' && fields.checkDetails
    ? await createCheck(ctx, receipt, fields.checkDetails)
    : undefined;

  await recordAuditEvent(ctx, {
    firmId: fields.firmId,
    actorId: fields.actorId,
    entityType: 'receipts',
    entityId: receiptId,
    action: 'create',
    after: {
      caseId: fields.caseId,
      payerId: fields.payerId,
      amount: fields.amount,
      method: fields.method,
    },
  });

  return { ledgerEntry, receipt, check };
}

interface RecordRefundFields {
  firmId: Id<'firms'>;
  actorId: Id<'users'>;
  lawyerId: Id<'users'>;
  caseId: Id<'cases'>;
  personId: Id<'parties'>;
  accountType: LedgerAccountType;
  amount: number;
  reason: string;
}

export async function recordRefundFlow(
  ctx: WriteCtx,
  fields: RecordRefundFields,
): Promise<PersistedLedgerEntry> {
  if (fields.accountType !== 'fee') {
    const currentBalance = await computeCaseAccountBalance(
      ctx,
      fields.caseId,
      fields.accountType,
    );
    if (fields.amount > currentBalance) {
      throw new AppError(
        fields.accountType === 'trust'
          ? ERROR_CODES.INSUFFICIENT_TRUST_BALANCE
          : ERROR_CODES.INSUFFICIENT_CLIENT_BALANCE,
      );
    }
  }

  const ledgerEntry = await appendLedgerEntry(ctx, fields.firmId, fields.lawyerId, {
    caseId: fields.caseId,
    accountType: fields.accountType,
    personId: fields.personId,
    amount: fields.amount,
    direction: 'debit',
    type: 'refund',
    refType: 'manual',
    refId: '',
    createdBy: fields.actorId,
  });

  await recordAuditEvent(ctx, {
    firmId: fields.firmId,
    actorId: fields.actorId,
    entityType: 'ledgerEntries',
    entityId: ledgerEntry._id,
    action: 'recordRefund',
    after: {
      caseId: fields.caseId,
      personId: fields.personId,
      amount: fields.amount,
      reason: fields.reason,
    },
  });

  return ledgerEntry;
}

interface RecordDisbursementFields {
  firmId: Id<'firms'>;
  actorId: Id<'users'>;
  lawyerId: Id<'users'>;
  caseId: Id<'cases'>;
  payerId: Id<'parties'>;
  payeeId: Id<'parties'>;
  amount: number;
  method: PaymentMethod;
  date: number;
  signatureRef?: string;
  overrideReason?: string;
}

export interface RecordDisbursementResult {
  ledgerEntry: PersistedLedgerEntry;
  receipt: PersistedReceipt;
}

export async function recordDisbursementFlow(
  ctx: WriteCtx,
  fields: RecordDisbursementFields,
): Promise<RecordDisbursementResult> {
  const isPlaintiff = await isPartyPlaintiffOnCase(ctx, fields.caseId, fields.payeeId);
  let usedOverride = false;
  if (isPlaintiff && !(await areCaseFundsCleared(ctx, fields.caseId))) {
    if (!fields.overrideReason) {
      throw new AppError(ERROR_CODES.DISBURSEMENT_BLOCKED_UNCLEARED_FUNDS);
    }
    usedOverride = true;
  }

  const currentTrustBalance = await computeCaseTrustBalance(ctx, fields.caseId);
  if (fields.amount > currentTrustBalance) {
    throw new AppError(ERROR_CODES.INSUFFICIENT_TRUST_BALANCE);
  }

  const receiptNo = await nextReceiptNo(ctx, fields.firmId);
  const createdAt = Date.now();
  const receiptValues: Omit<PersistedReceipt, '_id'> = {
    firmId: fields.firmId,
    caseId: fields.caseId,
    receiptNo,
    payerId: fields.payerId,
    payeeId: fields.payeeId,
    amount: fields.amount,
    method: fields.method,
    date: fields.date,
    remainingBalance: currentTrustBalance - fields.amount,
    signatureRef: fields.signatureRef,
    createdBy: fields.actorId,
    createdAt,
  };
  const receiptId = await ctx.db.insert('receipts', receiptValues);
  const receipt = { _id: receiptId, ...receiptValues };

  const ledgerEntry = await appendLedgerEntry(ctx, fields.firmId, fields.lawyerId, {
    caseId: fields.caseId,
    accountType: 'trust',
    personId: fields.payeeId,
    amount: fields.amount,
    direction: 'debit',
    type: 'payment',
    refType: 'receipts',
    refId: receiptId,
    createdBy: fields.actorId,
  });

  await recordAuditEvent(ctx, {
    firmId: fields.firmId,
    actorId: fields.actorId,
    entityType: 'receipts',
    entityId: receiptId,
    action: usedOverride ? 'disburseWithOverride' : 'disburse',
    after: {
      caseId: fields.caseId,
      payeeId: fields.payeeId,
      amount: fields.amount,
      overrideReason: fields.overrideReason,
    },
  });

  return { ledgerEntry, receipt };
}
