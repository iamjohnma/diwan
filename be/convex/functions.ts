// The spine of the backend (Backend Manifesto §3). Every client-callable
// feature function uses one of this pair:
//
//   query / mutation
//     -> firmQuery / firmMutation          +user, +firm, +member permissions
//
// The optional firmId supports explicit workspace switching and otherwise
// falls back to activeFirmId. Additional builder layers should only be added
// when a real endpoint needs a different context contract.

import { v } from 'convex/values';
import { customQuery, customMutation } from 'convex-helpers/server/customFunctions';
import { getAuthUserId } from '@convex-dev/auth/server';
import { query, mutation, type QueryCtx, type MutationCtx } from './_generated/server';
import type { Id, Doc } from './_generated/dataModel';
import { AppError, ERROR_CODES } from './lib/errors.ts';
import { RBAC, type PermissionString } from '@diwan/shared';
import { loadMemberContext, type MemberContextFacts } from './model/authz/memberContext.ts';

type AuthableCtx = QueryCtx | MutationCtx;

interface AuthedFacts {
  userId: Id<'users'>;
  currentUser: Doc<'users'>;
}

// The one place authentication happens.
async function loadAuthenticatedUser(ctx: AuthableCtx): Promise<AuthedFacts> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
  const currentUser = await ctx.db.get('users', userId);
  if (!currentUser) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
  if (currentUser.archivedAt !== undefined) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
  return { userId, currentUser };
}

interface FirmMembershipFacts extends AuthedFacts, MemberContextFacts {
  firmId: Id<'firms'>;
}

async function resolveFirmMembership(
  ctx: AuthableCtx,
  authed: AuthedFacts,
  resolvedFirmId: Id<'firms'> | undefined,
): Promise<FirmMembershipFacts> {
  if (!resolvedFirmId) throw new AppError(ERROR_CODES.FIRM_NOT_FOUND);
  const memberCtx = await loadMemberContext(ctx, authed.userId, resolvedFirmId);
  if (!memberCtx) throw new AppError(ERROR_CODES.NOT_A_FIRM_MEMBER);
  return { ...authed, firmId: resolvedFirmId, ...memberCtx };
}

// Accepts an optional firmId argument and falls back to the active firm.
// The crucial discipline: even when a firmId arrives as an argument, it is
// validated against membership by loadMemberContext before anything reads
// with it — a client cannot pass a firm it does not belong to.
async function loadFirmMembership(
  ctx: AuthableCtx,
  firmIdArg: Id<'firms'> | undefined,
): Promise<FirmMembershipFacts> {
  const authed = await loadAuthenticatedUser(ctx);
  return resolveFirmMembership(ctx, authed, firmIdArg ?? authed.currentUser.activeFirmId);
}

export const firmQuery = customQuery(query, {
  args: { firmId: v.optional(v.id('firms')) },
  input: async (ctx, args) => {
    const facts = await loadFirmMembership(ctx, args.firmId);
    return { ctx: facts, args: {} };
  },
});

export const firmMutation = customMutation(mutation, {
  args: { firmId: v.optional(v.id('firms')) },
  input: async (ctx, args) => {
    const facts = await loadFirmMembership(ctx, args.firmId);
    return { ctx: facts, args: {} };
  },
});

// The permission gate — one line, called as a handler's first statement.
// For resource-level own-vs-others rules, use requireLawyerScopedAccess /
// requireAccessibleCase (model/authz/owned.ts) instead of hand-rolling a
// check here.
export function requireFirmPermission(
  ctx: { permissions: ReadonlySet<PermissionString> },
  permission: PermissionString,
): void {
  if (ctx.permissions.has(RBAC.OWNER_WILDCARD as PermissionString)) return;
  if (ctx.permissions.has(permission)) return;
  throw new AppError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
}
