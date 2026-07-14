import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { createCaseType } from '../model/caseTypes/caseTypes.ts';

const DEFAULT_CASE_TYPES = [
  {
    key: 'civil',
    label: 'مدني',
    requiredPartyRoles: ['plaintiff', 'defendant'] as const
  },
  {
    key: 'criminal',
    label: 'جزائي',
    requiredPartyRoles: ['plaintiff', 'defendant'] as const
  },
  {
    key: 'family',
    label: 'أحوال شخصية',
    requiredPartyRoles: ['plaintiff', 'defendant'] as const
  },
  {
    key: 'labor',
    label: 'عمل',
    requiredPartyRoles: ['plaintiff', 'defendant'] as const
  },
  {
    key: 'execution',
    label: 'تنفيذ',
    requiredPartyRoles: ['plaintiff', 'defendant'] as const
  }
] as const;

/**
 * Idempotent starter taxonomy for a firm. Safe to re-run — skips keys that
 * already exist (including soft-deleted rows that still occupy the key).
 */
export const seedDefaults = internalMutation({
  args: { firmId: v.id('firms') },
  returns: v.object({
    created: v.number(),
    skipped: v.number()
  }),
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;

    for (const caseType of DEFAULT_CASE_TYPES) {
      const existing = await ctx.db
        .query('caseTypes')
        .withIndex('by_firm_key', (q) =>
          q.eq('firmId', args.firmId).eq('key', caseType.key)
        )
        .unique();

      if (existing) {
        skipped += 1;
        continue;
      }

      await createCaseType(ctx, args.firmId, {
        key: caseType.key,
        label: caseType.label,
        requiredPartyRoles: [...caseType.requiredPartyRoles],
        requiredDocumentChecklist: []
      });
      created += 1;
    }

    return { created, skipped };
  }
});
