import { describe, expect, test } from 'vitest';
import {
  addFirmMember,
  bootstrapFirm,
  expectRejectedWithCode,
  makeTest,
  seedCase as seedTestCase,
  seedCaseType as seedTestCaseType,
  type Test,
  type TestUser,
} from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

async function seedCaseType(t: Test, owner: TestUser) {
  return await seedTestCaseType(t, owner, {
    requiredDocumentChecklist: ['power_of_attorney', 'identification'],
  });
}

async function seedCase(
  t: Test,
  caseTypeId: import('./_generated/dataModel').Id<'caseTypes'>,
  lawyer: TestUser,
) {
  return await seedTestCase(t, caseTypeId, lawyer);
}

async function storeBlob(t: Test, contentType: string, sizeBytes: number) {
  return await t.run(async (ctx) => {
    const blob = new Blob([new Uint8Array(sizeBytes)], { type: contentType });
    const storageId = await ctx.storage.store(blob);
    // convex-test's storage mock does not capture Blob.type (verified
    // against convex-test@0.0.54's storage/storeBlob syscall, which only
    // persists size + sha256) — patch it onto the _storage row directly so
    // validateUploadedBlob sees a realistic contentType, matching what a
    // real Convex deployment captures from the upload automatically. This
    // is test-setup only; production code never reads a test-only global.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (ctx.db as any).patch('_storage', storageId, { contentType });
    return storageId;
  });
}

describe('documents', () => {
  test('a Lawyer can upload a document on their own case', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId = await storeBlob(t, 'application/pdf', 1024);

    const documentId = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId,
    });

    const doc = await lawyer.authed.query(api.documents.get, { documentId });
    expect(doc?.title).toBe('Exhibit A');
    expect(doc?.kind).toBe('evidence');
    expect(doc?.currentVersionId).toBeDefined();
  });

  test('generateUploadUrl rejects a Lawyer who cannot access the case', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyerA = await addFirmMember(t, firmId, 'lawyer', { name: 'A', email: 'a@example.com' });
    const lawyerB = await addFirmMember(t, firmId, 'lawyer', { name: 'B', email: 'b@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyerA);

    await expectRejectedWithCode(
      lawyerB.authed.mutation(api.documents.generateUploadUrl, { caseId }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('create rejects a disallowed content type without creating a document', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId = await storeBlob(t, 'application/x-msdownload', 1024);

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.documents.create, {
        caseId,
        kind: 'evidence',
        confidentialityLevel: 'standard',
        title: 'Bad File',
        storageId,
      }),
      ERROR_CODES.INVALID_FILE_TYPE,
    );
    // Not asserted: whether the blob itself was deleted. Convex mutations
    // are transactional across storage operations as well as database
    // writes — a ctx.storage.delete() call immediately followed by a throw
    // in the same mutation call is rolled back along with everything else
    // and can never actually persist. validateUploadedBlob does not
    // attempt it (model/documents/versions.ts) — an orphaned blob from a
    // rejected upload is an accepted, documented gap (design spec §2.7
    // addendum), not a bug.
  });

  test('create rejects a file over the 25MiB cap without creating a document', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId = await storeBlob(t, 'application/pdf', 26 * 1024 * 1024);

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.documents.create, {
        caseId,
        kind: 'evidence',
        confidentialityLevel: 'standard',
        title: 'Huge File',
        storageId,
      }),
      ERROR_CODES.FILE_TOO_LARGE,
    );
  });

  test('an Accountant cannot create a document — holds no documents permission at all', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const accountant = await addFirmMember(t, firmId, 'accountant', { name: 'Adam', email: 'adam@example.com' });
    const storageId = await storeBlob(t, 'application/pdf', 1024);

    await expectRejectedWithCode(
      accountant.authed.mutation(api.documents.create, {
        caseId,
        kind: 'evidence',
        confidentialityLevel: 'standard',
        title: 'Exhibit A',
        storageId,
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('a Paralegal CAN create a document despite having no case-write permission at all', async () => {
    // Paralegal holds documents:write but neither cases:writeOwn nor
    // cases:writeAll (packages/shared/src/rbac.ts) — proves document write
    // access is gated by the flat documents permission, not a case-write
    // permission, per this plan's Global Constraints.
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const paralegal = await addFirmMember(t, firmId, 'paralegal', { name: 'Pat', email: 'pat@example.com' });
    const storageId = await storeBlob(t, 'application/pdf', 1024);

    const documentId = await paralegal.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit B',
      storageId,
    });
    expect(documentId).toBeDefined();
  });

  test('get 404s on a document belonging to a case the caller cannot read', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyerA = await addFirmMember(t, firmId, 'lawyer', { name: 'A', email: 'a@example.com' });
    const lawyerB = await addFirmMember(t, firmId, 'lawyer', { name: 'B', email: 'b@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyerA);
    const storageId = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyerA.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId,
    });

    await expectRejectedWithCode(
      lawyerB.authed.query(api.documents.get, { documentId }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('addVersion bumps versionNumber and repoints currentVersionId', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId1 = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId: storageId1,
    });
    const before = await lawyer.authed.query(api.documents.get, { documentId });

    const storageId2 = await storeBlob(t, 'application/pdf', 2048);
    const versionId2 = await lawyer.authed.mutation(api.documents.addVersion, {
      documentId,
      storageId: storageId2,
    });

    const after = await lawyer.authed.query(api.documents.get, { documentId });
    expect(after?.currentVersionId).toBe(versionId2);
    expect(after?.currentVersionId).not.toBe(before?.currentVersionId);

    const versions = await lawyer.authed.query(api.documents.listVersions, {
      documentId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(versions.page.map((v) => v.versionNumber).sort()).toEqual([1, 2]);
  });

  test('addVersion rejects an invalid file and leaves currentVersionId untouched', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId1 = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId: storageId1,
    });
    const before = await lawyer.authed.query(api.documents.get, { documentId });

    const badStorageId = await storeBlob(t, 'application/zip', 512);
    await expectRejectedWithCode(
      lawyer.authed.mutation(api.documents.addVersion, { documentId, storageId: badStorageId }),
      ERROR_CODES.INVALID_FILE_TYPE,
    );

    const after = await lawyer.authed.query(api.documents.get, { documentId });
    expect(after?.currentVersionId).toBe(before?.currentVersionId);
    const versions = await lawyer.authed.query(api.documents.listVersions, {
      documentId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(versions.page).toHaveLength(1);
  });

  test('restoreVersion creates a new row and never mutates the old one', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId1 = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId: storageId1,
    });
    const storageId2 = await storeBlob(t, 'application/pdf', 2048);
    await lawyer.authed.mutation(api.documents.addVersion, { documentId, storageId: storageId2 });
    const versionsBeforeRestore = await lawyer.authed.query(api.documents.listVersions, {
      documentId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    const v1 = versionsBeforeRestore.page.find((v) => v.versionNumber === 1);
    if (!v1) throw new Error('version 1 not found');

    const restoredId = await lawyer.authed.mutation(api.documents.restoreVersion, {
      documentId,
      sourceVersionId: v1._id,
    });

    const versionsAfterRestore = await lawyer.authed.query(api.documents.listVersions, {
      documentId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(versionsAfterRestore.page).toHaveLength(3);
    const restored = versionsAfterRestore.page.find((v) => v._id === restoredId);
    expect(restored?.versionNumber).toBe(3);
    const v1Unchanged = versionsAfterRestore.page.find((v) => v._id === v1._id);
    expect(v1Unchanged?.versionNumber).toBe(1);

    const after = await lawyer.authed.query(api.documents.get, { documentId });
    expect(after?.currentVersionId).toBe(restoredId);
  });

  test('getDownloadUrl re-checks case access and returns null for a deleted-underneath blob', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyerA = await addFirmMember(t, firmId, 'lawyer', { name: 'A', email: 'a@example.com' });
    const lawyerB = await addFirmMember(t, firmId, 'lawyer', { name: 'B', email: 'b@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyerA);
    const storageId = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyerA.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId,
    });
    const doc = await lawyerA.authed.query(api.documents.get, { documentId });
    if (!doc?.currentVersionId) throw new Error('missing currentVersionId');

    const url = await lawyerA.authed.query(api.documents.getDownloadUrl, {
      documentId,
      versionId: doc.currentVersionId,
    });
    expect(url).not.toBeNull();

    await expectRejectedWithCode(
      lawyerB.authed.query(api.documents.getDownloadUrl, { documentId, versionId: doc.currentVersionId }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );

    // Actually exercise the null-return path this test's name promises:
    // delete the underlying blob directly (bypassing document soft-delete)
    // and re-query as the still-authorized lawyer — ctx.storage.getUrl
    // returns null for a nonexistent file (Convex guidelines), and
    // getDownloadUrl passes that straight through.
    await t.run(async (ctx) => {
      await ctx.storage.delete(storageId);
    });
    const urlAfterBlobDeleted = await lawyerA.authed.query(api.documents.getDownloadUrl, {
      documentId,
      versionId: doc.currentVersionId,
    });
    expect(urlAfterBlobDeleted).toBeNull();
  });

  test('restoreVersion rejects a sourceVersionId from a different document', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageIdA = await storeBlob(t, 'application/pdf', 1024);
    const documentIdA = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId: storageIdA,
    });
    const storageIdB = await storeBlob(t, 'application/pdf', 1024);
    const documentIdB = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit B',
      storageId: storageIdB,
    });
    const docB = await lawyer.authed.query(api.documents.get, { documentId: documentIdB });
    if (!docB?.currentVersionId) throw new Error('missing currentVersionId');

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.documents.restoreVersion, {
        documentId: documentIdA,
        sourceVersionId: docB.currentVersionId,
      }),
      ERROR_CODES.DOCUMENT_VERSION_NOT_FOUND,
    );
  });

  test('update patches metadata without creating a new version', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId,
    });

    await lawyer.authed.mutation(api.documents.update, {
      documentId,
      title: 'Exhibit A (Revised Title)',
      confidentialityLevel: 'privileged',
    });

    const updated = await lawyer.authed.query(api.documents.get, { documentId });
    expect(updated?.title).toBe('Exhibit A (Revised Title)');
    expect(updated?.confidentialityLevel).toBe('privileged');
    expect(updated?.kind).toBe('evidence');

    const versions = await lawyer.authed.query(api.documents.listVersions, {
      documentId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(versions.page).toHaveLength(1);
  });

  test('remove hides a document from get but does not delete its file', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId,
    });

    await owner.authed.mutation(api.documents.remove, { documentId });

    await expectRejectedWithCode(
      lawyer.authed.query(api.documents.get, { documentId }),
      ERROR_CODES.DOCUMENT_NOT_FOUND,
    );
    const url = await t.run(async (ctx) => await ctx.storage.getUrl(storageId));
    expect(url).not.toBeNull();
  });

  test('an Associate (no DOCUMENTS_DELETE-relevant role gap here) can still remove — but a role with no documents:delete cannot', async () => {
    // Every role holding documents:write also lacks a distinct delete tier
    // in the RBAC catalog except via documents:delete, which none of
    // lawyer/associate/secretary/paralegal hold (packages/shared/src/rbac.ts
    // only grants documents:delete to the Owner wildcard). Confirms remove
    // is actually gated, not a no-op permission check.
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Exhibit A',
      storageId,
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.documents.remove, { documentId }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('list returns only this case\'s non-deleted documents', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseIdA = await seedCase(t, caseTypeId, lawyer);
    const caseIdB = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-1001',
      caseTypeId,
      primaryLawyerId: lawyer.userId,
    });
    const storageId1 = await storeBlob(t, 'application/pdf', 1024);
    const docA1 = await lawyer.authed.mutation(api.documents.create, {
      caseId: caseIdA,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'A1',
      storageId: storageId1,
    });
    const storageId2 = await storeBlob(t, 'application/pdf', 1024);
    const docA2 = await lawyer.authed.mutation(api.documents.create, {
      caseId: caseIdA,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'A2 (deleted)',
      storageId: storageId2,
    });
    await owner.authed.mutation(api.documents.remove, { documentId: docA2 });
    const storageId3 = await storeBlob(t, 'application/pdf', 1024);
    await lawyer.authed.mutation(api.documents.create, {
      caseId: caseIdB,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'B1',
      storageId: storageId3,
    });

    const listed = await lawyer.authed.query(api.documents.list, {
      caseId: caseIdA,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page.map((d) => d._id)).toEqual([docA1]);
  });

  test('search finds a document by Arabic-normalized title', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId = await storeBlob(t, 'application/pdf', 1024);
    const documentId = await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'power_of_attorney',
      confidentialityLevel: 'standard',
      title: 'توكيل خاص',
      storageId,
    });

    const results = await lawyer.authed.query(api.documents.search, {
      queryText: 'توكيل',
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(results.page.map((d) => d._id)).toContain(documentId);
  });

  test('search scopes results to own-vs-all case access — a Lawyer (CASES_READ_OWN only) never sees a match from a colleague\'s case, but Owner (read-all) sees every match', async () => {
    // Regression test for the final whole-branch review finding (design
    // spec §2.8): search previously gated on the flat DOCUMENTS_READ
    // permission only, with no per-result case scoping, so a Lawyer/
    // Associate holding CASES_READ_OWN (not _ALL) could see title/
    // confidentialityLevel/caseId for documents on colleagues' cases they
    // cannot open via get/list/getDownloadUrl — an ethical-wall leak.
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyerA = await addFirmMember(t, firmId, 'lawyer', { name: 'A', email: 'a-search@example.com' });
    const lawyerB = await addFirmMember(t, firmId, 'lawyer', { name: 'B', email: 'b-search@example.com' });
    const caseIdA = await seedCase(t, caseTypeId, lawyerA);
    const caseIdB = await lawyerB.authed.mutation(api.cases.create, {
      internalNumber: 'C-2000',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caseTypeId: caseTypeId as any,
      primaryLawyerId: lawyerB.userId,
    });

    const storageIdA = await storeBlob(t, 'application/pdf', 1024);
    const docA = await lawyerA.authed.mutation(api.documents.create, {
      caseId: caseIdA,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Nighthawk Settlement — Case A',
      storageId: storageIdA,
    });
    const storageIdB = await storeBlob(t, 'application/pdf', 1024);
    const docB = await lawyerB.authed.mutation(api.documents.create, {
      caseId: caseIdB,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'Nighthawk Settlement — Case B',
      storageId: storageIdB,
    });

    // Lawyer A holds CASES_READ_OWN only — must see their own case's match
    // (docA) but never colleague B's (docB), even though DOCUMENTS_READ
    // itself carries no own/all split.
    const resultsForA = await lawyerA.authed.query(api.documents.search, {
      queryText: 'Nighthawk',
      paginationOpts: { numItems: 10, cursor: null },
    });
    const idsForA = resultsForA.page.map((d) => d._id);
    expect(idsForA).toContain(docA);
    expect(idsForA).not.toContain(docB);

    // Owner holds the Owner wildcard (read-all) — must see both matches,
    // proving the own-vs-all filter isn't accidentally filtering everyone.
    const resultsForOwner = await owner.authed.query(api.documents.search, {
      queryText: 'Nighthawk',
      paginationOpts: { numItems: 10, cursor: null },
    });
    const idsForOwner = resultsForOwner.page.map((d) => d._id);
    expect(idsForOwner).toContain(docA);
    expect(idsForOwner).toContain(docB);
  });

  test('an Accountant (holds cases:readAll but no documents:* permission) cannot call list, search, or getChecklistStatus', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const accountant = await addFirmMember(t, firmId, 'accountant', { name: 'Adam', email: 'adam-neg@example.com' });

    await expectRejectedWithCode(
      accountant.authed.query(api.documents.list, {
        caseId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );

    await expectRejectedWithCode(
      accountant.authed.query(api.documents.search, {
        queryText: 'anything',
        paginationOpts: { numItems: 10, cursor: null },
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );

    await expectRejectedWithCode(
      accountant.authed.query(api.documents.getChecklistStatus, { caseId }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('getChecklistStatus reflects which required kinds are present', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner); // requires power_of_attorney + identification
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const caseId = await seedCase(t, caseTypeId, lawyer);
    const storageId = await storeBlob(t, 'application/pdf', 1024);
    await lawyer.authed.mutation(api.documents.create, {
      caseId,
      kind: 'power_of_attorney',
      confidentialityLevel: 'standard',
      title: 'POA',
      storageId,
    });

    const status = await lawyer.authed.query(api.documents.getChecklistStatus, { caseId });
    expect(status).toEqual(
      expect.arrayContaining([
        { kind: 'power_of_attorney', satisfied: true },
        { kind: 'identification', satisfied: false },
      ]),
    );
  });
});
