import { describe, expect, test } from 'vitest';
import {
  addFirmMember,
  bootstrapFirm,
  expectRejectedWithCode,
  makeTest,
  seedCase,
  seedCaseType,
} from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

describe('installments', () => {
  test('create + list: a future-dated installment is scheduled and not overdue', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);

    await lawyer.authed.mutation(api.installments.create, {
      caseId,
      amount: 500,
      dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    const listed = await lawyer.authed.query(api.installments.list, {
      caseId,
      asOf: Date.now(),
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page).toHaveLength(1);
    expect(listed.page[0]?.status).toBe('scheduled');
    expect(listed.page[0]?.overdue).toBe(false);
  });

  test.each([0, -100])('create rejects non-positive installment amount %s', async (amount) => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const caseId = await seedCase(t, caseTypeId, lawyer);

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.installments.create, {
        caseId,
        amount,
        dueDate: Date.now(),
      }),
      ERROR_CODES.INVALID_INSTALLMENT_AMOUNT,
    );
  });

  test('a past-due, still-scheduled installment is computed as overdue at read time', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);

    await lawyer.authed.mutation(api.installments.create, {
      caseId,
      amount: 300,
      dueDate: Date.now() - 24 * 60 * 60 * 1000,
    });

    const listed = await lawyer.authed.query(api.installments.list, {
      caseId,
      asOf: Date.now(),
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page[0]?.overdue).toBe(true);

    const stored = await t.run(async (ctx) => ctx.db.query('installmentPlans').withIndex('by_case', (q) => q.eq('caseId', caseId)).first());
    expect(stored?.status).toBe('scheduled');
  });

  test('markPaid: a past-due installment stops being overdue once paid', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const installmentPlanId = await lawyer.authed.mutation(api.installments.create, {
      caseId,
      amount: 300,
      dueDate: Date.now() - 24 * 60 * 60 * 1000,
    });

    await lawyer.authed.mutation(api.installments.markPaid, { installmentPlanId });

    const listed = await lawyer.authed.query(api.installments.list, {
      caseId,
      asOf: Date.now(),
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page[0]?.status).toBe('paid');
    expect(listed.page[0]?.overdue).toBe(false);
  });

  test('markPaid rejects a second call on an already-paid plan (INVALID_STATUS_TRANSITION)', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2404');
    const installmentPlanId = await lawyer.authed.mutation(api.installments.create, {
      caseId,
      amount: 300,
      dueDate: Date.now(),
    });

    await lawyer.authed.mutation(api.installments.markPaid, { installmentPlanId });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.installments.markPaid, { installmentPlanId }),
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  });

  test('an Associate cannot create an installment plan — holds only payments:readOwn', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const caseId = await seedCase(t, caseTypeId, associate, 'C-2401');

    await expectRejectedWithCode(
      associate.authed.mutation(api.installments.create, { caseId, amount: 100, dueDate: Date.now() }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('a Secretary CAN create an installment plan on any lawyer\'s case (writeAll)', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer, 'C-2402');

    const installmentPlanId = await secretary.authed.mutation(api.installments.create, {
      caseId,
      amount: 100,
      dueDate: Date.now(),
    });
    expect(installmentPlanId).toBeDefined();
  });
});
