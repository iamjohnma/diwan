import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx, 'db'>;

// 25 MiB — design spec §2.7.
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Design spec §2.7 — covers scans, photos, and word-processor files.
export const ALLOWED_DOCUMENT_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

export interface ValidatedBlob {
  mimeType: string;
  fileSize: number;
}

/**
 * Validates an already-uploaded blob against the allowlist/size cap
 * (design spec §2.7). Does NOT attempt to delete an invalid blob here:
 * Convex mutations are transactional across storage operations as well as
 * database writes, so a ctx.storage.delete() call immediately followed by
 * a throw in the same mutation call is rolled back along with everything
 * else and can never actually persist (verified empirically against
 * convex-test@0.0.54 — a storage.delete() before a throw inside the same
 * mutation leaves the file exactly as it was). An orphaned blob from a
 * rejected upload is therefore an accepted, documented gap, not a bug —
 * cleanup is out of scope for this plan. Callers must run this before
 * inserting any documents/documentVersions row for the blob.
 */
export async function validateUploadedBlob(
  ctx: WriteCtx,
  storageId: Id<'_storage'>,
): Promise<ValidatedBlob> {
  const metadata = await ctx.db.system.get('_storage', storageId);
  if (!metadata || !metadata.contentType || !ALLOWED_DOCUMENT_CONTENT_TYPES.has(metadata.contentType)) {
    throw new AppError(ERROR_CODES.INVALID_FILE_TYPE);
  }
  if (metadata.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new AppError(ERROR_CODES.FILE_TOO_LARGE);
  }
  return { mimeType: metadata.contentType, fileSize: metadata.size };
}

interface InsertVersionFields {
  storageId: Id<'_storage'>;
  mimeType: string;
  fileSize: number;
  uploadedBy: Id<'users'>;
}

/**
 * Inserts one immutable version row and repoints the parent document's
 * currentVersionId — both writes happen in this one mutation call, which
 * Convex commits atomically, so currentVersionId can never drift from the
 * latest version row (design spec §2.4). OCR is intentionally not scheduled
 * until an engine exists; creating an empty job for every upload adds work
 * without behavior.
 */
async function insertVersion(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  documentId: Id<'documents'>,
  versionNumber: number,
  fields: InsertVersionFields,
): Promise<Id<'documentVersions'>> {
  const versionId = await ctx.db.insert('documentVersions', {
    firmId,
    documentId,
    versionNumber,
    storageKey: fields.storageId,
    mimeType: fields.mimeType,
    fileSize: fields.fileSize,
    uploadedBy: fields.uploadedBy,
    createdAt: Date.now(),
  });
  await ctx.db.patch('documents', documentId, { currentVersionId: versionId, updatedAt: Date.now() });
  return versionId;
}

/** Creates a document's first version (versionNumber 1). Used only by createDocument. */
export async function createFirstVersion(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  documentId: Id<'documents'>,
  storageId: Id<'_storage'>,
  uploadedBy: Id<'users'>,
): Promise<Id<'documentVersions'>> {
  const { mimeType, fileSize } = await validateUploadedBlob(ctx, storageId);
  return await insertVersion(ctx, firmId, documentId, 1, { storageId, mimeType, fileSize, uploadedBy });
}

async function latestVersionNumber(ctx: ReadCtx, documentId: Id<'documents'>): Promise<number> {
  const latest = await ctx.db
    .query('documentVersions')
    .withIndex('by_document', (q) => q.eq('documentId', documentId))
    .order('desc')
    .first();
  return latest?.versionNumber ?? 0;
}

export async function addVersionToDocument(
  ctx: WriteCtx,
  document: Doc<'documents'>,
  storageId: Id<'_storage'>,
  uploadedBy: Id<'users'>,
): Promise<Id<'documentVersions'>> {
  const { mimeType, fileSize } = await validateUploadedBlob(ctx, storageId);
  const nextVersionNumber = (await latestVersionNumber(ctx, document._id)) + 1;
  return await insertVersion(ctx, document.firmId, document._id, nextVersionNumber, {
    storageId,
    mimeType,
    fileSize,
    uploadedBy,
  });
}

/**
 * Restoring never re-validates the file — sourceVersion.storageKey already
 * passed validateUploadedBlob when it was first uploaded, and restoring
 * only points a new row at the same file, never rewrites or re-checks it
 * (design spec §2.4).
 */
export async function restoreDocumentVersion(
  ctx: WriteCtx,
  document: Doc<'documents'>,
  sourceVersion: Doc<'documentVersions'>,
  uploadedBy: Id<'users'>,
): Promise<Id<'documentVersions'>> {
  const nextVersionNumber = (await latestVersionNumber(ctx, document._id)) + 1;
  return await insertVersion(ctx, document.firmId, document._id, nextVersionNumber, {
    storageId: sourceVersion.storageKey,
    mimeType: sourceVersion.mimeType,
    fileSize: sourceVersion.fileSize,
    uploadedBy,
  });
}

/** Guards against a caller passing a versionId that belongs to a different document. */
export async function requireDocumentVersion(
  ctx: ReadCtx,
  document: Doc<'documents'>,
  versionId: Id<'documentVersions'>,
): Promise<Doc<'documentVersions'>> {
  const version = await ctx.db.get('documentVersions', versionId);
  if (!version || version.documentId !== document._id) {
    throw new AppError(ERROR_CODES.DOCUMENT_VERSION_NOT_FOUND);
  }
  return version;
}
