import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { PaginationOptions, PaginationResult } from 'convex/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { boundedPagination } from '../../lib/pagination.ts';
import { requireCasePermission } from '../authz/owned.ts';
import {
  appendLedgerEntry,
  findLedgerEntryByRef,
  type PersistedLedgerEntry,
} from './ledger.ts';
import { createMissionFromEvent } from '../missions/createFromEvent.ts';
import { CHECK_STATUSES, PERMISSIONS, type CheckStatus, type PermissionString } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;
type ScopedReadCtx = ReadCtx & {
  userId: Id<'users'>;
  permissions: ReadonlySet<PermissionString>;
};

/**
 * Branching lifecycle, not linear like cases' CASE_STATUS_TRANSITIONS — a
 * deposited check can bounce, and a bounced check can be reinstated back
 * to cleared (PRD §3: "a reinstated check inserts the exact positive
 * counter-row back").
 */
const CHECK_STATUS_TRANSITIONS: Record<CheckStatus, readonly CheckStatus[]> = {
  received: ['deposited'],
  deposited: ['cleared', 'bounced'],
  cleared: [],
  bounced: ['cleared'],
};

function requireValidCheckStatusTransition(from: CheckStatus, to: CheckStatus): void {
  if (!CHECK_STATUS_TRANSITIONS[from].includes(to)) {
    throw new AppError(ERROR_CODES.INVALID_CHECK_STATUS_TRANSITION);
  }
}

export interface CreateCheckFields {
  checkNumber: string;
  bank: string;
  dueDate: number;
}

export type PersistedCheck = Omit<Doc<'checks'>, '_creationTime'>;
type ReceiptIdentity = Pick<Doc<'receipts'>, '_id' | 'firmId' | 'caseId'>;

export async function createCheck(
  ctx: WriteCtx,
  receipt: ReceiptIdentity,
  fields: CreateCheckFields,
): Promise<PersistedCheck> {
  const now = Date.now();
  const values = {
    firmId: receipt.firmId,
    caseId: receipt.caseId,
    receiptId: receipt._id,
    checkNumber: fields.checkNumber,
    bank: fields.bank,
    dueDate: fields.dueDate,
    status: 'received',
    createdAt: now,
    updatedAt: now,
  } as const;
  const _id = await ctx.db.insert('checks', values);
  return { _id, ...values };
}

async function requireAccessibleCheck(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  checkId: Id<'checks'>,
): Promise<Doc<'checks'>> {
  const check = await ctx.db.get('checks', checkId);
  if (!check || check.firmId !== firmId) {
    throw new AppError(ERROR_CODES.CHECK_NOT_FOUND);
  }
  return check;
}

export async function requirePaymentCheckAccess(
  ctx: ScopedReadCtx,
  firmId: Id<'firms'>,
  checkId: Id<'checks'>,
): Promise<{ check: Doc<'checks'>; caseDoc: Doc<'cases'> }> {
  const check = await requireAccessibleCheck(ctx, firmId, checkId);
  const caseDoc = await requireCasePermission(
    ctx,
    firmId,
    check.caseId,
    PERMISSIONS.PAYMENTS_WRITE_OWN,
    PERMISSIONS.PAYMENTS_WRITE_ALL,
  );
  return { check, caseDoc };
}

export async function listChecksForCase(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
  paginationOptions: PaginationOptions,
): Promise<PaginationResult<Doc<'checks'>>> {
  return await ctx.db
    .query('checks')
    .withIndex('by_case', (query) => query.eq('caseId', caseId))
    .paginate(boundedPagination(paginationOptions));
}

export async function areAllChecksCleared(ctx: ReadCtx, caseId: Id<'cases'>): Promise<boolean> {
  for (const status of CHECK_STATUSES) {
    if (status === 'cleared') continue;
    const uncleared = await ctx.db
      .query('checks')
      .withIndex('by_case_status', (query) => query.eq('caseId', caseId).eq('status', status))
      .first();
    if (uncleared) return false;
  }
  return true;
}

async function transitionCheckStatus(
  ctx: WriteCtx,
  check: Doc<'checks'>,
  nextStatus: CheckStatus,
): Promise<Doc<'checks'>> {
  requireValidCheckStatusTransition(check.status, nextStatus);
  const updatedAt = Date.now();
  await ctx.db.patch('checks', check._id, { status: nextStatus, updatedAt });
  return { ...check, status: nextStatus, updatedAt };
}

export async function markCheckDeposited(ctx: WriteCtx, check: Doc<'checks'>): Promise<Doc<'checks'>> {
  return await transitionCheckStatus(ctx, check, 'deposited');
}

export interface BounceCheckResult {
  check: Doc<'checks'>;
  reversingEntry: PersistedLedgerEntry;
  missionId: Id<'missions'>;
}

/**
 * The bounced-check cascade (design spec §2.4, IMPLEMENTATION_PLAN.md
 * §3): transitions the check to 'bounced', writes a reversing ledger
 * entry inverting the original payment's direction, and raises a mission
 * assigned to the case's lawyer — all in the caller's one mutation.
 * Atomic by construction (Global Constraints): if any step throws,
 * nothing persists.
 */
export async function bounceCheck(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  lawyerId: Id<'users'>,
  caseId: Id<'cases'>,
  check: Doc<'checks'>,
  actorId: Id<'users'>,
): Promise<BounceCheckResult> {
  const updatedCheck = await transitionCheckStatus(ctx, check, 'bounced');

  const original = await findLedgerEntryByRef(ctx, firmId, 'receipts', check.receiptId);
  if (!original) throw new AppError(ERROR_CODES.ORIGINAL_LEDGER_ENTRY_NOT_FOUND);
  // A real-world bounce must be recorded even if the deposited funds were
  // already spent; in that case the resulting negative balance is the deficit
  // the ledger needs to expose, not an adjustment we can reject.
  const reversingEntry = await appendLedgerEntry(ctx, firmId, lawyerId, {
    caseId,
    accountType: original.accountType,
    personId: original.personId,
    amount: original.amount,
    direction: original.direction === 'credit' ? 'debit' : 'credit',
    type: 'adjustment',
    // 'checks_bounce', not 'checks': clearCheck's reinstatement entry
    // below also traces back to this same check, so a shared refType
    // would give findLedgerEntryByRef's .unique() two matching rows once
    // a check goes through the full bounced->cleared path and throw at
    // runtime for the very next caller that looks this check up.
    refType: 'checks_bounce',
    refId: check._id,
    createdBy: actorId,
  });

  const missionId = await createMissionFromEvent(ctx, firmId, {
    caseId,
    title: `Check #${check.checkNumber} bounced — follow up with payer`,
    type: 'other',
    assigneeId: lawyerId,
    dueDate: Date.now() + 24 * 60 * 60 * 1000,
    priority: 'high',
  });

  return { check: updatedCheck, reversingEntry, missionId };
}

export interface ClearCheckResult {
  check: Doc<'checks'>;
  reinstatementEntry: PersistedLedgerEntry | null;
}

/**
 * A normal deposited->cleared transition writes no ledger entry at all —
 * the original payment entry from recordPayment already covers it;
 * clearing just confirms it. A bounced->cleared transition (reinstatement)
 * writes a second reversing entry restoring the original direction,
 * undoing bounceCheck's reversal (PRD §3).
 */
export async function clearCheck(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  lawyerId: Id<'users'>,
  caseId: Id<'cases'>,
  check: Doc<'checks'>,
  actorId: Id<'users'>,
): Promise<ClearCheckResult> {
  const isReinstatement = check.status === 'bounced';
  const updatedCheck = await transitionCheckStatus(ctx, check, 'cleared');
  if (!isReinstatement) return { check: updatedCheck, reinstatementEntry: null };

  const original = await findLedgerEntryByRef(ctx, firmId, 'receipts', check.receiptId);
  if (!original) throw new AppError(ERROR_CODES.ORIGINAL_LEDGER_ENTRY_NOT_FOUND);
  const reinstatementEntry = await appendLedgerEntry(ctx, firmId, lawyerId, {
    caseId,
    accountType: original.accountType,
    personId: original.personId,
    amount: original.amount,
    direction: original.direction,
    type: 'adjustment',
    // 'checks_reinstatement', distinct from bounceCheck's 'checks_bounce'
    // — same reasoning, keeps each ref-type/ref-id tuple unique.
    refType: 'checks_reinstatement',
    refId: check._id,
    createdBy: actorId,
  });
  return { check: updatedCheck, reinstatementEntry };
}
