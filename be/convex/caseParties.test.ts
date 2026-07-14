import { describe, expect, test } from 'vitest';
import {
  addFirmMember,
  bootstrapFirm,
  createAuthedUser,
  expectRejectedWithCode,
  makeTest,
  seedCaseType,
  seedParty,
  type Test,
  type TestUser,
} from './testHelpers.ts';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ERROR_CODES } from './lib/errors.ts';
import { PERMISSIONS } from '@diwan/shared';

async function setupCaseAndParty(
  t: Test,
  owner: TestUser,
  lawyerId: Id<'users'>,
) {
  const caseTypeId = await seedCaseType(t, owner);
  const caseId = await owner.authed.mutation(api.cases.create, {
    internalNumber: 'C-0001',
    caseTypeId,
    primaryLawyerId: lawyerId,
  });
  const partyId = await seedParty(t, owner, '900123456', 'Ahmad Khalil');
  return { caseId, partyId };
}

describe('caseParties', () => {
  test('adding a party to a case creates a listable link, visible from both sides', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const { caseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);

    await lawyer.authed.mutation(api.caseParties.add, {
      caseId,
      partyId,
      role: 'plaintiff',
      representingLawyerId: lawyer.userId,
    });

    const caseParties = await lawyer.authed.query(api.caseParties.listForCase, {
      caseId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(caseParties.page).toHaveLength(1);
    expect(caseParties.page[0]?.role).toBe('plaintiff');
    expect(caseParties.page[0]?.representingLawyerId).toBe(lawyer.userId);

    const partyCases = await lawyer.authed.query(api.caseParties.listForParty, {
      partyId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(partyCases.page).toHaveLength(1);
    expect(partyCases.page[0]?.caseId).toBe(caseId);
  });

  test('the same party and role cannot be linked to a case twice', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const { caseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);
    const link = { caseId, partyId, role: 'plaintiff' as const };

    await lawyer.authed.mutation(api.caseParties.add, link);
    await expectRejectedWithCode(
      lawyer.authed.mutation(api.caseParties.add, link),
      ERROR_CODES.CASE_PARTY_ALREADY_EXISTS,
    );
  });

  test('an Associate cannot add a party to a case they are not assigned to', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const { caseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);

    await expectRejectedWithCode(
      associate.authed.mutation(api.caseParties.add, { caseId, partyId, role: 'defendant' }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('representingLawyerId must identify an active member of the case firm', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const outsider = await createAuthedUser(t, {
      name: 'Outside Lawyer',
      email: 'outside@example.com',
    });
    const { caseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.caseParties.add, {
        caseId,
        partyId,
        role: 'plaintiff',
        representingLawyerId: outsider.userId,
      }),
      ERROR_CODES.NOT_A_FIRM_MEMBER,
    );
  });

  test('party case links require the explicit parties read permission', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const { caseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);
    await lawyer.authed.mutation(api.caseParties.add, {
      caseId,
      partyId,
      role: 'plaintiff',
    });
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('firmMembers')
        .withIndex('by_firm_user', (query) =>
          query.eq('firmId', firmId).eq('userId', lawyer.userId),
        )
        .unique();
      if (!member) throw new Error('missing membership');
      await ctx.db.insert('memberPermissionOverrides', {
        firmId,
        memberId: member._id,
        permission: PERMISSIONS.PARTIES_READ,
        effect: 'revoke',
        createdAt: Date.now(),
      });
    });

    await expectRejectedWithCode(
      lawyer.authed.query(api.caseParties.listForParty, {
        partyId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
    await expectRejectedWithCode(
      lawyer.authed.query(api.caseParties.listForCase, {
        caseId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('listForParty preserves its cursor across an inaccessible raw page', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await owner.authed.mutation(api.caseTypes.create, {
      key: 'civil-claim',
      label: 'Civil Claim',
      requiredPartyRoles: ['plaintiff', 'defendant'],
      requiredDocumentChecklist: [],
    });
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const lawyerB = await addFirmMember(t, firmId, 'lawyer', { name: 'B', email: 'b2@example.com' });

    const partyId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900999999',
      fullName: 'Shared Party',
    });

    // Case A: the associate's own case.
    const caseAId = await associate.authed.mutation(api.cases.create, {
      internalNumber: 'C-0010',
      caseTypeId,
      primaryLawyerId: associate.userId,
    });
    // Case B: a different lawyer's case — the associate holds only
    // cases.readOwn, so this case is outside their read scope.
    const caseBId = await lawyerB.authed.mutation(api.cases.create, {
      internalNumber: 'C-0011',
      caseTypeId,
      primaryLawyerId: lawyerB.userId,
    });

    await lawyerB.authed.mutation(api.caseParties.add, { caseId: caseBId, partyId, role: 'defendant' });
    await associate.authed.mutation(api.caseParties.add, { caseId: caseAId, partyId, role: 'plaintiff' });

    const firstPage = await associate.authed.query(api.caseParties.listForParty, {
      partyId,
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(firstPage.page).toEqual([]);
    expect(firstPage.isDone).toBe(false);

    const secondPage = await associate.authed.query(api.caseParties.listForParty, {
      partyId,
      paginationOpts: { numItems: 1, cursor: firstPage.continueCursor },
    });
    expect(secondPage.page).toHaveLength(1);
    expect(secondPage.page[0]?.caseId).toBe(caseAId);
  });

  test('adding a party to a nonexistent case fails with CASE_NOT_FOUND', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const { caseId: realCaseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);

    // Create a second case to get a different case ID format
    const caseTypeId = await owner.authed.mutation(api.caseTypes.create, {
      key: 'criminal-case',
      label: 'Criminal Case',
      requiredPartyRoles: ['defendant', 'plaintiff'],
      requiredDocumentChecklist: [],
    });
    const secondCaseId = await owner.authed.mutation(api.cases.create, {
      internalNumber: 'C-0002',
      caseTypeId,
      primaryLawyerId: lawyer.userId,
    });

    // Delete the second case from the database so it no longer exists
    await t.run(async (ctx) => {
      await ctx.db.patch(secondCaseId, { deletedAt: Date.now() });
    });

    // Now try to add a party to the deleted case
    await expectRejectedWithCode(
      lawyer.authed.mutation(api.caseParties.add, {
        caseId: secondCaseId,
        partyId,
        role: 'defendant',
      }),
      ERROR_CODES.CASE_NOT_FOUND,
    );
  });

  test('listForParty never returns links from a soft-deleted case', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com',
    });
    const { caseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);
    await lawyer.authed.mutation(api.caseParties.add, {
      caseId,
      partyId,
      role: 'plaintiff',
    });
    await t.run(async (ctx) => {
      await ctx.db.patch('cases', caseId, { deletedAt: Date.now() });
    });

    const result = await owner.authed.query(api.caseParties.listForParty, {
      partyId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toEqual([]);
  });
});
