import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

describe('parties', () => {
  test('creating a party with a new nationalId inserts a new row', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);

    const partyId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900123456',
      fullName: 'Ahmad Khalil',
    });
    const party = await owner.authed.query(api.parties.get, { partyId });
    expect(party?.fullName).toBe('Ahmad Khalil');
  });

  test('creating a second party with the SAME nationalId resolves to the same record, not a duplicate', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);

    const firstId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900123456',
      fullName: 'Ahmad Khalil',
    });
    const secondId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900123456',
      fullName: 'Ahmad K. Khalil', // slightly different spelling on second intake
    });

    expect(secondId).toBe(firstId);
    const all = await t.run(async (ctx) => ctx.db.query('parties').collect());
    expect(all).toHaveLength(1);
  });

  test('two parties with the same full name but DIFFERENT nationalId never merge', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);

    const firstId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900111111',
      fullName: 'Ahmad Khalil',
    });
    const secondId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900222222',
      fullName: 'Ahmad Khalil',
    });

    expect(secondId).not.toBe(firstId);
    const all = await t.run(async (ctx) => ctx.db.query('parties').collect());
    expect(all).toHaveLength(2);
  });

  test('a Paralegal (no parties.write) cannot create a party', async () => {
    const t = makeTest();
    const { firmId } = await bootstrapFirm(t);
    const paralegal = await addFirmMember(t, firmId, 'paralegal', {
      name: 'Pat Paralegal',
      email: 'pat@example.com',
    });

    await expectRejectedWithCode(
      paralegal.authed.mutation(api.parties.create, {
        nationalId: '900333333',
        fullName: 'New Party',
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('search finds a party by a fuzzy Arabic name match (hamza/alef variant)', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    await owner.authed.mutation(api.parties.create, {
      nationalId: '900444444',
      fullName: 'أحمد فاطمة',
    });

    const result = await owner.authed.query(api.parties.search, {
      queryText: 'احمد فاطمه', // normalized-equivalent spelling, no hamza/teh-marbuta
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.fullName).toBe('أحمد فاطمة');
  });

  test('archiving (soft-deleting) a party excludes it from list but keeps the row', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    const partyId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900555555',
      fullName: 'Removed Party',
    });

    await owner.authed.mutation(api.parties.remove, { partyId });

    const listed = await owner.authed.query(api.parties.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page.find((p) => p._id === partyId)).toBeUndefined();

    const stillThere = await t.run(async (ctx) => ctx.db.get('parties', partyId));
    expect(stillThere).not.toBeNull();
    expect(stillThere?.deletedAt).toBeDefined();
  });

  test('creating the same nationalId restores its archived canonical record', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    const partyId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900555556',
      fullName: 'Canonical Name',
    });
    await owner.authed.mutation(api.parties.remove, { partyId });

    const restoredId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900555556',
      fullName: 'Different Intake Spelling',
    });

    expect(restoredId).toBe(partyId);
    const restored = await owner.authed.query(api.parties.get, { partyId });
    expect(restored?.fullName).toBe('Canonical Name');
    expect((await t.run(async (ctx) => ctx.db.get('parties', partyId)))?.deletedAt).toBeUndefined();
  });
});
