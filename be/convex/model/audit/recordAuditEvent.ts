import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';

type WriteCtx = Pick<MutationCtx, 'db'>;

export interface RecordAuditEventArgs {
  firmId: Id<'firms'>;
  actorId: Id<'users'>;
  entityType: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export async function recordAuditEvent(ctx: WriteCtx, args: RecordAuditEventArgs): Promise<void> {
  await ctx.db.insert('auditLog', {
    firmId: args.firmId,
    actorId: args.actorId,
    entityType: args.entityType,
    entityId: args.entityId,
    action: args.action,
    before: args.before === undefined ? undefined : JSON.stringify(args.before),
    after: args.after === undefined ? undefined : JSON.stringify(args.after),
    createdAt: Date.now(),
  });
}
