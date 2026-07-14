import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm } from '../../testHelpers.ts';
import { recordAuditEvent } from './recordAuditEvent.ts';

describe('recordAuditEvent', () => {
  test('inserts an auditLog row with JSON-stringified before/after snapshots', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);

    await t.run(async (ctx) => {
      await recordAuditEvent(ctx, {
        firmId,
        actorId: owner.userId,
        entityType: 'cases',
        entityId: 'fake-case-id',
        action: 'create',
        before: undefined,
        after: { status: 'intake' },
      });
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('auditLog')
        .withIndex('by_firm_created', (q) => q.eq('firmId', firmId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityType).toBe('cases');
    expect(rows[0]?.action).toBe('create');
    expect(rows[0]?.before).toBeUndefined();
    expect(JSON.parse(rows[0]?.after ?? '{}')).toEqual({ status: 'intake' });
  });
});
