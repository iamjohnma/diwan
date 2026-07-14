# Diwan M1 Plan 2: Documents, Versioning & Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the documents/documentVersions backend — case-scoped file upload via Convex's native storage, immutable per-file version history with restore, metadata management, search, and a required-document-checklist read model.

**Architecture:** Same four-zone Backend Manifesto pattern as Plan 1 (already on `main` at `d681e2a`): a thin `convex/documents.ts` surface (validate → permit → delegate → shape) over a fat `convex/model/documents/{documents,versions}.ts` model layer, built on the existing `firmQuery`/`firmMutation` ladder and `requireAccessibleCase` case-scoping helper. One new internal-only hook: `convex/internal/documents.ts`'s `processOcr`, a no-op `internalAction` scheduled after every upload.

**Tech Stack:** Convex (schema, queries/mutations/actions, native file storage), `convex-test` for TDD, TypeScript strict mode. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-07-10-lcms-m1-documents-design.md` — read it before starting; every decision below traces back to a numbered section there.

## Global Constraints

- `ctx.db.get`/`.patch`/`.replace`/`.delete` all take the **table name first**: `ctx.db.get('documents', id)`, never `ctx.db.get(id)`.
- Use `.withIndex()` / `.withSearchIndex()`, never `.filter()`, for any query gated on more than "give me everything."
- Every paginated query returns `paginationResultValidator(...)` from `convex/server`, reconstructed explicitly as `{ ...result, page: result.page.map(toDetail) }` — never spread a raw `PaginationResult` with extra fields into a handler's return value (Plan 1's Task 6 finding: the runtime return-validator rejects unexpected fields like `pageStatus`).
- Every function has an explicit `returns:` validator. No `v.any()` anywhere.
- All new error codes are added to `convex/lib/errors.ts`'s `ERROR_CODES` *before* ever being thrown.
- Every mutating operation calls `recordAuditEvent` (`convex/model/audit/recordAuditEvent.ts`) with `entityType: 'documents'`.
- Document access is gated by **two independent checks**, always in this order: (1) `requireAccessibleCase` (or `requireAccessibleDocument`, which wraps it) — the *scope* gate, own-vs-all per the case's `primaryLawyerId`; (2) `requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_READ|WRITE|DELETE)` — the *action* gate. Documents have no `readOwn`/`readAll` split of their own (unlike `cases`/`payments`) — access to *which* documents is entirely inherited from the parent case; the flat `documents:*` permission only gates *whether* the role can act on documents at all. This is why Paralegal (which holds `documents:write` but neither `cases:writeOwn` nor `cases:writeAll`) can still upload documents on cases it can read — confirm this with a test in Task 1, don't just assert it in review.
- Native Convex file storage only (`ctx.storage.generateUploadUrl()` / `ctx.storage.getUrl()` / the `_storage` system table via `ctx.db.system.get('_storage', id)`) — no hand-rolled S3 client, no `headObject` call (design spec §2.1).
- Content-type allowlist: `application/pdf`, `image/jpeg`, `image/png`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Size cap: `26214400` bytes (25 MiB). Both live as named constants in `convex/model/documents/versions.ts`, never inlined (design spec §2.7).
- **Correction to design spec §2.7, discovered during Task 1:** `validateUploadedBlob` does NOT call `ctx.storage.delete()` on an invalid upload. Convex mutations are transactional across storage operations as well as database writes — a `ctx.storage.delete()` call immediately followed by a `throw` in the same mutation call is rolled back along with everything else and can never actually persist (verified empirically against convex-test@0.0.54: a delete-then-throw inside one `t.run`/mutation call leaves the file exactly as it was). An orphaned blob from a rejected upload is an accepted, documented gap, not a bug — do not attempt to work around this with a scheduled cleanup, a two-phase mutation, or any other mechanism; it's out of scope for this plan. Do not re-add a `ctx.storage.delete()` call before a throw anywhere in this codebase — it is dead code that implies a guarantee the runtime cannot provide.
- **`storeBlob` test helper caveat (Task 1's `convex/documents.test.ts`):** convex-test@0.0.54's storage mock does not capture a `Blob`'s `type` — verified against its `storage/storeBlob` syscall implementation, which persists only `size`/`sha256`. The `storeBlob` test helper patches `contentType` onto the `_storage` row directly via `ctx.db.patch('_storage', storageId, { contentType })` inside `t.run()` immediately after `ctx.storage.store()`. This is test-setup only — production code must never read any test-only global to make up for this; it doesn't need to, since a real Convex deployment captures `contentType` from the upload automatically.
- Metadata edits (`title`/`kind`/`confidentialityLevel`) never create a `documentVersions` row — only a new/restored file does (design spec §2.4).
- `confidentialityLevel` is classification-only in this plan — no extra access gate beyond the two checks above (design spec §2.3). Do not add one.
- OCR: `processOcr` is a no-op `internalAction` for now. Do not call any OCR engine, do not add a status field, do not populate `ocrText` (design spec §2.2).
- One mutation per operation (`create`, `addVersion`, `restoreVersion`, `update`, `remove`) — no unified "save" entry point (design spec §2.5).

---

## Task 1: Foundation — schema, errors, blob validation, create/get/generateUploadUrl

**Files:**
- Modify: `convex/schema.ts` (documents/documentVersions tables)
- Modify: `convex/lib/errors.ts`
- Create: `convex/model/documents/versions.ts`
- Create: `convex/model/documents/documents.ts`
- Create: `convex/internal/documents.ts`
- Create: `convex/documents.ts`
- Create: `convex/documents.test.ts`

**Interfaces:**
- Consumes: `requireAccessibleCase`, `requireLawyerScopedAccess` (`convex/model/authz/owned.ts`); `firmQuery`, `firmMutation`, `requireFirmPermission` (`convex/functions.ts`); `recordAuditEvent` (`convex/model/audit/recordAuditEvent.ts`); `normalizeSearchText` (`convex/lib/search/normalizeSearchText.ts`); `literalUnion` (`convex/lib/validators.ts`); `PERMISSIONS`, `DOCUMENT_KINDS`, `CONFIDENTIALITY_LEVELS` (`@diwan/shared`); `makeTest`, `bootstrapFirm`, `addFirmMember`, `expectRejectedWithCode` (`convex/testHelpers.ts`).
- Produces (used by later tasks in this plan): `validateUploadedBlob(ctx, storageId)`, `MAX_DOCUMENT_FILE_SIZE_BYTES`, `ALLOWED_DOCUMENT_CONTENT_TYPES` (`model/documents/versions.ts`); `createDocument(ctx, firmId, uploadedBy, fields)`, `requireAccessibleDocument(ctx, firmId, documentId)` (`model/documents/documents.ts`); `internal.internal.documents.processOcr` action reference; `documentKindValidator`, `confidentialityLevelValidator`, `documentDetailValidator`, `toDetail` (`convex/documents.ts`, module-private but referenced by name in later task steps of this plan).

- [ ] **Step 1: Write the failing tests**

Create `convex/documents.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

type Test = ReturnType<typeof makeTest>;
type Owner = Awaited<ReturnType<typeof bootstrapFirm>>['owner'];
type Member = Awaited<ReturnType<typeof addFirmMember>>;

async function seedCaseType(t: Test, owner: Owner) {
  return await owner.authed.mutation(api.caseTypes.create, {
    key: 'civil-claim',
    label: 'Civil Claim',
    requiredPartyRoles: ['plaintiff', 'defendant'],
    requiredDocumentChecklist: ['power_of_attorney', 'identification'],
  });
}

async function seedCase(t: Test, caseTypeId: string, lawyer: Member) {
  return await lawyer.authed.mutation(api.cases.create, {
    internalNumber: 'C-1000',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    caseTypeId: caseTypeId as any,
    primaryLawyerId: lawyer.userId,
  });
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
    // `db.patch`'s TableName generic only accepts app-schema tables, never
    // system tables like `_storage`, hence the cast.
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- documents.test.ts`
Expected: FAIL — `api.documents` is undefined (module doesn't exist yet).

- [ ] **Step 3: Add new error codes**

Modify `convex/lib/errors.ts` — add four codes to `ERROR_CODES`, after `PARTY_NOT_FOUND` and before `LEDGER_BALANCE_WOULD_GO_NEGATIVE`:

```typescript
  PARTY_NOT_FOUND: 'PARTY_NOT_FOUND',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  DOCUMENT_VERSION_NOT_FOUND: 'DOCUMENT_VERSION_NOT_FOUND',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  LEDGER_BALANCE_WOULD_GO_NEGATIVE: 'LEDGER_BALANCE_WOULD_GO_NEGATIVE',
```

- [ ] **Step 4: Update the schema**

Modify `convex/schema.ts` — replace the existing `documents` and `documentVersions` table definitions (lines 198–231) with:

```typescript
  // Parent record — stable identity across versions. The actual file
  // blobs live in documentVersions (immutable rows, never overwritten).
  // searchText/search index added in M1 Plan 2 (design spec §3) — computed
  // from title only for now; richer once OCR text exists.
  documents: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    kind: literalUnion(DOCUMENT_KINDS),
    confidentialityLevel: literalUnion(CONFIDENTIALITY_LEVELS),
    title: v.string(),
    searchText: v.string(),
    currentVersionId: v.optional(v.id('documentVersions')),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_firm', ['firmId'])
    .index('by_case_deleted', ['caseId', 'deletedAt'])
    .index('by_firm_deleted_created', ['firmId', 'deletedAt', 'createdAt'])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['firmId', 'deletedAt'],
    }),

  // Document *versioning* has no existing pattern to lean on (PLAN §2) —
  // each version is an immutable row; "restore" means creating a new
  // version pointing at an old storageKey, never rewriting one.
  documentVersions: defineTable({
    firmId: v.id('firms'),
    documentId: v.id('documents'),
    versionNumber: v.number(),
    // Native Convex storage ID (M1 Plan 2 design spec §2.1) — the field
    // name predates that decision and is kept to avoid unrelated schema
    // churn, but it now holds an Id<'_storage'>, not an S3 key string.
    storageKey: v.id('_storage'),
    mimeType: v.string(),
    fileSize: v.number(),
    // Arabic+English OCR text (PLAN §2) — stays unset until an OCR engine
    // is picked (design spec §2.2); processOcr is wired but a no-op.
    ocrText: v.optional(v.string()),
    uploadedBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_document', ['documentId'])
    .index('by_firm', ['firmId']),
```

- [ ] **Step 5: Create the OCR hook stub**

Create `convex/internal/documents.ts`:

```typescript
import { v } from 'convex/values';
import { internalAction } from '../_generated/server';

// OCR engine selection is an explicit open question (PRD §12) — this hook
// exists so create/addVersion can schedule it unconditionally now, and
// wiring a real engine later means filling in this body, not a pipeline
// change (M1 Plan 2 design spec §2.2). No-op until an engine is chosen —
// do not populate ocrText or add a status field here.
export const processOcr = internalAction({
  args: { documentVersionId: v.id('documentVersions') },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
```

- [ ] **Step 6: Create the versions model helper**

Create `convex/model/documents/versions.ts`:

```typescript
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { internal } from '../../_generated/api';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';

type WriteCtx = Pick<MutationCtx, 'db' | 'scheduler'>;

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
 * latest version row (design spec §2.4). Schedules the (currently no-op)
 * OCR hook so the wiring exists ahead of engine selection (design spec
 * §2.2).
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
  await ctx.scheduler.runAfter(0, internal.internal.documents.processOcr, { documentVersionId: versionId });
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
```

- [ ] **Step 7: Create the documents model helper**

Create `convex/model/documents/documents.ts`:

```typescript
import type { Id, Doc } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText.ts';
import { requireAccessibleCase } from '../authz/owned.ts';
import { createFirstVersion } from './versions.ts';
import type { DocumentKind, ConfidentialityLevel, PermissionString } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db' | 'scheduler'>;
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
```

- [ ] **Step 8: Create the documents surface**

Create `convex/documents.ts`:

```typescript
import { v } from 'convex/values';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { requireAccessibleCase } from './model/authz/owned.ts';
import { createDocument, requireAccessibleDocument } from './model/documents/documents.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
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
  returns: v.union(documentDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const document = await requireAccessibleDocument(ctx, ctx.firmId, args.documentId);
    requireFirmPermission(ctx, PERMISSIONS.DOCUMENTS_READ);
    return toDetail(document);
  },
});
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `bun run test -- documents.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 10: Regenerate Convex types and typecheck**

Run: `bunx convex dev --once && bun run check`
Expected: both exit cleanly. Commit whatever `convex/_generated/*` changes this produces along with the rest of this task's files — Plan 1's Tasks 1 and 3 both hit review failures from forgetting this step (any `.ts` file under `convex/` changes the generated module map, not just ones exporting Convex functions).

- [ ] **Step 11: Commit**

```bash
git add convex/schema.ts convex/lib/errors.ts convex/model/documents/versions.ts \
  convex/model/documents/documents.ts convex/internal/documents.ts convex/documents.ts \
  convex/documents.test.ts convex/_generated
git commit -m "feat: add documents create/get/generateUploadUrl with native Convex storage"
```

---

## Task 2: Version management — addVersion, restoreVersion, listVersions, getDownloadUrl

**Files:**
- Modify: `convex/model/documents/versions.ts`
- Modify: `convex/documents.ts`
- Modify: `convex/documents.test.ts`

**Interfaces:**
- Consumes: `validateUploadedBlob`, `MAX_DOCUMENT_FILE_SIZE_BYTES`, `createFirstVersion` (Task 1, `model/documents/versions.ts`); `requireAccessibleDocument` (Task 1, `model/documents/documents.ts`); `documentKindValidator`, `documentDetailValidator`, `toDetail` (Task 1, `convex/documents.ts` — re-declared/extended in this task's full-file rewrite below, same names, same shapes).
- Produces: `addVersionToDocument(ctx, document, storageId, uploadedBy)`, `restoreDocumentVersion(ctx, document, sourceVersion, uploadedBy)`, `requireDocumentVersion(ctx, document, versionId)` (`model/documents/versions.ts`) — consumed by Task 3/4 only indirectly (not required there, but available).

- [ ] **Step 1: Write the failing tests**

Modify `convex/documents.test.ts` — insert these tests directly before the final closing `});` of the `describe('documents', ...)` block:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- documents.test.ts`
Expected: FAIL — `api.documents.addVersion`/`restoreVersion`/`listVersions`/`getDownloadUrl` are undefined.

- [ ] **Step 3: Add addVersion/restoreVersion/requireDocumentVersion to the versions model**

Replace the entire contents of `convex/model/documents/versions.ts` with:

```typescript
import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { internal } from '../../_generated/api';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';

type WriteCtx = Pick<MutationCtx, 'db' | 'scheduler'>;
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
 * latest version row (design spec §2.4). Schedules the (currently no-op)
 * OCR hook so the wiring exists ahead of engine selection (design spec
 * §2.2).
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
  await ctx.scheduler.runAfter(0, internal.internal.documents.processOcr, { documentVersionId: versionId });
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
```

- [ ] **Step 4: Add addVersion/restoreVersion/listVersions/getDownloadUrl to the surface**

Modify `convex/documents.ts` — update the top imports to:

```typescript
import { v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { requireAccessibleCase } from './model/authz/owned.ts';
import { createDocument, requireAccessibleDocument } from './model/documents/documents.ts';
import {
  addVersionToDocument,
  restoreDocumentVersion,
  requireDocumentVersion,
} from './model/documents/versions.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { literalUnion } from './lib/validators.ts';
import { PERMISSIONS, DOCUMENT_KINDS, CONFIDENTIALITY_LEVELS } from '@diwan/shared';
```

Then add this validator after `documentDetailValidator`:

```typescript
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
```

Then append these exports at the end of the file:

```typescript
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
      .paginate(args.paginationOpts);
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- documents.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 6: Regenerate Convex types and typecheck**

Run: `bunx convex dev --once && bun run check`
Expected: both exit cleanly.

- [ ] **Step 7: Commit**

```bash
git add convex/model/documents/versions.ts convex/documents.ts convex/documents.test.ts convex/_generated
git commit -m "feat: add documents addVersion/restoreVersion/listVersions/getDownloadUrl"
```

---

## Task 3: Metadata & lifecycle — update, remove

**Files:**
- Modify: `convex/model/documents/documents.ts`
- Modify: `convex/documents.ts`
- Modify: `convex/documents.test.ts`

**Interfaces:**
- Consumes: `requireAccessibleDocument` (Task 1); `toDetail`, `documentDetailValidator` (Task 1, `convex/documents.ts`).
- Produces: `updateDocumentMetadata(ctx, document, fields)`, `softDeleteDocument(ctx, documentId)` (`model/documents/documents.ts`).

- [ ] **Step 1: Write the failing tests**

Modify `convex/documents.test.ts` — insert before the final closing `});`:

```typescript
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

    // Owner, not lawyer: no non-owner role holds documents:delete in the
    // RBAC catalog (packages/shared/src/rbac.ts) — only the Owner wildcard
    // passes requireFirmPermission(PERMISSIONS.DOCUMENTS_DELETE). A lawyer
    // actor here would reject with INSUFFICIENT_PERMISSIONS before ever
    // reaching the assertions this test exists to make.
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- documents.test.ts`
Expected: FAIL — `api.documents.update`/`remove` are undefined.

- [ ] **Step 3: Add updateDocumentMetadata/softDeleteDocument to the documents model**

Modify `convex/model/documents/documents.ts` — no import changes needed (`DocumentKind`, `ConfidentialityLevel`, `MutationCtx`, `Doc` are already imported from Task 1). Append these two functions at the end of the file:

```typescript
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
```

- [ ] **Step 4: Add update/remove to the surface**

Modify `convex/documents.ts` — update the model import line to:

```typescript
import {
  createDocument,
  requireAccessibleDocument,
  updateDocumentMetadata,
  softDeleteDocument,
} from './model/documents/documents.ts';
```

Then append these exports at the end of the file:

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- documents.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Regenerate Convex types and typecheck**

Run: `bunx convex dev --once && bun run check`
Expected: both exit cleanly.

- [ ] **Step 7: Commit**

```bash
git add convex/model/documents/documents.ts convex/documents.ts convex/documents.test.ts convex/_generated
git commit -m "feat: add documents update/remove"
```

---

## Task 4: Case-level read models — list, search, getChecklistStatus

**Files:**
- Modify: `convex/model/documents/documents.ts`
- Modify: `convex/documents.ts`
- Modify: `convex/documents.test.ts`

**Interfaces:**
- Consumes: `requireAccessibleCase` (`convex/model/authz/owned.ts`); `toDetail`, `documentDetailValidator`, `documentKindValidator` (Task 1, `convex/documents.ts`); `normalizeSearchText` (`convex/lib/search/normalizeSearchText.ts`).
- Produces: `listDocumentsForCase(ctx, caseId, paginationOpts)`, `computeChecklistStatus(ctx, caseDoc)` (`model/documents/documents.ts`) — this plan's final task; nothing downstream in this plan consumes these.

- [ ] **Step 1: Write the failing tests**

Modify `convex/documents.test.ts` — insert before the final closing `});`:

```typescript
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
    // Deleted via owner, not lawyer: no non-owner role holds
    // documents:delete in the RBAC catalog (packages/shared/src/rbac.ts).
    await lawyer.authed.mutation(api.documents.create, {
      caseId: caseIdA,
      kind: 'evidence',
      confidentialityLevel: 'standard',
      title: 'A2 (deleted)',
      storageId: storageId2,
    }).then((id) => owner.authed.mutation(api.documents.remove, { documentId: id }));
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
```

Note the final `});` above closes the `describe` block — this task's tests are the last ones in the file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- documents.test.ts`
Expected: FAIL — `api.documents.list`/`search`/`getChecklistStatus` are undefined.

- [ ] **Step 3: Add listDocumentsForCase/computeChecklistStatus to the documents model**

Modify `convex/model/documents/documents.ts` — add one new import line directly below the existing `import type { Id, Doc } from '../../_generated/dataModel';` line:

```typescript
import type { PaginationOptions, PaginationResult } from 'convex/server';
```

Then append these two functions at the end of the file:

```typescript
export async function listDocumentsForCase(
  ctx: ReadCtx,
  caseId: Id<'cases'>,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<Doc<'documents'>>> {
  return await ctx.db
    .query('documents')
    .withIndex('by_case_deleted', (q) => q.eq('caseId', caseId).eq('deletedAt', undefined))
    .paginate(paginationOpts);
}

export interface ChecklistStatusEntry {
  kind: DocumentKind;
  satisfied: boolean;
}

/**
 * Cross-references the case type's requiredDocumentChecklist against the
 * case's actual non-deleted documents, grouped by kind (design spec §2.6).
 * .collect() here is bounded to one case's documents, not a firm-wide scan
 * — same precedent as listPartiesForCase (model/caseParties/caseParties.ts).
 */
export async function computeChecklistStatus(
  ctx: ReadCtx,
  caseDoc: Doc<'cases'>,
): Promise<ChecklistStatusEntry[]> {
  const caseType = await ctx.db.get('caseTypes', caseDoc.caseTypeId);
  if (!caseType) throw new AppError(ERROR_CODES.CASE_TYPE_NOT_FOUND);
  const documents = await ctx.db
    .query('documents')
    .withIndex('by_case_deleted', (q) => q.eq('caseId', caseDoc._id).eq('deletedAt', undefined))
    .collect();
  const presentKinds = new Set(documents.map((doc) => doc.kind));
  return caseType.requiredDocumentChecklist.map((kind) => ({
    kind,
    satisfied: presentKinds.has(kind),
  }));
}
```

**Correction, found at the final whole-branch review:** the plan originally had `search` (Step 4, below) gate on the flat `DOCUMENTS_READ` permission only, firm-wide, with no per-document case scoping — framed as "matching the cases.search/parties.search precedent." That framing was wrong: `cases.search` gates on `CASES_READ_ALL` specifically (a Lawyer/Associate holding only `CASES_READ_OWN` cannot call it at all), and `parties` has no own-vs-all scoping to begin with. `documents` is case-scoped like `cases`, but `documents:read` has no own/all split — so gating `search` on the flat permission let Lawyer/Associate (who hold `documents:read` + `cases:readOwn` but not `cases:readAll`) see titles/`confidentialityLevel`/`caseId` for documents on colleagues' cases they can't open via `get`/`list`. Design spec §2.8 has the full writeup. Fixed by adding `searchDocumentsForCaller` below — append it to `model/documents/documents.ts` in this same step, after `computeChecklistStatus`:

```typescript
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
    .paginate(paginationOpts);

  const canReadAllCases =
    ctx.permissions.has(RBAC.OWNER_WILDCARD as PermissionString) ||
    ctx.permissions.has(PERMISSIONS.CASES_READ_ALL);
  if (canReadAllCases) return result;

  // Mirrors listCasesForParty's own-vs-all pattern exactly
  // (model/caseParties/caseParties.ts, Plan 1) — a bounded per-page fan-out
  // of case lookups, not a firm-wide scan.
  const accessiblePage: Doc<'documents'>[] = [];
  for (const doc of result.page) {
    const caseDoc = await ctx.db.get('cases', doc.caseId);
    if (!caseDoc || caseDoc.firmId !== firmId || caseDoc.deletedAt !== undefined) continue;
    const canReadOwn = ctx.userId === caseDoc.primaryLawyerId && ctx.permissions.has(PERMISSIONS.CASES_READ_OWN);
    if (canReadOwn) accessiblePage.push(doc);
  }
  return { ...result, page: accessiblePage };
}
```

Also update `model/documents/documents.ts`'s `@diwan/shared` import line (originally `import type { DocumentKind, ConfidentialityLevel, PermissionString } from '@diwan/shared';`, from Task 1 Step 7) to add the two value imports this function needs:

```typescript
import { RBAC, PERMISSIONS, type DocumentKind, type ConfidentialityLevel, type PermissionString } from '@diwan/shared';
```

- [ ] **Step 4: Add list/search/getChecklistStatus to the surface**

Modify `convex/documents.ts` — update the top imports to their final form:

```typescript
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
import { literalUnion } from './lib/validators.ts';
import { PERMISSIONS, DOCUMENT_KINDS, CONFIDENTIALITY_LEVELS } from '@diwan/shared';
```

(note: `normalizeSearchText` is no longer imported into `convex/documents.ts` directly — it now lives only in `model/documents/documents.ts`, called from inside `searchDocumentsForCaller`)

Then append these exports at the end of the file:

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test -- documents.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 6: Regenerate Convex types, typecheck, and run the full suite**

Run: `bunx convex dev --once && bun run check && bun run test`
Expected: all green — the full suite (Plan 1's tests + this file) passes, not just `documents.test.ts` in isolation.

- [ ] **Step 7: Commit**

```bash
git add convex/model/documents/documents.ts convex/documents.ts convex/documents.test.ts convex/_generated
git commit -m "feat: add documents list/search/getChecklistStatus"
```

---

## Self-Review Notes

- **Spec coverage:** every design-spec section (§2.1–§2.7, §3, §4, §5, §6) maps to a task above — storage (Task 1), OCR stub (Task 1), confidentiality classification-only (no extra code anywhere, verified by absence), metadata-vs-version split (Task 3 test), always-create-with-file (Task 1's `create` signature requires `storageId`), one-mutation-per-operation (5 distinct mutations across Tasks 1–3), checklist read model (Task 4), upload limits (Task 1).
- **Cross-task consistency:** `toDetail`/`documentDetailValidator`/`documentKindValidator`/`confidentialityLevelValidator` defined once in Task 1, reused verbatim by name in Tasks 2–4's steps — no renaming drift.
- **Resolved at final whole-branch review, not carried forward:** the plan originally shipped `search` (Task 4) without per-document own-vs-all case scoping, framed as "matching the precedent Plan 1 set for cases.search/parties.search." The final review found that framing was wrong — `cases.search` gates on `CASES_READ_ALL` specifically (not just any read permission), and `parties` has no own-vs-all scoping to begin with, so neither sibling actually establishes a "firm-wide search is fine" precedent for a case-scoped resource. A Lawyer with `CASES_READ_OWN` (not `_ALL`) searching would have seen title/confidentialityLevel/caseId matches from cases they can't otherwise open — a real ethical-wall concern for a legal product. Fixed via `searchDocumentsForCaller` (design spec §2.8), which post-filters each page through the same own-vs-all check `listCasesForParty` already established in Plan 1, rather than accepting the leak.
