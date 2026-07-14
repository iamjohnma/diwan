import { describe, expect, test } from 'vitest';
import {
  addFirmMember,
  bootstrapFirm,
  expectRejectedWithCode,
  makeTest,
  seedCase,
  seedCaseType,
  seedParty,
  type TestUser,
} from './testHelpers.ts';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ERROR_CODES } from './lib/errors.ts';

async function seedCheckPayment(
  lawyer: TestUser,
  caseId: Id<'cases'>,
  payerId: Id<'parties'>,
  amount: number,
) {
  return await lawyer.authed.mutation(api.payments.recordPayment, {
    caseId,
    payerId,
    accountType: 'trust',
    amount,
    method: 'check',
    date: Date.now(),
    checkDetails: { checkNumber: 'CHK-001', bank: 'Bank of Palestine', dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000 },
  });
}

describe('checks', () => {
  test('recordPayment (check method) creates a checks row in status received', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001001', 'Payer A');

    const result = await seedCheckPayment(lawyer, caseId, payerId, 5000);
    expect(result.check?.status).toBe('received');
    expect(result.check?.checkNumber).toBe('CHK-001');
    expect(result.check?.caseId).toBe(caseId);
    expect(
      result.check
        ? (await t.run(async (ctx) => ctx.db.get('checks', result.check!._id)))?.caseId
        : undefined,
    ).toBe(caseId);
  });

  test('recordPayment (check method) without checkDetails is rejected', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001002', 'Payer B');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'trust',
        amount: 1000,
        method: 'check',
        date: Date.now(),
      }),
      ERROR_CODES.CHECK_DETAILS_REQUIRED,
    );
  });

  test('cash payments ignore stray check details', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001008', 'Cash Payer');

    const payment = await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 1000,
      method: 'cash',
      date: Date.now(),
      checkDetails: {
        checkNumber: 'IGNORED',
        bank: 'Ignored Bank',
        dueDate: Date.now(),
      },
    });
    expect(payment.check).toBeUndefined();
    const listed = await lawyer.authed.query(api.checks.listChecks, {
      caseId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page).toEqual([]);
  });

  test('markDeposited then markCleared: normal clear path writes no reversal ledger entry', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001003', 'Payer C');
    const { check } = await seedCheckPayment(lawyer, caseId, payerId, 2000);
    if (!check) throw new Error('missing check');

    await lawyer.authed.mutation(api.checks.markDeposited, { checkId: check._id });
    await lawyer.authed.mutation(api.checks.markCleared, { checkId: check._id });

    const listed = await lawyer.authed.query(api.checks.listChecks, {
      caseId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page.find((candidate) => candidate._id === check._id)?.status).toBe('cleared');

    // The name promises "writes no reversal ledger entry" — assert it,
    // not just the status transition. Only the original recordPayment
    // entry should exist; a normal clear (not a reinstatement) must not
    // add a second row.
    const entries = await t.run(async (ctx) =>
      ctx.db
        .query('ledgerEntries')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect(),
    );
    expect(entries).toHaveLength(1);
  });

  test('markBounced (from deposited) produces a reversing ledger entry, bounced status, and a mission', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001004', 'Payer D');
    const { check } = await seedCheckPayment(lawyer, caseId, payerId, 3000);
    if (!check) throw new Error('missing check');
    await lawyer.authed.mutation(api.checks.markDeposited, { checkId: check._id });

    const result = await lawyer.authed.mutation(api.checks.markBounced, { checkId: check._id });
    expect(result.check.status).toBe('bounced');
    expect(result.reversingEntry.direction).toBe('debit');
    expect(result.reversingEntry.amount).toBe(3000);
    expect(result.reversingEntry.refType).toBe('checks_bounce');
    expect(
      await lawyer.authed.query(api.payments.getCaseTrustBalance, { caseId }),
    ).toBe(0);

    const mission = await t.run(async (ctx) => ctx.db.get('missions', result.missionId));
    expect(mission?.assigneeId).toBe(lawyer.userId);
    expect(mission?.priority).toBe('high');
  });

  test('a bounce records the real trust deficit after deposited funds were spent', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-BOUNCE-DEFICIT');
    const payerId = await seedParty(t, owner, '900001009', 'Check Payer');
    const payeeId = await seedParty(t, owner, '900001010', 'Court Fee Payee');
    const { check } = await seedCheckPayment(lawyer, caseId, payerId, 3000);
    if (!check) throw new Error('missing check');

    await lawyer.authed.mutation(api.checks.markDeposited, { checkId: check._id });
    await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId,
      payeeId,
      amount: 3000,
      method: 'cash',
      date: Date.now(),
    });
    await lawyer.authed.mutation(api.checks.markBounced, { checkId: check._id });

    expect(await lawyer.authed.query(api.payments.getCaseTrustBalance, { caseId })).toBe(-3000);
    const reconciliation = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query('caseAccountBalances')
        .withIndex('by_case_account_type', (query) =>
          query.eq('caseId', caseId).eq('accountType', 'trust'),
        )
        .unique();
      const entries = await ctx.db
        .query('ledgerEntries')
        .withIndex('by_case_account_type', (query) =>
          query.eq('caseId', caseId).eq('accountType', 'trust'),
        )
        .collect();
      return {
        counterBalance: counter?.balance,
        ledgerBalance: entries.reduce(
          (sum, entry) => sum + (entry.direction === 'credit' ? entry.amount : -entry.amount),
          0,
        ),
      };
    });
    expect(reconciliation).toEqual({ counterBalance: -3000, ledgerBalance: -3000 });
  });

  test('markCleared (reinstatement, from bounced) produces a second reversing entry restoring the original direction', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001005', 'Payer E');
    const { check } = await seedCheckPayment(lawyer, caseId, payerId, 4000);
    if (!check) throw new Error('missing check');
    await lawyer.authed.mutation(api.checks.markDeposited, { checkId: check._id });
    await lawyer.authed.mutation(api.checks.markBounced, { checkId: check._id });

    const reinstated = await lawyer.authed.mutation(api.checks.markCleared, { checkId: check._id });
    expect(reinstated.status).toBe('cleared');

    const entries = await t.run(async (ctx) =>
      ctx.db
        .query('ledgerEntries')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect(),
    );
    // Original credit (recordPayment) + bounce debit (markBounced) + reinstatement credit (markCleared) = 3.
    expect(entries).toHaveLength(3);
    const directions = entries.map((e) => e.direction).sort();
    expect(directions).toEqual(['credit', 'credit', 'debit']);
    const reinstatementEntry = entries.find((entry) => entry.refType === 'checks_reinstatement');
    expect(reinstatementEntry?.refType).toBe('checks_reinstatement');
    expect(
      await lawyer.authed.query(api.payments.getCaseTrustBalance, { caseId }),
    ).toBe(4000);
    const audit = await t.run(async (ctx) => {
      const events = await ctx.db
        .query('auditLog')
        .withIndex('by_firm_entity', (query) =>
          query.eq('firmId', firmId).eq('entityType', 'checks').eq('entityId', check._id),
        )
        .collect();
      return events.find((event) => event.action === 'markCleared');
    });
    expect(JSON.parse(audit?.after ?? '{}')).toMatchObject({
      status: 'cleared',
      reinstatementEntryId: reinstatementEntry?._id,
    });
  });

  test('markBounced from received (not yet deposited) is rejected', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900001006', 'Payer F');
    const { check } = await seedCheckPayment(lawyer, caseId, payerId, 1000);
    if (!check) throw new Error('missing check');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.checks.markBounced, { checkId: check._id }),
      ERROR_CODES.INVALID_CHECK_STATUS_TRANSITION,
    );
  });

  test('an Associate cannot markDeposited — holds only payments:readOwn', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, associate, 'C-2101');
    const payerId = await seedParty(t, owner, '900001007', 'Payer G');
    const { check } = await seedCheckPayment(secretary, caseId, payerId, 1500);
    if (!check) throw new Error('missing check');

    await expectRejectedWithCode(
      associate.authed.mutation(api.checks.markDeposited, { checkId: check._id }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });
});
