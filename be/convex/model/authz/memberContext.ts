import type { Id } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import { RBAC, type PermissionString } from '@diwan/shared';

export interface MemberContextFacts {
  memberId: Id<'firmMembers'>;
  roleId: Id<'roles'>;
  roleName: string;
  isOwner: boolean;
  permissions: ReadonlySet<PermissionString>;
}

type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

// Resolves the permission set exactly once, from the role's permissions
// plus per-member grant/revoke overrides (Backend Manifesto §4). Owners get
// the wildcard, never an enumerated list. Returns null for a pending
// invite or a deleted membership — the ladder turns that into
// NOT_A_FIRM_MEMBER, never a partial/empty-permission pass-through.
export async function loadMemberContext(
  ctx: ReadCtx,
  userId: Id<'users'>,
  firmId: Id<'firms'>,
): Promise<MemberContextFacts | null> {
  const member = await ctx.db
    .query('firmMembers')
    .withIndex('by_firm_user', (q) => q.eq('firmId', firmId).eq('userId', userId))
    .unique();
  if (!member || member.status !== 'active' || member.deletedAt !== undefined) return null;

  const role = await ctx.db.get('roles', member.roleId);
  if (!role) return null;
  const isOwner = role.name === 'owner';

  let permissions: Set<PermissionString>;
  if (isOwner) {
    permissions = new Set([RBAC.OWNER_WILDCARD as PermissionString]);
  } else {
    permissions = new Set(role.permissions as PermissionString[]);
    const overrides = ctx.db
      .query('memberPermissionOverrides')
      .withIndex('by_member', (q) => q.eq('memberId', member._id));
    for await (const override of overrides) {
      if (override.effect === 'grant') permissions.add(override.permission as PermissionString);
      else permissions.delete(override.permission as PermissionString);
    }
  }

  return {
    memberId: member._id,
    roleId: member.roleId,
    roleName: role.name,
    isOwner,
    permissions,
  };
}
