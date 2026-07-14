import { v } from 'convex/values';
import type { Doc } from '../../_generated/dataModel';
import { literalUnion } from '../../lib/validators.ts';
import {
  CHECK_STATUSES,
  FINANCIAL_COUNTER_SCOPES,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_DIRECTIONS,
  LEDGER_ENTRY_TYPES,
  PAYMENT_METHODS,
} from '@diwan/shared';

export const accountTypeValidator = literalUnion(LEDGER_ACCOUNT_TYPES);
export const paymentMethodValidator = literalUnion(PAYMENT_METHODS);
export const financialCounterScopeValidator = literalUnion(FINANCIAL_COUNTER_SCOPES);

export const checkInputValidator = v.object({
  checkNumber: v.string(),
  bank: v.string(),
  dueDate: v.number(),
});

export const ledgerEntryDetailValidator = v.object({
  _id: v.id('ledgerEntries'),
  caseId: v.id('cases'),
  accountType: accountTypeValidator,
  personId: v.id('parties'),
  amount: v.number(),
  direction: literalUnion(LEDGER_DIRECTIONS),
  type: literalUnion(LEDGER_ENTRY_TYPES),
  refType: v.string(),
  refId: v.string(),
  createdAt: v.number(),
});

type LedgerEntryDetailSource = Pick<
  Doc<'ledgerEntries'>,
  '_id' | 'caseId' | 'accountType' | 'personId' | 'amount' | 'direction' | 'type' | 'refType' | 'refId' | 'createdAt'
>;

export function toLedgerEntryDetail(entry: LedgerEntryDetailSource) {
  return {
    _id: entry._id,
    caseId: entry.caseId,
    accountType: entry.accountType,
    personId: entry.personId,
    amount: entry.amount,
    direction: entry.direction,
    type: entry.type,
    refType: entry.refType,
    refId: entry.refId,
    createdAt: entry.createdAt,
  };
}

export const receiptDetailValidator = v.object({
  _id: v.id('receipts'),
  caseId: v.id('cases'),
  receiptNo: v.number(),
  payerId: v.id('parties'),
  payeeId: v.optional(v.id('parties')),
  amount: v.number(),
  method: paymentMethodValidator,
  date: v.number(),
  remainingBalance: v.number(),
  signatureRef: v.optional(v.string()),
  createdAt: v.number(),
});

type ReceiptDetailSource = Pick<
  Doc<'receipts'>,
  | '_id'
  | 'caseId'
  | 'receiptNo'
  | 'payerId'
  | 'payeeId'
  | 'amount'
  | 'method'
  | 'date'
  | 'remainingBalance'
  | 'signatureRef'
  | 'createdAt'
>;

export function toReceiptDetail(receipt: ReceiptDetailSource) {
  return {
    _id: receipt._id,
    caseId: receipt.caseId,
    receiptNo: receipt.receiptNo,
    payerId: receipt.payerId,
    payeeId: receipt.payeeId,
    amount: receipt.amount,
    method: receipt.method,
    date: receipt.date,
    remainingBalance: receipt.remainingBalance,
    signatureRef: receipt.signatureRef,
    createdAt: receipt.createdAt,
  };
}

export const checkDetailValidator = v.object({
  _id: v.id('checks'),
  caseId: v.id('cases'),
  receiptId: v.id('receipts'),
  checkNumber: v.string(),
  bank: v.string(),
  dueDate: v.number(),
  status: literalUnion(CHECK_STATUSES),
});

type CheckDetailSource = Pick<
  Doc<'checks'>,
  '_id' | 'caseId' | 'receiptId' | 'checkNumber' | 'bank' | 'dueDate' | 'status'
>;

export function toCheckDetail(check: CheckDetailSource) {
  return {
    _id: check._id,
    caseId: check.caseId,
    receiptId: check.receiptId,
    checkNumber: check.checkNumber,
    bank: check.bank,
    dueDate: check.dueDate,
    status: check.status,
  };
}
