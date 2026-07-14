import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { requireAccessibleCase } from './model/authz/owned.ts';
import {
  createDocument,
  requireAccessibleDocument,
  updateDocumentMetadata,
  softDeleteDocument,
  listDocumentsForCase,
  searchDocumentsForCaller,
  computeChecklistStatus,
} from './model/documents/documents.ts';
import {
  addVersionToDocument,
  restoreDocumentVersion,
  requireDocumentVersion,
} from './model/documents/versions.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { boundedPagination } from './lib/pagination.ts';
import { literalUnion } from './lib/validators.ts';
import { PERMISSIONS, DOCUMENT_KINDS, CONFIDENTIALITY_LEVELS } from '@diwan/shared';

const documentKindValidator = literalUnion(DOCUMENT_KINDS);
const confidentialityLevelValidator = literalUnion(CONFIDENTIALITY_LEVELS);

const documentDetailValidator = v.object({
  _id: v.id('documents'),
  caseId: v.id('cases'),
  kind: documentKindValidator,
  confidentialityLevel: confidentialityLevelValidator,
  title: v.string(),
  currentVersionId: v.optional(v.id('documentVersions')),
});

function toDetail(doc: {
  _id: import('./_generated/dataModel').Id<'documents'>;
  caseId: import('./_generated/dataModel').Id<'cases'>;
  kind: (typeof DOCUMENT_KINDS)[number];
  confidentialityLevel: (typeof CONFIDENTIALITY_LEVELS)[number];
  title: string;
  currentVersionId?: import('./_generated/dataModel').Id<'documentVersions'>;
}) {
  return {
    _id: doc._id,
    caseId: doc.caseId,
    kind: doc.kind,
    confidentialityLevel: doc.confidentialityLevel,
    title: doc.title,
    currentVersionId: doc.currentVersionId,
  };
}

const documentVersionDetailValidator = v.object({
  _id: v.id('documentVersions'),
  documentId: v.id('documents'),
  versionNumber: v.number(),
  mimeType: v.string(),
  fileSize: v.number(),
  uploadedBy: v.id('users'),
  createdAt: v.number(),
});

function toVersionDetail(version: {
  _id: import('./_generated/dataModel').Id<'documentVersions'>;
  documentId: import('./_generated/dataModel').Id<'documents'>;
  versionNumber: number;
  mimeType: string;
  fileSize: number;
  uploadedBy: import('./_generated/dataModel').Id<'users'>;
  createdAt: number;
}) {
  return {
    _id: version._id,
    documentId: version.documentId,
    versionNumber: version.versionNumber,
    mimeType: version.mimeType,
    fileSize: version.fileSize,
    uploadedBy: version.uploadedBy,
    createdAt: version.createdAt,
  };
}

export const generateUploadUrl = firmMutation({
  args: { caseId: v.id('cases') },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_WRITE);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = firmMutation({
  args: {
    caseId: v.id('cases'),
    kind: documentKindValidator,
    confidentialityLevel: confidentialityLevelValidator,
    title: v.string(),
    storageId: v.id('_storage'),
  },
  returns: v.id('documents'),
  handler: async (ctx, args) => {
    await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_WRITE);
    const documentId = await createDocument(ctx, ctx.firmId, ctx.userId, {
      caseId: args.caseId,
      kind: args.kind,
      confidentialityLevel: args.confidentialityLevel,
      title: args.title,
      storageId: args.storageId,
    });
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'documents',
      entityId: documentId,
      action: 'create',
      after: {
        caseId: args.caseId,
        kind: args.kind,
        confidentialityLevel: args.confidentialityLevel,
        title: args.title,
      },
    });
    return documentId;
  },
});

export const get = firmQuery({
  args: { documentId: v.id('documents') },
  returns: documentDetailValidator,
  handler: async (ctx, args) => {
    const document = await requireAccessibleDocument(ctx, ctx.firmId, args.documentId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_READ);
    return toDetail(document);
  },
});

export const addVersion = firmMutation({
  args: { documentId: v.id('documents'), storageId: v.id('_storage') },
  returns: v.id('documentVersions'),
  handler: async (ctx, args) => {
    const document = await requireAccessibleDocument(ctx, ctx.firmId, args.documentId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_WRITE);
    const versionId = await addVersionToDocument(ctx, document, args.storageId, ctx.userId);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'documents',
      entityId: document._id,
      action: 'addVersion',
      after: { versionId },
    });
    return versionId;
  },
});

export const restoreVersion = firmMutation({
  args: { documentId: v.id('documents'), sourceVersionId: v.id('documentVersions') },
  returns: v.id('documentVersions'),
  handler: async (ctx, args) => {
    const document = await requireAccessibleDocument(ctx, ctx.firmId, args.documentId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_WRITE);
    const sourceVersion = await requireDocumentVersion(ctx, document, args.sourceVersionId);
    const versionId = await restoreDocumentVersion(ctx, document, sourceVersion, ctx.userId);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'documents',
      entityId: document._id,
      action: 'restoreVersion',
      after: { sourceVersionId: args.sourceVersionId, versionId },
    });
    return versionId;
  },
});

export const listVersions = firmQuery({
  args: { documentId: v.id('documents'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(documentVersionDetailValidator),
  handler: async (ctx, args) => {
    await requireAccessibleDocument(ctx, ctx.firmId, args.documentId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_READ);
    const result = await ctx.db
      .query('documentVersions')
      .withIndex('by_document', (q) => q.eq('documentId', args.documentId))
      .order('desc')
      .paginate(boundedPagination(args.paginationOpts));
    return { ...result, page: result.page.map(toVersionDetail) };
  },
});

export const getDownloadUrl = firmQuery({
  args: { documentId: v.id('documents'), versionId: v.id('documentVersions') },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const document = await requireAccessibleDocument(ctx, ctx.firmId, args.documentId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_READ);
    const version = await requireDocumentVersion(ctx, document, args.versionId);
    return await ctx.storage.getUrl(version.storageKey);
  },
});

export const update = firmMutation({
  args: {
    documentId: v.id('documents'),
    title: v.optional(v.string()),
    kind: v.optional(documentKindValidator),
    confidentialityLevel: v.optional(confidentialityLevelValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { documentId, ...fields } = args;
    const document = await requireAccessibleDocument(ctx, ctx.firmId, documentId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_WRITE);
    const before = toDetail(document);
    await updateDocumentMetadata(ctx, document, fields);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'documents',
      entityId: documentId,
      action: 'update',
      before,
      after: fields,
    });
    return null;
  },
});

export const remove = firmMutation({
  args: { documentId: v.id('documents') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await requireAccessibleDocument(ctx, ctx.firmId, args.documentId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_DELETE);
    await softDeleteDocument(ctx, document._id);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'documents',
      entityId: document._id,
      action: 'delete',
    });
    return null;
  },
});

export const list = firmQuery({
  args: { caseId: v.id('cases'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(documentDetailValidator),
  handler: async (ctx, args) => {
    await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_READ);
    const result = await listDocumentsForCase(ctx, args.caseId, args.paginationOpts);
    return { ...result, page: result.page.map(toDetail) };
  },
});

export const search = firmQuery({
  args: { queryText: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(documentDetailValidator),
  handler: async (ctx, args) => {
    // Firm-wide search, but own-vs-all scoped per result (design spec
    // §2.8, corrected at final whole-branch review) — a Lawyer/Associate
    // (CASES_READ_OWN only) never sees a match from a case they couldn't
    // otherwise open via get/list, even though DOCUMENTS_READ itself has
    // no own/all split. See searchDocumentsForCaller
    // (model/documents/documents.ts) for the actual filtering logic.
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_READ);
    const result = await searchDocumentsForCaller(ctx, ctx.firmId, args.queryText, args.paginationOpts);
    return { ...result, page: result.page.map(toDetail) };
  },
});

export const getChecklistStatus = firmQuery({
  args: { caseId: v.id('cases') },
  returns: v.array(v.object({ kind: documentKindValidator, satisfied: v.boolean() })),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_READ);
    return await computeChecklistStatus(ctx, caseDoc);
  },
});
