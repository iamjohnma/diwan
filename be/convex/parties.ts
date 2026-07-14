import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import {
  findOrCreateParty,
  updateParty,
  requireAccessibleParty,
  softDeleteParty,
} from './model/parties/parties.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { boundedPagination } from './lib/pagination.ts';
import { normalizeSearchText } from './lib/search/normalizeSearchText.ts';
import { PERMISSIONS } from '@diwan/shared';

const partyDetailValidator = v.object({
  _id: v.id('parties'),
  nationalId: v.string(),
  fullName: v.string(),
  fatherName: v.optional(v.string()),
  dob: v.optional(v.number()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
});

function toDetail(party: {
  _id: import('./_generated/dataModel').Id<'parties'>;
  nationalId: string;
  fullName: string;
  fatherName?: string;
  dob?: number;
  phone?: string;
  address?: string;
}) {
  return {
    _id: party._id,
    nationalId: party.nationalId,
    fullName: party.fullName,
    fatherName: party.fatherName,
    dob: party.dob,
    phone: party.phone,
    address: party.address,
  };
}

const partyArgs = {
  nationalId: v.string(),
  fullName: v.string(),
  fatherName: v.optional(v.string()),
  dob: v.optional(v.number()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
};

export const create = firmMutation({
  args: partyArgs,
  returns: v.id('parties'),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_WRITE);
    const { partyId, resolution } = await findOrCreateParty(ctx, ctx.firmId, args);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'parties',
      entityId: partyId,
      action:
        resolution === 'created'
          ? 'create'
          : resolution === 'restored'
            ? 'restore'
            : 'dedupe_resolved_to_existing',
      after: args,
    });
    return partyId;
  },
});

export const update = firmMutation({
  args: {
    partyId: v.id('parties'),
    fullName: v.optional(v.string()),
    fatherName: v.optional(v.string()),
    dob: v.optional(v.number()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_WRITE);
    const { partyId, ...fields } = args;
    const party = await requireAccessibleParty(ctx, ctx.firmId, partyId);
    const before = toDetail(party);
    await updateParty(ctx, party, fields);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'parties',
      entityId: partyId,
      action: 'update',
      before,
      after: fields,
    });
    return null;
  },
});

export const remove = firmMutation({
  args: { partyId: v.id('parties') },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_DELETE);
    const party = await requireAccessibleParty(ctx, ctx.firmId, args.partyId);
    await softDeleteParty(ctx, party._id);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'parties',
      entityId: party._id,
      action: 'archive',
    });
    return null;
  },
});

export const get = firmQuery({
  args: { partyId: v.id('parties') },
  returns: partyDetailValidator,
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_READ);
    const party = await requireAccessibleParty(ctx, ctx.firmId, args.partyId);
    return toDetail(party);
  },
});

export const list = firmQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(partyDetailValidator),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_READ);
    const result = await ctx.db
      .query('parties')
      .withIndex('by_firm_deleted_created', (q) => q.eq('firmId', ctx.firmId).eq('deletedAt', undefined))
      .paginate(boundedPagination(args.paginationOpts));
    return { ...result, page: result.page.map(toDetail) };
  },
});

export const search = firmQuery({
  args: { queryText: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(partyDetailValidator),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_READ);
    const normalized = normalizeSearchText(args.queryText);
    const result = await ctx.db
      .query('parties')
      .withSearchIndex('search_text', (q) =>
        q.search('searchText', normalized).eq('firmId', ctx.firmId).eq('deletedAt', undefined),
      )
      .paginate(boundedPagination(args.paginationOpts));
    return { ...result, page: result.page.map(toDetail) };
  },
});
