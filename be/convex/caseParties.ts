import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { requireAccessibleCase, requireCasePermission } from './model/authz/owned.ts';
import { requireLawyerIsFirmMember } from './model/cases/cases.ts';
import { requireAccessibleParty } from './model/parties/parties.ts';
import { addCaseParty, listPartiesForCase, listCasesForParty } from './model/caseParties/caseParties.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { literalUnion } from './lib/validators.ts';
import { PERMISSIONS, PARTY_ROLES } from '@diwan/shared';

const roleValidator = literalUnion(PARTY_ROLES);

const casePartyValidator = v.object({
  _id: v.id('caseParties'),
  caseId: v.id('cases'),
  partyId: v.id('parties'),
  role: roleValidator,
  representingLawyerId: v.optional(v.id('users')),
  powerOfAttorneyRef: v.optional(v.string()),
});

export const add = firmMutation({
  args: {
    caseId: v.id('cases'),
    partyId: v.id('parties'),
    role: roleValidator,
    representingLawyerId: v.optional(v.id('users')),
    powerOfAttorneyRef: v.optional(v.string()),
  },
  returns: v.id('caseParties'),
  handler: async (ctx, args) => {
    await requireCasePermission(
      ctx,
      ctx.firmId,
      args.caseId,
      PERMISSIONS.CASES_WRITE_OWN,
      PERMISSIONS.CASES_WRITE_ALL,
    );
    await requireAccessibleParty(ctx, ctx.firmId, args.partyId);
    if (args.representingLawyerId) {
      await requireLawyerIsFirmMember(ctx, ctx.firmId, args.representingLawyerId);
    }

    const casePartyId = await addCaseParty(ctx, ctx.firmId, args.caseId, args.partyId, {
      role: args.role,
      representingLawyerId: args.representingLawyerId,
      powerOfAttorneyRef: args.powerOfAttorneyRef,
    });
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'caseParties',
      entityId: casePartyId,
      action: 'create',
      after: args,
    });
    return casePartyId;
  },
});

export const listForCase = firmQuery({
  args: {
    caseId: v.id('cases'),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(casePartyValidator),
  handler: async (ctx, args) => {
    await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_READ);
    const result = await listPartiesForCase(ctx, args.caseId, args.paginationOpts);
    return {
      ...result,
      page: result.page.map((row) => ({
        _id: row._id,
        caseId: row.caseId,
        partyId: row.partyId,
        role: row.role,
        representingLawyerId: row.representingLawyerId,
        powerOfAttorneyRef: row.powerOfAttorneyRef,
      })),
    };
  },
});

export const listForParty = firmQuery({
  args: { partyId: v.id('parties'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(casePartyValidator),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_READ);
    await requireAccessibleParty(ctx, ctx.firmId, args.partyId);
    const result = await listCasesForParty(ctx, ctx.firmId, args.partyId, args.paginationOpts);
    return {
      ...result,
      page: result.page.map((row) => ({
        _id: row._id,
        caseId: row.caseId,
        partyId: row.partyId,
        role: row.role,
        representingLawyerId: row.representingLawyerId,
        powerOfAttorneyRef: row.powerOfAttorneyRef,
      })),
    };
  },
});
