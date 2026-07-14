import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';
import {
  addFirmMember,
  bootstrapFirm,
  createAuthedUser,
  expectRejectedWithCode,
  makeTest,
  seedCaseType
} from './testHelpers.ts';

describe('cases', () => {
  test('a Lawyer can create a case assigned to themselves', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com'
    });

    const caseId = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-0001',
      caseTypeId,
      primaryLawyerId: lawyer.userId
    });
    const created = await lawyer.authed.query(api.cases.get, { caseId });
    expect(created?.status).toBe('intake');
  });

  test('a Lawyer CANNOT create a case assigned to a different lawyer', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyerA = await addFirmMember(t, firmId, 'lawyer', {
      name: 'A',
      email: 'a@example.com'
    });
    const lawyerB = await addFirmMember(t, firmId, 'lawyer', {
      name: 'B',
      email: 'b@example.com'
    });

    await expectRejectedWithCode(
      lawyerA.authed.mutation(api.cases.create, {
        internalNumber: 'C-0002',
        caseTypeId,
        primaryLawyerId: lawyerB.userId
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  });

  test('a Secretary CAN create a case assigned to any lawyer (intake)', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com'
    });
    const secretary = await addFirmMember(t, firmId, 'secretary', {
      name: 'Sam',
      email: 'sam@example.com'
    });

    const caseId = await secretary.authed.mutation(api.cases.create, {
      internalNumber: 'C-0003',
      caseTypeId,
      primaryLawyerId: lawyer.userId
    });
    expect(caseId).toBeDefined();
  });

  test('a Secretary CANNOT assign a case to a user who is not a firm member', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const secretary = await addFirmMember(t, firmId, 'secretary', {
      name: 'Sam',
      email: 'sam@example.com'
    });
    const outsider = await createAuthedUser(t, {
      name: 'Outsider',
      email: 'outsider@example.com'
    });

    await expectRejectedWithCode(
      secretary.authed.mutation(api.cases.create, {
        internalNumber: 'C-0008',
        caseTypeId,
        primaryLawyerId: outsider.userId
      }),
      ERROR_CODES.NOT_A_FIRM_MEMBER
    );
  });

  test('an Associate cannot read a case they are not assigned to', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com'
    });
    const associate = await addFirmMember(t, firmId, 'associate', {
      name: 'Ana',
      email: 'ana@example.com'
    });

    const caseId = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-0004',
      caseTypeId,
      primaryLawyerId: lawyer.userId
    });

    await expectRejectedWithCode(
      associate.authed.query(api.cases.get, { caseId }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  });

  test('an Associate cannot close a case, even their own', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const associate = await addFirmMember(t, firmId, 'associate', {
      name: 'Ana',
      email: 'ana@example.com'
    });

    const caseId = await associate.authed.mutation(api.cases.create, {
      internalNumber: 'C-0005',
      caseTypeId,
      primaryLawyerId: associate.userId
    });

    await expectRejectedWithCode(
      associate.authed.mutation(api.cases.updateStatus, {
        caseId,
        status: 'closed'
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  });

  test('status transitions follow the lifecycle order — cannot skip from intake straight to closed', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com'
    });

    const caseId = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-0006',
      caseTypeId,
      primaryLawyerId: lawyer.userId
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.cases.updateStatus, {
        caseId,
        status: 'closed'
      }),
      ERROR_CODES.INVALID_STATUS_TRANSITION
    );
  });

  test('archiving a case keeps it fully visible in search and list, not soft-deleted', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina@example.com'
    });

    const caseId = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-0007',
      caseTypeId,
      primaryLawyerId: lawyer.userId
    });
    // Walk the full legal transition chain to 'closed', then to 'archived'.
    for (const status of [
      'filed',
      'in_hearings',
      'verdict',
      'execution',
      'closed',
      'archived'
    ] as const) {
      await lawyer.authed.mutation(api.cases.updateStatus, { caseId, status });
    }

    const listed = await lawyer.authed.query(api.cases.list, {
      paginationOpts: { numItems: 10, cursor: null }
    });
    const found = listed.page.find((c) => c._id === caseId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('archived');

    const stored = await t.run(async (ctx) => ctx.db.get('cases', caseId));
    expect(stored?.deletedAt).toBeUndefined();
  });

  test('case IDs never cross tenant boundaries', async () => {
    const t = makeTest();
    const { owner: localOwner } = await bootstrapFirm(t);
    const { owner: foreignOwner } = await bootstrapFirm(t, {
      ownerName: 'Foreign Owner',
      ownerEmail: 'foreign-owner@example.com',
      firmName: 'Foreign Firm'
    });
    const foreignCaseTypeId = await seedCaseType(t, foreignOwner);
    const foreignCaseId = await foreignOwner.authed.mutation(api.cases.create, {
      internalNumber: 'FOREIGN-001',
      caseTypeId: foreignCaseTypeId,
      primaryLawyerId: foreignOwner.userId
    });

    await expectRejectedWithCode(
      localOwner.authed.query(api.cases.get, { caseId: foreignCaseId }),
      ERROR_CODES.CASE_NOT_FOUND
    );
  });

  test('the cases table returns exact status totals and numbered pages', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);

    for (let index = 1; index <= 12; index += 1) {
      await owner.authed.mutation(api.cases.create, {
        internalNumber: `TABLE-${String(index).padStart(2, '0')}`,
        caseTypeId,
        primaryLawyerId: owner.userId
      });
    }

    const firstPage = await owner.authed.query(api.cases.listTablePage, {
      page: 1,
      pageSize: 10
    });
    const secondPage = await owner.authed.query(api.cases.listTablePage, {
      page: 2,
      pageSize: 10
    });

    expect(firstPage.totalRows).toBe(12);
    expect(firstPage.statusCounts.intake).toBe(12);
    expect(firstPage.rows).toHaveLength(10);
    expect(secondPage.rows).toHaveLength(2);
    expect(firstPage.rows[0]?.caseTypeName).toBe('Civil Claim');
  });

  test('the cases table searches, filters, and sorts before pagination', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);

    for (const item of [
      {
        internalNumber: 'Z-03',
        courtName: 'Jerusalem Court',
        claimAmount: 300
      },
      {
        internalNumber: 'A-01',
        courtName: 'Ramallah Court',
        claimAmount: 100
      },
      {
        internalNumber: 'M-02',
        courtName: 'Nablus Court',
        claimAmount: 200
      }
    ]) {
      await owner.authed.mutation(api.cases.create, {
        ...item,
        caseTypeId,
        primaryLawyerId: owner.userId
      });
    }

    const searched = await owner.authed.query(api.cases.listTablePage, {
      searchText: 'ramallah',
      page: 1,
      pageSize: 10
    });
    expect(searched.totalRows).toBe(1);
    expect(searched.rows.map((row) => row.internalNumber)).toEqual(['A-01']);

    const filteredAndSorted = await owner.authed.query(
      api.cases.listTablePage,
      {
        serializedFilter: JSON.stringify({
          id: 'root',
          type: 'group',
          connector: 'and',
          items: [
            {
              id: 'claim-filter',
              type: 'rule',
              field: 'claimAmount',
              operator: 'greaterThan',
              value: 150
            }
          ]
        }),
        sortField: 'claimAmount',
        sortDirection: 'desc',
        page: 1,
        pageSize: 1
      }
    );
    expect(filteredAndSorted.totalRows).toBe(2);
    expect(filteredAndSorted.rows.map((row) => row.internalNumber)).toEqual([
      'Z-03'
    ]);

    const alphabetic = await owner.authed.query(api.cases.listTablePage, {
      sortField: 'internalNumber',
      sortDirection: 'asc',
      page: 1,
      pageSize: 10
    });
    expect(alphabetic.rows.map((row) => row.internalNumber)).toEqual([
      'A-01',
      'M-02',
      'Z-03'
    ]);
  });

  test('status tabs and own-case scope stay in sync with lifecycle updates', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyerA = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina',
      email: 'lina-table@example.com'
    });
    const lawyerB = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Sami',
      email: 'sami-table@example.com'
    });
    const ownCaseId = await lawyerA.authed.mutation(api.cases.create, {
      internalNumber: 'OWN-TABLE',
      caseTypeId,
      primaryLawyerId: lawyerA.userId
    });
    await lawyerB.authed.mutation(api.cases.create, {
      internalNumber: 'OTHER-TABLE',
      caseTypeId,
      primaryLawyerId: lawyerB.userId
    });
    await lawyerA.authed.mutation(api.cases.updateStatus, {
      caseId: ownCaseId,
      status: 'filed'
    });

    const filed = await lawyerA.authed.query(api.cases.listTablePage, {
      status: 'filed',
      page: 1,
      pageSize: 10
    });

    expect(filed.totalRows).toBe(1);
    expect(filed.statusCounts.intake).toBe(0);
    expect(filed.statusCounts.filed).toBe(1);
    expect(filed.rows.map((row) => row.internalNumber)).toEqual(['OWN-TABLE']);
    expect(filed.rows[0]?.primaryLawyerName).toBe('Lina');
  });
});
