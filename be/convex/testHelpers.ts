// convex/testHelpers.ts
import { convexTest } from 'convex-test';
import { expect } from 'vitest';
import { ConvexError } from 'convex/values';
import schema from './schema.ts';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { type ErrorCode } from './lib/errors.ts';
import {
  SYSTEM_ROLES,
  type DocumentKind,
  type PartyRole,
  type SystemRole,
} from '@diwan/shared';

export function makeTest() {
  // @ts-expect-error import.meta.glob is Vite-specific, not available to Convex analyzer
  const modules = import.meta.glob('./**/*.ts') as Record<string, () => Promise<unknown>>;
  return convexTest(schema, modules);
}

export type Test = ReturnType<typeof makeTest>;

export async function createAuthedUser(t: Test, fields: { name: string; email: string }) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert('users', { name: fields.name, email: fields.email }),
  );
  const authed = t.withIdentity({ subject: userId, tokenIdentifier: `test|${userId}` });
  return { userId, authed };
}

export async function bootstrapFirm(
  t: Test,
  options: {
    ownerName?: string;
    ownerEmail?: string;
    firmName?: string;
  } = {},
) {
  const owner = await createAuthedUser(t, {
    name: options.ownerName ?? 'Firm Owner',
    email: options.ownerEmail ?? 'owner@example.com',
  });
  const { firmId } = await t.mutation(internal.internal.provisioning.createFirmWithOwner, {
    firmName: options.firmName ?? 'Alpha Firm',
    firmSlug: `alpha-firm-${owner.userId}`,
    ownerUserId: owner.userId,
    seatLimit: 10,
  });
  return { owner, firmId };
}

export async function addFirmMember(
  t: Test,
  firmId: Id<'firms'>,
  roleName: SystemRole,
  fields: { name: string; email: string },
) {
  const member = await createAuthedUser(t, fields);
  await t.run(async (ctx) => {
    const role = await ctx.db
      .query('roles')
      .withIndex('by_name', (q) => q.eq('name', roleName))
      .unique();
    if (!role) {
      throw new Error(`Role "${roleName}" is not seeded — bootstrapFirm must run first`);
    }
    const now = Date.now();
    await ctx.db.insert('firmMembers', {
      firmId,
      userId: member.userId,
      roleId: role._id,
      status: 'active',
      invitedAt: now,
      joinedAt: now,
    });
    await ctx.db.patch('users', member.userId, { activeFirmId: firmId });
  });
  return member;
}

export type TestUser = Awaited<ReturnType<typeof createAuthedUser>>;

export async function seedCaseType(
  _test: Test,
  owner: TestUser,
  options: {
    key?: string;
    label?: string;
    requiredPartyRoles?: PartyRole[];
    requiredDocumentChecklist?: DocumentKind[];
  } = {},
): Promise<Id<'caseTypes'>> {
  return await owner.authed.mutation(api.caseTypes.create, {
    key: options.key ?? 'civil-claim',
    label: options.label ?? 'Civil Claim',
    requiredPartyRoles: options.requiredPartyRoles ?? ['plaintiff', 'defendant'],
    requiredDocumentChecklist: options.requiredDocumentChecklist ?? [],
  });
}

export async function seedCase(
  _test: Test,
  caseTypeId: Id<'caseTypes'>,
  lawyer: TestUser,
  internalNumber = 'C-1000',
): Promise<Id<'cases'>> {
  return await lawyer.authed.mutation(api.cases.create, {
    internalNumber,
    caseTypeId,
    primaryLawyerId: lawyer.userId,
  });
}

export async function seedParty(
  _test: Test,
  owner: TestUser,
  nationalId: string,
  fullName: string,
): Promise<Id<'parties'>> {
  return await owner.authed.mutation(api.parties.create, {
    nationalId,
    fullName,
  });
}

export async function expectRejectedWithCode(
  promise: Promise<unknown>,
  code: ErrorCode,
): Promise<void> {
  let thrown: unknown;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ConvexError);
  expect((thrown as ConvexError<{ code: ErrorCode }>).data.code).toBe(code);
}
