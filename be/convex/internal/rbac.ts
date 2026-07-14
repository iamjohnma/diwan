// Server-only — the client cannot call this. Invoked by the deploy
// pipeline (package.json's `rbac:seed` script), never exposed as a public
// mutation (Backend Manifesto §8).
import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { ensureRbacSeeded } from '../model/authz/rbacSeed.ts';
import { SYSTEM_ROLES } from '@diwan/shared';

export const seed = internalMutation({
  args: {},
  returns: v.object({ roles: v.number() }),
  handler: async (ctx) => {
    await ensureRbacSeeded(ctx);
    return { roles: SYSTEM_ROLES.length };
  },
});
