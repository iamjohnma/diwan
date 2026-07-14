import { describe, expect, test } from 'vitest';
import {
  addFirmMember,
  bootstrapFirm,
  expectRejectedWithCode,
  makeTest,
  seedCase,
  seedCaseType,
  seedParty,
} from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

describe('payments', () => {
  test('recordPayment (cash) creates a ledger entry and a receipt with receiptNo 1', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000001', 'Payer One');

    // accountType 'trust', not 'fee': this test is about receipt/ledger-
    // entry creation mechanics (receiptNo numbering), not balance
    // mechanics — 'trust' never touches the negative-balance guard, so it
    // doesn't need a prior recordAdjustment to establish a balance first
    // (unlike Test 2 below, which specifically tests fee-balance effects
    // and correctly sets one up). Using 'fee' with no prior balance here
    // would incorrectly reject a $500 credit against a $0 balance.
    const result = await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 500,
      method: 'cash',
      date: Date.now(),
    });

    expect(result.receipt.receiptNo).toBe(1);
    expect(result.receipt.amount).toBe(500);
    expect(result.ledgerEntry.direction).toBe('credit');
    expect(result.ledgerEntry.accountType).toBe('trust');
  });

  test('recordPayment (fee, credit) decreases the firm and lawyer outstanding balance', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000002', 'Payer Two');

    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 1000,
      reason: 'Initial fee charge',
    });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'fee',
      amount: 300,
      method: 'cash',
      date: Date.now(),
    });

    const lawyerBalance = await lawyer.authed.query(api.payments.getWhoOwesWhom, { scope: 'lawyer' });
    expect(lawyerBalance.outstandingBalance).toBe(700);
    const firmBalance = await owner.authed.query(api.payments.getWhoOwesWhom, { scope: 'firm' });
    expect(firmBalance.outstandingBalance).toBe(700);
  });

  test('recordPayment rejects an amount of zero', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000003', 'Payer Three');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'fee',
        amount: 0,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INVALID_LEDGER_AMOUNT,
    );
  });

  test('recordPayment (fee, credit) rejects overpayment past the outstanding balance', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000004', 'Payer Four');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'fee',
        amount: 100,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.LEDGER_BALANCE_WOULD_GO_NEGATIVE,
    );
    const state = await t.run(async (ctx) => {
      const receipt = await ctx.db
        .query('receipts')
        .withIndex('by_case', (query) => query.eq('caseId', caseId))
        .first();
      const ledgerEntry = await ctx.db
        .query('ledgerEntries')
        .withIndex('by_case', (query) => query.eq('caseId', caseId))
        .first();
      const counter = await ctx.db
        .query('receiptCounters')
        .withIndex('by_firm', (query) => query.eq('firmId', firmId))
        .unique();
      return { receipt, ledgerEntry, counter };
    });
    expect(state).toEqual({ receipt: null, ledgerEntry: null, counter: null });
  });

  test('receiptNo is gapless and non-colliding under concurrent recordPayment calls', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000005', 'Payer Five');
    // Establish enough of an owed balance that 10 concurrent $10 payments never trip the negative guard.
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 1000,
      reason: 'Bulk fee charge',
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        lawyer.authed.mutation(api.payments.recordPayment, {
          caseId,
          payerId,
          accountType: 'fee',
          amount: 10,
          method: 'cash',
          date: Date.now(),
        }),
      ),
    );

    const receiptNos = results.map((r) => r.receipt.receiptNo).sort((a, b) => a - b);
    expect(receiptNos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('an Associate cannot recordPayment at all — holds only payments:readOwn', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const caseId = await seedCase(t, caseTypeId, associate);
    const payerId = await seedParty(t, owner, '900000006', 'Payer Six');

    await expectRejectedWithCode(
      associate.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'fee',
        amount: 100,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('a Secretary CAN recordPayment on any lawyer\'s case (writeAll)', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000007', 'Payer Seven');
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 200,
      reason: 'Fee charge',
    });

    const result = await secretary.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'fee',
      amount: 200,
      method: 'cash',
      date: Date.now(),
    });
    expect(result.receipt.receiptNo).toBe(1);
  });

  test('a Paralegal cannot recordPayment — zero payments permissions at all', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const paralegal = await addFirmMember(t, firmId, 'paralegal', { name: 'Pat', email: 'pat@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000008', 'Payer Eight');

    await expectRejectedWithCode(
      paralegal.authed.mutation(api.payments.recordPayment, {
        caseId,
        payerId,
        accountType: 'fee',
        amount: 100,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('recordPayment (trust account) never touches financialCounters', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const payerId = await seedParty(t, owner, '900000009', 'Payer Nine');

    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 5000,
      method: 'cash',
      date: Date.now(),
    });

    const lawyerBalance = await lawyer.authed.query(api.payments.getWhoOwesWhom, { scope: 'lawyer' });
    expect(lawyerBalance.outstandingBalance).toBe(0);
    const trustCounter = await t.run(async (ctx) =>
      ctx.db
        .query('caseAccountBalances')
        .withIndex('by_case_account_type', (query) =>
          query.eq('caseId', caseId).eq('accountType', 'trust'),
        )
        .unique(),
    );
    expect(trustCounter?.balance).toBe(5000);
  });

  test('concurrent first trust payments create one reconciled case counter', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-CONCURRENT-TRUST');
    const payerId = await seedParty(t, owner, '900000010', 'Concurrent Payer');

    await Promise.all(
      Array.from({ length: 10 }, () =>
        lawyer.authed.mutation(api.payments.recordPayment, {
          caseId,
          payerId,
          accountType: 'trust',
          amount: 100,
          method: 'cash',
          date: Date.now(),
        }),
      ),
    );

    const state = await t.run(async (ctx) => {
      const counters = await ctx.db
        .query('caseAccountBalances')
        .withIndex('by_case_account_type', (query) =>
          query.eq('caseId', caseId).eq('accountType', 'trust'),
        )
        .collect();
      const entries = await ctx.db
        .query('ledgerEntries')
        .withIndex('by_case_account_type', (query) =>
          query.eq('caseId', caseId).eq('accountType', 'trust'),
        )
        .collect();
      return {
        counters,
        ledgerBalance: entries.reduce(
          (sum, entry) => sum + (entry.direction === 'credit' ? entry.amount : -entry.amount),
          0,
        ),
      };
    });
    expect(state.counters).toHaveLength(1);
    expect(state.counters[0]?.balance).toBe(1000);
    expect(state.ledgerBalance).toBe(1000);
  });

  test('recordRefund (debit) increases the outstanding balance back up', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2200');
    const payerId = await seedParty(t, owner, '900002001', 'Payer R1');
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 1000,
      reason: 'Fee charge',
    });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'fee',
      amount: 1000,
      method: 'cash',
      date: Date.now(),
    });

    const refund = await lawyer.authed.mutation(api.payments.recordRefund, {
      caseId,
      personId: payerId,
      accountType: 'fee',
      amount: 400,
      reason: 'Overcollected',
    });
    expect(refund.direction).toBe('debit');
    expect(refund.type).toBe('refund');

    const balance = await lawyer.authed.query(api.payments.getWhoOwesWhom, { scope: 'lawyer' });
    expect(balance.outstandingBalance).toBe(400);
  });

  test('recordRefund cannot overdraw a trust account and rolls back', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2200-TRUST');
    const payerId = await seedParty(t, owner, '900002004', 'Trust Payer');
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 500,
      method: 'cash',
      date: Date.now(),
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.recordRefund, {
        caseId,
        personId: payerId,
        accountType: 'trust',
        amount: 501,
        reason: 'Too much',
      }),
      ERROR_CODES.INSUFFICIENT_TRUST_BALANCE,
    );
    expect(await lawyer.authed.query(api.payments.getCaseTrustBalance, { caseId })).toBe(500);
  });

  test('a Secretary cannot recordRefund — writeAll but no approve', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2201');
    const payerId = await seedParty(t, owner, '900002002', 'Payer R2');

    await expectRejectedWithCode(
      secretary.authed.mutation(api.payments.recordRefund, {
        caseId,
        personId: payerId,
        accountType: 'fee',
        amount: 100,
        reason: 'Test',
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('an Accountant CAN recordRefund on any case — writeAll + approve', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const accountant = await addFirmMember(t, firmId, 'accountant', { name: 'Adam', email: 'adam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2202');
    const payerId = await seedParty(t, owner, '900002003', 'Payer R3');
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 500,
      reason: 'Fee charge',
    });

    const refund = await accountant.authed.mutation(api.payments.recordRefund, {
      caseId,
      personId: payerId,
      accountType: 'fee',
      amount: 200,
      reason: 'Goodwill adjustment',
    });
    expect(refund.amount).toBe(200);
  });

  test('disburse to a plaintiff succeeds when the case has no checks at all', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2300');
    const defendantId = await seedParty(t, owner, '900003001', 'Defendant D1');
    const plaintiffId = await seedParty(t, owner, '900003002', 'Plaintiff P1');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });
    // Trust-balance sufficiency (final-review fix #1) requires the case to
    // actually hold the disbursed amount in trust — establish it via a cash
    // deposit before disbursing, same as real usage would.
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 1500,
      method: 'cash',
      date: Date.now(),
    });

    const result = await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: plaintiffId,
      amount: 1000,
      method: 'cash',
      date: Date.now(),
    });
    expect(result.ledgerEntry.direction).toBe('debit');
    expect(result.ledgerEntry.accountType).toBe('trust');
    expect(result.receipt.receiptNo).toBe(2);
    expect(result.receipt.remainingBalance).toBe(500);
  });

  test('disburse to a plaintiff is blocked when a check on the case has not cleared', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2301');
    const defendantId = await seedParty(t, owner, '900003003', 'Defendant D2');
    const plaintiffId = await seedParty(t, owner, '900003004', 'Plaintiff P2');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'check',
      date: Date.now(),
      checkDetails: { checkNumber: 'CHK-900', bank: 'Bank of Palestine', dueDate: Date.now() + 86400000 },
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.disburse, {
        caseId,
        payerId: defendantId,
        payeeId: plaintiffId,
        amount: 1000,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.DISBURSEMENT_BLOCKED_UNCLEARED_FUNDS,
    );
  });

  test('disburse to a plaintiff succeeds with an overrideReason despite an uncleared check, and it is audited', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2302');
    const defendantId = await seedParty(t, owner, '900003005', 'Defendant D3');
    const plaintiffId = await seedParty(t, owner, '900003006', 'Plaintiff P3');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'check',
      date: Date.now(),
      checkDetails: { checkNumber: 'CHK-901', bank: 'Bank of Palestine', dueDate: Date.now() + 86400000 },
    });

    const result = await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: plaintiffId,
      amount: 1000,
      method: 'cash',
      date: Date.now(),
      overrideReason: 'Client urgently needs partial funds; firm accepts the risk.',
    });
    expect(result.receipt.amount).toBe(1000);

    const events = await t.run(async (ctx) =>
      ctx.db
        .query('auditLog')
        .withIndex('by_firm_entity', (q) => q.eq('firmId', firmId).eq('entityType', 'receipts').eq('entityId', result.receipt._id))
        .collect(),
    );
    expect(events.some((e) => e.action === 'disburseWithOverride')).toBe(true);
  });

  test('disburse to a NON-plaintiff payee is never blocked, even with uncleared checks', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2303');
    const defendantId = await seedParty(t, owner, '900003007', 'Defendant D4');
    const thirdPartyId = await seedParty(t, owner, '900003008', 'Court Fee Recipient');
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'check',
      date: Date.now(),
      checkDetails: { checkNumber: 'CHK-902', bank: 'Bank of Palestine', dueDate: Date.now() + 86400000 },
    });

    const result = await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: thirdPartyId,
      amount: 200,
      method: 'cash',
      date: Date.now(),
    });
    expect(result.receipt.amount).toBe(200);
  });

  test('a Secretary cannot disburse — writeAll but no approve', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2304');
    const defendantId = await seedParty(t, owner, '900003009', 'Defendant D5');
    const plaintiffId = await seedParty(t, owner, '900003010', 'Plaintiff P5');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });

    await expectRejectedWithCode(
      secretary.authed.mutation(api.payments.disburse, {
        caseId,
        payerId: defendantId,
        payeeId: plaintiffId,
        amount: 100,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('getCaseTrustBalance sums trust-account credits minus debits for the case, independent of financialCounters', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2401');
    const defendantId = await seedParty(t, owner, '900004001', 'Defendant T1');
    const plaintiffId = await seedParty(t, owner, '900004002', 'Plaintiff T1');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });

    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'cash',
      date: Date.now(),
    });
    await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: plaintiffId,
      amount: 2000,
      method: 'cash',
      date: Date.now(),
    });

    const trustBalance = await lawyer.authed.query(api.payments.getCaseTrustBalance, { caseId });
    expect(trustBalance).toBe(3000);
    // Trust movements never touch the fee-receivables counter.
    const feeBalance = await lawyer.authed.query(api.payments.getWhoOwesWhom, { scope: 'lawyer' });
    expect(feeBalance.outstandingBalance).toBe(0);
  });

  test('listLedgerForCase returns every ledger entry for the case, paginated', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2402');
    const payerId = await seedParty(t, owner, '900004003', 'Payer T2');
    await lawyer.authed.mutation(api.payments.recordAdjustment, { caseId, personId: payerId, amount: 300, reason: 'Charge' });
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'fee',
      amount: 300,
      method: 'cash',
      date: Date.now(),
    });

    const listed = await lawyer.authed.query(api.payments.listLedgerForCase, {
      caseId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page).toHaveLength(2);
  });

  test('financialCounters (firm scope) stays consistent with a full re-sum of fee ledgerEntries after concurrent writes', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2403');
    const payerId = await seedParty(t, owner, '900004004', 'Payer Recon');
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 10000,
      reason: 'Bulk charge',
    });

    await Promise.all([
      ...Array.from({ length: 5 }, () =>
        lawyer.authed.mutation(api.payments.recordPayment, {
          caseId,
          payerId,
          accountType: 'fee',
          amount: 100,
          method: 'cash',
          date: Date.now(),
        }),
      ),
      ...Array.from({ length: 3 }, () =>
        lawyer.authed.mutation(api.payments.recordAdjustment, {
          caseId,
          personId: payerId,
          amount: 50,
          reason: 'Extra charge',
        }),
      ),
    ]);

    const trueSum = await t.run(async (ctx) => {
      const entries = await ctx.db
        .query('ledgerEntries')
        .withIndex('by_firm_created', (q) => q.eq('firmId', firmId))
        .collect();
      return entries
        .filter((e) => e.accountType === 'fee')
        .reduce((sum, e) => sum + (e.direction === 'credit' ? -e.amount : e.amount), 0);
    });

    const counterBalance = await owner.authed.query(api.payments.getWhoOwesWhom, { scope: 'firm' });
    expect(counterBalance.outstandingBalance).toBe(trueSum);
    expect(trueSum).toBe(10000 - 5 * 100 + 3 * 50);
  });

  // --- Final-review fixes: trust-balance sufficiency, remainingBalance
  // semantics, and the disbursement override audit label. ---

  test('disburse rejects an amount exceeding the case trust balance (INSUFFICIENT_TRUST_BALANCE)', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2500');
    const defendantId = await seedParty(t, owner, '900005001', 'Defendant TB1');
    // Non-plaintiff payee: isolates this test from the plaintiff-only
    // clear-funds block, so a rejection here can only be the trust-balance
    // sufficiency check (final-review fix #1), not DISBURSEMENT_BLOCKED_UNCLEARED_FUNDS.
    const thirdPartyId = await seedParty(t, owner, '900005002', 'Court Fee Recipient TB1');
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'cash',
      date: Date.now(),
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.disburse, {
        caseId,
        payerId: defendantId,
        payeeId: thirdPartyId,
        amount: 50000,
        method: 'cash',
        date: Date.now(),
      }),
      ERROR_CODES.INSUFFICIENT_TRUST_BALANCE,
    );
    const state = await t.run(async (ctx) => {
      const receipts = await ctx.db
        .query('receipts')
        .withIndex('by_case', (query) => query.eq('caseId', caseId))
        .collect();
      const ledgerEntries = await ctx.db
        .query('ledgerEntries')
        .withIndex('by_case', (query) => query.eq('caseId', caseId))
        .collect();
      const counter = await ctx.db
        .query('receiptCounters')
        .withIndex('by_firm', (query) => query.eq('firmId', firmId))
        .unique();
      return { receipts, ledgerEntries, counter };
    });
    expect(state.receipts).toHaveLength(1);
    expect(state.ledgerEntries).toHaveLength(1);
    expect(state.counter?.nextReceiptNo).toBe(2);
  });

  test('recordPayment (trust) sets receipt.remainingBalance to the case trust balance, not the lawyer fee balance', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2501');
    const payerId = await seedParty(t, owner, '900005003', 'Payer TB2');

    // Establish a fee balance that's a clearly different number from any
    // trust balance in this test, so a wrongly-fee-sourced remainingBalance
    // is distinguishable from the correct trust-sourced one.
    await lawyer.authed.mutation(api.payments.recordAdjustment, {
      caseId,
      personId: payerId,
      amount: 9999,
      reason: 'Unrelated fee charge',
    });

    // Establish a prior trust balance before the payment under test.
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 2000,
      method: 'cash',
      date: Date.now(),
    });
    const trustBalanceBeforeThisPayment = await lawyer.authed.query(api.payments.getCaseTrustBalance, { caseId });
    expect(trustBalanceBeforeThisPayment).toBe(2000);

    const result = await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 700,
      method: 'cash',
      date: Date.now(),
    });

    // Must reflect the case's own POST-payment trust balance (final-review
    // fix #2) — recordPayment is always a credit, so this payment's own
    // 700 is added on top of the 2000 already in trust — not the unrelated
    // 9999 firm/lawyer fee balance the pre-fix code would have returned
    // unconditionally for any non-'fee' accountType, and not the
    // pre-payment 2000 either (remainingBalance means "after this
    // transaction", matching the 'fee' branch's existing convention).
    expect(result.receipt.remainingBalance).toBe(trustBalanceBeforeThisPayment + 700);
    expect(result.receipt.remainingBalance).toBe(2700);
    expect(result.receipt.remainingBalance).not.toBe(9999);
  });

  test('client-account receipts and refunds use the client balance, not trust', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2501-CLIENT');
    const payerId = await seedParty(t, owner, '900005006', 'Client Payer');
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'trust',
      amount: 1000,
      method: 'cash',
      date: Date.now(),
    });

    const clientPayment = await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId,
      accountType: 'client',
      amount: 200,
      method: 'cash',
      date: Date.now(),
    });
    expect(clientPayment.receipt.remainingBalance).toBe(200);

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.payments.recordRefund, {
        caseId,
        personId: payerId,
        accountType: 'client',
        amount: 201,
        reason: 'Too much',
      }),
      ERROR_CODES.INSUFFICIENT_CLIENT_BALANCE,
    );
    await lawyer.authed.mutation(api.payments.recordRefund, {
      caseId,
      personId: payerId,
      accountType: 'client',
      amount: 75,
      reason: 'Partial refund',
    });
    const clientState = await t.run(async (ctx) => {
      const counter = await ctx.db
        .query('caseAccountBalances')
        .withIndex('by_case_account_type', (query) =>
          query.eq('caseId', caseId).eq('accountType', 'client'),
        )
        .unique();
      const entries = await ctx.db
        .query('ledgerEntries')
        .withIndex('by_case_account_type', (query) =>
          query.eq('caseId', caseId).eq('accountType', 'client'),
        )
        .collect();
      const ledgerBalance = entries.reduce(
        (sum, entry) => sum + (entry.direction === 'credit' ? entry.amount : -entry.amount),
        0,
      );
      return { counterBalance: counter?.balance, ledgerBalance };
    });
    expect(clientState).toEqual({ counterBalance: 125, ledgerBalance: 125 });
  });

  test('disburse with an overrideReason on an already-cleared case does not record disburseWithOverride', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2502');
    const defendantId = await seedParty(t, owner, '900005004', 'Defendant TB3');
    const plaintiffId = await seedParty(t, owner, '900005005', 'Plaintiff TB3');
    await lawyer.authed.mutation(api.caseParties.add, { caseId, partyId: plaintiffId, role: 'plaintiff' });
    // Cash trust deposit only — no checks at all, so funds are trivially
    // cleared and no override was ever actually needed.
    await lawyer.authed.mutation(api.payments.recordPayment, {
      caseId,
      payerId: defendantId,
      accountType: 'trust',
      amount: 5000,
      method: 'cash',
      date: Date.now(),
    });

    const result = await lawyer.authed.mutation(api.payments.disburse, {
      caseId,
      payerId: defendantId,
      payeeId: plaintiffId,
      amount: 1000,
      method: 'cash',
      date: Date.now(),
      overrideReason: 'Just in case — but funds are actually already clear.',
    });

    const events = await t.run(async (ctx) =>
      ctx.db
        .query('auditLog')
        .withIndex('by_firm_entity', (q) =>
          q.eq('firmId', firmId).eq('entityType', 'receipts').eq('entityId', result.receipt._id),
        )
        .collect(),
    );
    expect(events.some((e) => e.action === 'disburseWithOverride')).toBe(false);
    expect(events.some((e) => e.action === 'disburse')).toBe(true);
  });
});
