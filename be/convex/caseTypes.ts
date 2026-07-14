import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { boundedPagination } from './lib/pagination.ts';
import { createCaseType } from './model/caseTypes/caseTypes.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { PERMISSIONS, PARTY_ROLES, DOCUMENT_KINDS } from '@diwan/shared';
import { literalUnion } from './lib/validators.ts';

const caseTypeSummaryValidator = v.object({
  _id: v.id('caseTypes'),
  key: v.string(),
  label: v.string(),
  requiredPartyRoles: v.array(literalUnion(PARTY_ROLES)),
  requiredDocumentChecklist: v.array(literalUnion(DOCUMENT_KINDS)),
});

export const create = firmMutation({
  args: {
    key: v.string(),
    label: v.string(),
    requiredPartyRoles: v.array(literalUnion(PARTY_ROLES)),
    requiredDocumentChecklist: v.array(literalUnion(DOCUMENT_KINDS)),
  },
  returns: v.id('caseTypes'),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    const fields = {
      ...args,
      requiredPartyRoles: [...new Set(args.requiredPartyRoles)],
      requiredDocumentChecklist: [...new Set(args.requiredDocumentChecklist)],
    };
    const caseTypeId = await createCaseType(ctx, ctx.firmId, fields);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'caseTypes',
      entityId: caseTypeId,
      action: 'create',
      after: fields,
    });
    return caseTypeId;
  },
});

export const list = firmQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(caseTypeSummaryValidator),
  handler: async (ctx, args) => {
    // Taxonomy powers every case-intake form; only mutations are settings-gated.
    const result = await ctx.db
      .query('caseTypes')
      .withIndex('by_firm_deleted', (q) => q.eq('firmId', ctx.firmId).eq('deletedAt', undefined))
      .paginate(boundedPagination(args.paginationOpts));
    return {
      ...result,
      page: result.page.map((row) => ({
        _id: row._id,
        key: row.key,
        label: row.label,
        requiredPartyRoles: row.requiredPartyRoles,
        requiredDocumentChecklist: row.requiredDocumentChecklist,
      })),
    };
  },
});
