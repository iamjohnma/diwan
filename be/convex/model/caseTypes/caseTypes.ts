import type { Id, Doc } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import type { PartyRole } from '@diwan/shared';
import type { DocumentKind } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

export interface CreateCaseTypeFields {
  key: string;
  label: string;
  requiredPartyRoles: PartyRole[];
  requiredDocumentChecklist: DocumentKind[];
}

export async function createCaseType(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  fields: CreateCaseTypeFields,
): Promise<Id<'caseTypes'>> {
  return await ctx.db.insert('caseTypes', {
    firmId,
    key: fields.key,
    label: fields.label,
    requiredPartyRoles: [...new Set(fields.requiredPartyRoles)],
    requiredDocumentChecklist: [...new Set(fields.requiredDocumentChecklist)],
    createdAt: Date.now(),
  });
}

export async function requireCaseType(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  caseTypeId: Id<'caseTypes'>,
): Promise<Doc<'caseTypes'>> {
  const caseType = await ctx.db.get('caseTypes', caseTypeId);
  if (!caseType || caseType.firmId !== firmId || caseType.deletedAt !== undefined) {
    throw new AppError(ERROR_CODES.CASE_TYPE_NOT_FOUND);
  }
  return caseType;
}
