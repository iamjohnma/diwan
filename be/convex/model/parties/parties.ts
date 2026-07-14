import type { Id, Doc } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText.ts';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

export interface PartyFields {
  nationalId: string;
  fullName: string;
  fatherName?: string;
  dob?: number;
  phone?: string;
  address?: string;
}

function computeSearchText(fields: PartyFields): string {
  // Deliberately excludes phone/dob/address — only name-like fields feed
  // fuzzy search (PLAN §2: "excluding numeric/date-shaped tokens").
  return normalizeSearchText([fields.fullName, fields.fatherName ?? ''].join(' ').trim());
}

/**
 * nationalId is the ONLY dedup key (PRD's no-OTP decision). If a party with
 * this nationalId already exists in the firm, returns it unchanged — it does
 * NOT patch in the new fields, so a slightly-different spelling on a second
 * intake never silently overwrites the canonical record. An archived match is
 * restored in place so the unique identity never resolves to an unusable ID.
 */
export async function findOrCreateParty(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  fields: PartyFields,
): Promise<{ partyId: Id<'parties'>; resolution: 'created' | 'existing' | 'restored' }> {
  const existing = await ctx.db
    .query('parties')
    .withIndex('by_firm_national_id', (q) => q.eq('firmId', firmId).eq('nationalId', fields.nationalId))
    .unique();
  if (existing) {
    if (existing.deletedAt !== undefined) {
      await ctx.db.patch('parties', existing._id, {
        deletedAt: undefined,
        updatedAt: Date.now(),
      });
      return { partyId: existing._id, resolution: 'restored' };
    }
    return { partyId: existing._id, resolution: 'existing' };
  }

  const now = Date.now();
  const partyId = await ctx.db.insert('parties', {
    firmId,
    nationalId: fields.nationalId,
    fullName: fields.fullName,
    fatherName: fields.fatherName,
    dob: fields.dob,
    phone: fields.phone,
    address: fields.address,
    searchText: computeSearchText(fields),
    createdAt: now,
    updatedAt: now,
  });
  return { partyId, resolution: 'created' };
}

export async function updateParty(
  ctx: WriteCtx,
  party: Doc<'parties'>,
  fields: Partial<Omit<PartyFields, 'nationalId'>>,
): Promise<void> {
  const merged: PartyFields = {
    nationalId: party.nationalId,
    fullName: fields.fullName ?? party.fullName,
    fatherName: fields.fatherName ?? party.fatherName,
    dob: fields.dob ?? party.dob,
    phone: fields.phone ?? party.phone,
    address: fields.address ?? party.address,
  };
  await ctx.db.patch('parties', party._id, {
    ...fields,
    searchText: computeSearchText(merged),
    updatedAt: Date.now(),
  });
}

export async function requireAccessibleParty(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  partyId: Id<'parties'>,
): Promise<Doc<'parties'>> {
  const party = await ctx.db.get('parties', partyId);
  if (!party || party.firmId !== firmId || party.deletedAt !== undefined) {
    throw new AppError(ERROR_CODES.PARTY_NOT_FOUND);
  }
  return party;
}

export async function softDeleteParty(ctx: WriteCtx, partyId: Id<'parties'>): Promise<void> {
  await ctx.db.patch('parties', partyId, { deletedAt: Date.now(), updatedAt: Date.now() });
}
