import type { Id, Doc } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import type { PaginationOptions, PaginationResult } from 'convex/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { boundedPagination } from '../../lib/pagination.ts';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText.ts';
import { filterCaseScopedPage, requireAccessibleCase } from '../authz/owned.ts';
import { createFirstVersion } from './versions.ts';
import type { DocumentKind, ConfidentialityLevel, PermissionString } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

interface ScopedCtx {
  userId: Id<'users'>;
  permissions: ReadonlySet<PermissionString>;
}

export interface CreateDocumentFields {
  caseId: Id<'cases'>;
  kind: DocumentKind;
  confidentialityLevel: ConfidentialityLevel;
  title: string;
  storageId: Id<'_storage'>;
}

export async function createDocument(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  uploadedBy: Id<'users'>,
  fields: CreateDocumentFields,
): Promise<Id<'documents'>> {
  const now = Date.now();
  const documentId = await ctx.db.insert('documents', {
    firmId,
    caseId: fields.caseId,
    kind: fields.kind,
    confidentialityLevel: fields.confidentialityLevel,
    title: fields.title,
    searchText: normalizeSearchText(fields.title),
    createdAt: now,
    updatedAt: now,
  });
  await createFirstVersion(ctx, firmId, documentId, fields.storageId, uploadedBy);
  return documentId;
}

/**
 * Loads a document, verifies it belongs to the caller's firm and isn't
 * soft-deleted, then delegates to requireAccessibleCase for the same
 * own-vs-all case-scoping every other case-scoped resource uses — a
 * document's access is entirely inherited from its parent case, since
 * documents carry no primaryLawyerId of their own (Global Constraints).
 */
export async function requireAccessibleDocument(
  ctx: ReadCtx & ScopedCtx,
  firmId: Id<'firms'>,
  documentId: Id<'documents'>,
): Promise<Doc<'documents'>> {
  const document = await ctx.db.get('documents', documentId);
  if (!document || document.firmId !== firmId || document.deletedAt !== undefined) {
    throw new AppError(ERROR_CODES.DOCUMENT_NOT_FOUND);
  }
  await requireAccessibleCase(ctx, firmId, document.caseId);
  return document;
}

export interface UpdateDocumentFields {
  title?: string;
  kind?: DocumentKind;
  confidentialityLevel?: ConfidentialityLevel;
}

export async function updateDocumentMetadata(
  ctx: Pick<MutationCtx, 'db'>,
  document: Doc<'documents'>,
  fields: UpdateDocumentFields,
): Promise<void> {
  await ctx.db.patch('documents', document._id, {
    title: fields.title ?? document.title,
    kind: fields.kind ?? document.kind,
    confidentialityLevel: fields.confidentialityLevel ?? document.confidentialityLevel,
    searchText: fields.title === undefined ? document.searchText : normalizeSearchText(fields.title),
    updatedAt: Date.now(),
  });
}

export async function softDeleteDocument(ctx: Pick<MutationCtx, 'db'>, documentId: Id<'documents'>): Promise<void> {
  await ctx.db.patch('documents', documentId, { deletedAt: Date.now(), updatedAt: Date.now() });
}

export async function listDocumentsForCase(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Doc<'documents'>>> {
  return await ctx.db
    .query('documents')
    .withIndex('by_case_deleted', (q) => q.eq('caseId', caseId).eq('deletedAt', undefined))
    .paginate(boundedPagination(paginationOpts));
}

export interface ChecklistStatusEntry {
  kind: DocumentKind;
  satisfied: boolean;
}

/**
 * Cross-references the case type's requiredDocumentChecklist against the
 * case's actual non-deleted documents, grouped by kind (design spec §2.6).
 * Document kinds are a fixed seven-value catalog, so indexed existence reads
 * stay bounded regardless of how many files a case accumulates.
 */
export async function computeChecklistStatus(
  ctx: ReadCtx,
  caseDoc: Doc<'cases'>,
): Promise<ChecklistStatusEntry[]> {
  const caseType = await ctx.db.get('caseTypes', caseDoc.caseTypeId);
  if (!caseType) throw new AppError(ERROR_CODES.CASE_TYPE_NOT_FOUND);
  return await Promise.all(
    caseType.requiredDocumentChecklist.map(async (kind) => {
      const document = await ctx.db
        .query('documents')
        .withIndex('by_case_deleted_kind', (query) =>
          query.eq('caseId', caseDoc._id).eq('deletedAt', undefined).eq('kind', kind),
        )
        .first();
      return { kind, satisfied: document !== null };
    }),
  );
}

/**
 * Firm-wide search-index query, post-filtered per result to the caller's
 * own-vs-all case access (design spec §2.8, corrected at final
 * whole-branch review). Documents have no readOwn/readAll split of their
 * own — access is entirely inherited from the parent case, same as
 * requireAccessibleDocument — so a flat DOCUMENTS_READ gate alone would
 * let a Lawyer/Associate (CASES_READ_OWN only) see title/
 * confidentialityLevel/caseId for colleagues' cases they cannot open via
 * get/list/getDownloadUrl. Mirrors listCasesForParty's own-vs-all pattern
 * exactly (model/caseParties/caseParties.ts, Plan 1) — a bounded per-page
 * fan-out of case lookups, not a firm-wide scan.
 */
export async function searchDocumentsForCaller(
  ctx: ReadCtx & ScopedCtx,
  firmId: Id<'firms'>,
  queryText: string,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Doc<'documents'>>> {
  const normalized = normalizeSearchText(queryText);
  const result = await ctx.db
    .query('documents')
    .withSearchIndex('search_text', (q) =>
      q.search('searchText', normalized).eq('firmId', firmId).eq('deletedAt', undefined),
    )
    .paginate(boundedPagination(paginationOpts));

  return await filterCaseScopedPage(ctx, firmId, result);
}
