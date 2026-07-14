// Server-only. This IS the v1 onboarding flow (PRD §5.6) — there is no
// public signup route; a staff member runs this against the deployment to
// bring a new design-partner firm online.
//
// Scope note: this mutation links an ALREADY-EXISTING user account to a
// brand-new firm as its Owner. Creating the underlying credential itself
// (email+password / OAuth via @convex-dev/auth) is a separate step that
// happens through the auth library's own account-creation path once
// Phase 0 §1.1.4's auth wiring is complete — that path isn't guessed at
// here rather than fabricated against an unverified API shape. The staff
// runbook is: create the auth account first (however @convex-dev/auth ends
// up doing that for this project), then call this with the resulting
// userId.
import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { AppError, ERROR_CODES } from '../lib/errors.ts';
import { ensureRbacSeeded } from '../model/authz/rbacSeed.ts';

export const createFirmWithOwner = internalMutation({
  args: {
    firmName: v.string(),
    firmSlug: v.string(),
    ownerUserId: v.id('users'),
    seatLimit: v.number(),
  },
  returns: v.object({ firmId: v.id('firms'), memberId: v.id('firmMembers') }),
  handler: async (ctx, args) => {
    // Idempotent — safe even if the deploy pipeline already seeded RBAC;
    // guarantees the owner role exists before this runs standalone.
    await ensureRbacSeeded(ctx);
    const ownerRole = await ctx.db
      .query('roles')
      .withIndex('by_name', (q) => q.eq('name', 'owner'))
      .unique();
    if (!ownerRole) throw new AppError(ERROR_CODES.ROLE_NOT_FOUND);

    const now = Date.now();
    const firmId = await ctx.db.insert('firms', {
      name: args.firmName,
      slug: args.firmSlug,
      createdAt: now,
    });
    // billingNotes intentionally omitted: manual/invoiced billing (PRD
    // §5.6) means there's nothing to record until the first invoice.
    await ctx.db.insert('subscriptions', {
      firmId,
      plan: 'standard',
      seatLimit: args.seatLimit,
      status: 'trial',
      createdAt: now,
      updatedAt: now,
    });
    const memberId = await ctx.db.insert('firmMembers', {
      firmId,
      userId: args.ownerUserId,
      roleId: ownerRole._id,
      status: 'active',
      invitedAt: now,
      joinedAt: now,
    });
    await ctx.db.patch('users', args.ownerUserId, { activeFirmId: firmId });

    return { firmId, memberId };
  },
});
