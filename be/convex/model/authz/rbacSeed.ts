import type { MutationCtx } from '../../_generated/server';
import {
  SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  RBAC,
  normalizePermissionDependencies,
  type PermissionString,
} from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;

// Idempotent upsert of the six system roles and their permission sets
// (PRD §6) — a fresh database and a schema upgrade both converge to the
// same authorization state, so a new permission added to
// DEFAULT_ROLE_PERMISSIONS rolls out automatically on the next deploy's
// `rbac:seed` step, no manual migration needed.
export async function ensureRbacSeeded(ctx: WriteCtx): Promise<void> {
  const now = Date.now();
  for (const roleName of SYSTEM_ROLES) {
    const permissions: PermissionString[] =
      roleName === 'owner'
        ? [RBAC.OWNER_WILDCARD as PermissionString]
        : Array.from(normalizePermissionDependencies(new Set(DEFAULT_ROLE_PERMISSIONS[roleName])));

    const existing = await ctx.db
      .query('roles')
      .withIndex('by_name', (q) => q.eq('name', roleName))
      .unique();

    if (existing) {
      await ctx.db.patch('roles', existing._id, { permissions, isSystemRole: true, updatedAt: now });
    } else {
      await ctx.db.insert('roles', {
        name: roleName,
        permissions,
        isSystemRole: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
