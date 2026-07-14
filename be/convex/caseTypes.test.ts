import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

describe('caseTypes', () => {
  test('Owner can create a case type and repeated requirements are stored once', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);

    const caseTypeId = await owner.authed.mutation(api.caseTypes.create, {
      key: 'civil-claim',
      label: 'Civil Claim',
      requiredPartyRoles: ['plaintiff', 'defendant', 'plaintiff'],
      requiredDocumentChecklist: ['pleading', 'pleading'],
    });
    expect(caseTypeId).toBeDefined();
    const result = await owner.authed.query(api.caseTypes.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page[0]?.requiredPartyRoles).toEqual(['plaintiff', 'defendant']);
    expect(result.page[0]?.requiredDocumentChecklist).toEqual(['pleading']);
  });

  test('a Lawyer (no settings.manage permission) cannot create a case type', async () => {
    const t = makeTest();
    const { firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina Lawyer',
      email: 'lina@example.com',
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.caseTypes.create, {
        key: 'civil-claim',
        label: 'Civil Claim',
        requiredPartyRoles: ['plaintiff'],
        requiredDocumentChecklist: [],
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('list returns only this firm\'s non-deleted case types', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    await owner.authed.mutation(api.caseTypes.create, {
      key: 'civil-claim',
      label: 'Civil Claim',
      requiredPartyRoles: ['plaintiff', 'defendant'],
      requiredDocumentChecklist: [],
    });

    const result = await owner.authed.query(api.caseTypes.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.key).toBe('civil-claim');
  });
});
