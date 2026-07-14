import { describe, expect, test } from 'vitest';
import {
  addFirmMember,
  bootstrapFirm,
  createAuthedUser,
  expectRejectedWithCode,
  makeTest,
} from './testHelpers.ts';
import { ERROR_CODES } from './lib/errors.ts';
import { api } from './_generated/api';

describe('testHelpers', () => {
  test('bootstrapFirm creates an active Owner membership', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);

    const members = await t.run(async (ctx) =>
      ctx.db
        .query('firmMembers')
        .withIndex('by_firm', (q) => q.eq('firmId', firmId))
        .collect(),
    );
    expect(members).toHaveLength(1);
    expect(members[0]?.userId).toBe(owner.userId);
    expect(members[0]?.status).toBe('active');
  });

  test('addFirmMember creates a constrained-role member on the same firm', async () => {
    const t = makeTest();
    const { firmId } = await bootstrapFirm(t);
    const secretary = await addFirmMember(t, firmId, 'secretary', {
      name: 'Front Desk',
      email: 'secretary@example.com',
    });

    const member = await t.run(async (ctx) =>
      ctx.db
        .query('firmMembers')
        .withIndex('by_firm_user', (q) => q.eq('firmId', firmId).eq('userId', secretary.userId))
        .unique(),
    );
    expect(member?.status).toBe('active');
  });

  test('expectRejectedWithCode passes through the AppError code', async () => {
    const t = makeTest();
    // A real production firm-scoped query must reject before firm resolution.
    await expectRejectedWithCode(
      t.query(api.caseTypes.list, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.UNAUTHENTICATED,
    );
  });

  test('an authenticated user without an active firm gets FIRM_NOT_FOUND', async () => {
    const t = makeTest();
    const user = await createAuthedUser(t, {
      name: 'No Firm',
      email: 'no-firm@example.com',
    });

    await expectRejectedWithCode(
      user.authed.query(api.caseTypes.list, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.FIRM_NOT_FOUND,
    );
  });

  test('an explicit foreign firmId gets NOT_A_FIRM_MEMBER', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    const { firmId: foreignFirmId } = await bootstrapFirm(t, {
      ownerName: 'Foreign Owner',
      ownerEmail: 'foreign-owner@example.com',
      firmName: 'Foreign Firm',
    });

    await expectRejectedWithCode(
      owner.authed.query(api.caseTypes.list, {
        firmId: foreignFirmId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.NOT_A_FIRM_MEMBER,
    );
  });

  test('a pending firm member gets NOT_A_FIRM_MEMBER', async () => {
    const t = makeTest();
    const { firmId } = await bootstrapFirm(t);
    const member = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Pending Lawyer',
      email: 'pending@example.com',
    });
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('firmMembers')
        .withIndex('by_firm_user', (query) =>
          query.eq('firmId', firmId).eq('userId', member.userId),
        )
        .unique();
      if (!membership) throw new Error('missing membership');
      await ctx.db.patch('firmMembers', membership._id, { status: 'pending' });
    });

    await expectRejectedWithCode(
      member.authed.query(api.caseTypes.list, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.NOT_A_FIRM_MEMBER,
    );
  });

  test('an archived user gets UNAUTHENTICATED', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    await t.run(async (ctx) => {
      await ctx.db.patch('users', owner.userId, { archivedAt: Date.now() });
    });

    await expectRejectedWithCode(
      owner.authed.query(api.caseTypes.list, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.UNAUTHENTICATED,
    );
  });
});
