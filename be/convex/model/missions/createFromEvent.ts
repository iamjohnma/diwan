import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import type { MissionType, MissionPriority } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;

export interface MissionEventFields {
  caseId: Id<'cases'>;
  title: string;
  type: MissionType;
  assigneeId: Id<'users'>;
  dueDate: number;
  priority: MissionPriority;
}

/**
 * Inserts one mission row from a structured event. Deliberately minimal
 * (design spec §2.4) — just the insert path the bounced-check cascade
 * needs, not the missions module itself. M3 builds list/complete/UI
 * around the same table and is expected to reuse this exact helper for
 * its own verdict/hearing-driven auto-generation.
 */
export async function createMissionFromEvent(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  fields: MissionEventFields,
): Promise<Id<'missions'>> {
  const now = Date.now();
  return await ctx.db.insert('missions', {
    firmId,
    caseId: fields.caseId,
    title: fields.title,
    type: fields.type,
    assigneeId: fields.assigneeId,
    dueDate: fields.dueDate,
    priority: fields.priority,
    status: 'todo',
    checklist: [],
    createdAt: now,
    updatedAt: now,
  });
}
