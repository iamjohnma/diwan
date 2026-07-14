# Diwan M1 — Documents, Versioning & Uploads Design

**Status:** Approved, ready for implementation plan
**Based on:** PRD.md v0.3, IMPLEMENTATION_PLAN.md §2, `convex/schema.ts` (post Plan 1 merge, `d681e2a`)
**Precedes:** M1 Plan 2 implementation plan (`docs/superpowers/plans/`)

## 1. Scope

This is the second and final M1 backend plan (Plan 1 covered cases/parties/caseTypes/caseParties/audit-log/search-normalization, merged to `main`). Plan 2 covers:

- `documents` + `documentVersions` CRUD, scoped to a case
- File upload via Convex's native storage
- Immutable version history + restore
- A checklist-status read model over `caseTypes.requiredDocumentChecklist`
- Document search (Arabic-normalized, same pattern as cases/parties)

Out of scope for this plan (explicitly deferred, see §4): OCR engine integration, confidentiality-level access enforcement beyond plain classification, frontend routes/components.

## 2. Key Decisions

Decisions below were made collaboratively during brainstorming; each records the reasoning so a future reader doesn't have to reconstruct it.

### 2.1 Storage: native Convex file storage, not hand-rolled S3

IMPLEMENTATION_PLAN.md §2 and the Naab-reuse catalog both describe a hand-rolled presigned-S3 flow (`generateUploadUrl` action → client PUTs to S3 → save mutation `headObject`-verifies content-type/size), copied from the reference product's own direct-S3 setup.

**Decision:** use Convex's native file storage API instead — `ctx.storage.generateUploadUrl()` already returns a presigned upload URL, and the `_storage` system table already exposes `contentType`/`size`/`sha256` for free via `ctx.db.system.get('_storage', fileId)`, with no manual `headObject` verification step needed. Self-hosted Convex (docker-compose, per PRD §5.6) still backs this with S3-compatible storage under the hood, so nothing is lost operationally — this only removes hand-rolled code that duplicates what Convex already does.

**Why:** the reference product's pattern was designed for direct S3 access, which this project isn't using. Replicating it here would be unnecessary code with no offsetting benefit.

### 2.2 OCR: stub the trigger, defer the engine

PRD.md §12 explicitly lists OCR engine selection as an unresolved open question ("Arabic OCR is meaningfully harder than Latin-script OCR... needs an explicit evaluation, not a default pick").

**Decision:** `create` and `addVersion` schedule `internal.internal.documents.processOcr` (an `internalAction`) via `ctx.scheduler.runAfter(0, ...)`. The action body is a no-op for now — no engine call, `ocrText` stays unset. This proves the wiring end-to-end (scheduling, the hook point, the field it would populate) without committing to an engine. Wiring a real engine later is a small follow-up (fill in the action body), not a schema or pipeline change.

**Why:** the PRD flags the engine choice as a real technical risk needing its own evaluation — picking one under this plan's scope would be a guess, not a decision. But leaving no hook at all would mean redesigning the pipeline later. This threads the needle.

### 2.3 Confidentiality levels: classification-only

`confidentialityLevel` (`standard`/`confidential`/`privileged`) exists on `documents`, but neither PRD.md nor the RBAC catalog (`packages/shared/src/rbac.ts`) defines what it restricts. The RBAC catalog has one `documents:read`/`write`/`delete` set per role — Accountant has zero document access at all, but there's no finer-grained permission distinguishing privileged docs for roles that do have `documents:read`.

**Decision:** for this plan, `confidentialityLevel` is stored and displayed but doesn't gate access beyond the existing `documents:read`/`write`/`delete` + case-scoping rules. No new permission, no extra check.

**Why:** inventing an access policy nobody has specified yet risks building the wrong one. Revisit if/when a real "who should NOT see privileged docs" requirement surfaces.

### 2.4 Versioning semantics

- **Metadata edits never create a version.** Editing `title`/`kind`/`confidentialityLevel` without a new file upload is a plain patch on the `documents` row (audited via the existing `recordAuditEvent`, no `documentVersions` row). "Version" means file content, and only file content — keeps the concept unambiguous.
- **Document creation always includes a file.** No metadata-only placeholder documents; `create` produces the `documents` row and its version 1 together, in the same mutation. `currentVersionId` is never in a long-lived undefined state.
- **Restore creates a new version, never rewrites one.** `restoreVersion` reads an old version's `storageKey`/`mimeType`/`fileSize` and creates a new `documentVersions` row pointing at that old file — the schema's existing invariant ("versions are immutable rows, never overwritten") already assumed this; this plan makes it concrete.
- **`currentVersionId` is a denormalized pointer, maintained transactionally.** The schema already has this field (fixed by Plan 1/Phase 0). Both the pointer patch and the version insert happen inside the same mutation call, which Convex guarantees is atomic — no separate reconciliation logic needed.

### 2.5 Function shape: one mutation per operation

**Decision:** separate mutations — `documents.create`, `documents.addVersion`, `documents.restoreVersion` (thin wrapper reusing `addVersion`'s model helper), `documents.update` (metadata-only), `documents.remove` (soft delete) — rather than one unified `save`/`mutate` entry point with branching logic.

**Why:** matches Plan 1's established convention (`cases.ts`/`parties.ts` each expose one mutation per distinct operation). Each operation has its own precise permission check and audit action; collapsing them behind a branch or an action-enum makes both harder to test in isolation and harder for a reviewer to reason about.

### 2.6 Checklist-status read model

**Decision:** add `getChecklistStatus(caseId)` — cross-references the case's `caseTypeId` → `caseTypes.requiredDocumentChecklist` against the case's non-deleted documents grouped by `kind`, returning `{ kind, satisfied }[]`. Read-only, no new schema, case-scoped via the existing `requireAccessibleCase`.

**Why:** `requiredDocumentChecklist` already exists in the schema but nothing reads it. This is the smallest read model that makes the field useful this milestone, without building the frontend checklist UI itself (deferred, per IMPLEMENTATION_PLAN.md's framing of checklist UI as later frontend work).

### 2.7 Upload limits

**Decision:** enforce a content-type allowlist and a size cap in `create`/`addVersion`, checked against the `_storage` system table's `contentType`/`size` after upload. On failure: throw — no document or version row is created.

- **Allowlist (exact `contentType` strings):** `application/pdf`, `image/jpeg`, `image/png`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`).
- **Size cap:** `26214400` bytes (25 MiB = 25 × 1024 × 1024), as a named constant (e.g. `MAX_DOCUMENT_FILE_SIZE_BYTES`) in `model/documents/versions.ts`, not a magic number inline.

**Why:** prevents obviously-wrong uploads (executables, huge files) without needing a fully-designed file-handling policy. Covers the realistic legal-document shapes (scans, photos, word-processor files) without over-restricting.

**Correction, discovered during Task 1 implementation:** the original decision above also called for deleting the orphaned blob (`ctx.storage.delete()`) before throwing. This is not possible — Convex mutations are transactional across storage operations as well as database writes, so a `ctx.storage.delete()` call immediately followed by a `throw` inside the same mutation call is rolled back along with everything else and never actually persists (verified empirically against convex-test@0.0.54, which faithfully mirrors this). An orphaned blob from a rejected upload is therefore an accepted, permanent gap in this plan, not a bug to work around — no scheduled cleanup, no two-phase mutation split. The implementation plan (`docs/superpowers/plans/2026-07-10-lcms-m1-documents.md`) reflects this correction in its Global Constraints.

### 2.8 Search scoping (correction, discovered at final whole-branch review)

§4's original `search` design gated only on the flat `DOCUMENTS_READ` permission, framed as "matching cases.search/parties.search precedent." The final whole-branch review found that framing doesn't hold and that the design as originally written leaks document metadata across the case-level own-vs-all boundary:

- `cases.search` gates on `CASES_READ_ALL` specifically — a role without it (Lawyer, Associate) cannot call `cases.search` at all, so its firm-wide scope never exposes more than a see-all role already sees.
- `parties.search` operates on `parties`, a resource with no own-vs-all scoping to begin with — there is no boundary to violate.
- `documents` is case-scoped like `cases`, but `documents:read` has no own/all split of its own (§4). Gating `search` on the flat permission means Lawyer/Associate (who hold `documents:read` + `cases:readOwn` but not `cases:readAll`) can search and receive titles/`confidentialityLevel`/`caseId` for documents on colleagues' cases they cannot open via `get`/`list`/`getDownloadUrl`. For a legal product, this crosses an ethical-wall/conflicts boundary between matters — not acceptable to ship silently.

**Corrected decision:** `search` keeps the flat `DOCUMENTS_READ` permission as the action gate, but adds a bounded per-page own-vs-all post-filter after the search-index query — mirroring the exact pattern already established by `listCasesForParty` (`model/caseParties/caseParties.ts`, from Plan 1): callers holding the Owner wildcard or `CASES_READ_ALL` see the full page; everyone else gets each result's case checked (`ctx.userId === case.primaryLawyerId && CASES_READ_OWN`), filtering out anything they couldn't otherwise open. This is O(page size) case lookups, not a firm-wide scan.

## 3. Schema Changes

Two gaps in the existing `documents` table (defined in Phase 0, before this design pass):

1. **Add `searchText: v.string()`** + `.searchIndex('search_text', { searchField: 'searchText', filterFields: ['firmId', 'deletedAt'] })` — matches the pattern already on `cases`/`parties`. Computed from `title` only for now (`normalizeSearchText`, reused from Plan 1's `lib/search/normalizeSearchText.ts`); OCR text folds in later once an engine exists, with no schema change needed then.
2. **Add `.index('by_case_deleted', ['caseId', 'deletedAt'])`** — needed so "list this case's non-deleted documents" uses `.withIndex()` rather than an unindexed `.filter()`, per the manifesto's rule.

`documentVersions` needs no schema changes — its existing shape (`firmId`, `documentId`, `versionNumber`, `storageKey`, `mimeType`, `fileSize`, `ocrText`, `uploadedBy`, `createdAt`, indexed `by_document`/`by_firm`) already supports everything in §2.

## 4. Function Surface

Four-zone convention (Backend Manifesto, already established by Plan 1):

### `convex/documents.ts` (thin surface)

| Function | Kind | Notes |
|---|---|---|
| `generateUploadUrl` | mutation | Permission-checked (`documents:write` + `requireAccessibleCase`) *before* issuing the URL. |
| `create` | mutation | New document + version 1, one transaction. Validates blob via `_storage` system table; deletes orphaned blob and throws on invalid type/size. Schedules `processOcr`. |
| `addVersion` | mutation | New version on an existing document. Same blob validation. Bumps `versionNumber`, patches `currentVersionId`. Schedules `processOcr`. |
| `restoreVersion` | mutation | Thin wrapper: reads an old version's file fields, calls the same model helper as `addVersion`. |
| `update` | mutation | Metadata-only patch (`title`/`kind`/`confidentialityLevel`). No version created. |
| `remove` | mutation | Soft delete — `deletedAt` on the `documents` row only. Versions and blobs untouched (matches cases/parties precedent). |
| `get` | query | Single document by ID, case-scoped. |
| `list` | query | Paginated, case-scoped (`by_case_deleted`), own-vs-all via `requireAccessibleCase`. |
| `listVersions` | query | Paginated, per document. |
| `getDownloadUrl` | query | Re-checks permission + case access on *every* call, then `ctx.storage.getUrl()`. Never trust a cached URL client-side. |
| `search` | query | Same shape as `cases.search`/`parties.search` from Plan 1. |
| `getChecklistStatus` | query | Per §2.6. |

### `convex/model/documents/`

- `documents.ts` — create/update/remove logic, checklist computation.
- `versions.ts` — shared `addVersion`/`restoreVersion` helper, blob validation (content-type allowlist, size cap), OCR-scheduling call.

### New error codes (`convex/lib/errors.ts`)

`DOCUMENT_NOT_FOUND`, `DOCUMENT_VERSION_NOT_FOUND`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`.

### `convex/internal/documents.ts`

`processOcr` — `internalAction`, no-op body for now (per §2.2).

## 5. Testing Plan

`convex-test`, TDD, per Plan 1's established pattern:

- **Upload/version flow:** `generateUploadUrl` rejects without case access; `create` rejects invalid content-type/size and cleans up the orphaned blob (no document/version row left behind); `create` sets `currentVersionId` correctly; `addVersion` bumps `versionNumber` and repoints `currentVersionId`; `restoreVersion` creates a new version row (never mutates the old one) carrying the old file's `storageKey`/`mimeType`/`fileSize`.
- **Case-scoping:** a Lawyer without `CASES_READ_ALL` can't list/read/download documents on another lawyer's case, even holding `documents:read`.
- **Soft delete:** `remove` hides the document from `list`/`search`; `get`/`getDownloadUrl` on a deleted document's ID throws `DOCUMENT_NOT_FOUND` (not silently returns stale data).
- **Checklist:** satisfied/missing kinds computed correctly against a case's actual non-deleted documents.
- **Search:** Arabic-normalized title matching works identically to cases/parties (reuses `normalizeSearchText`, no new normalization logic).

## 6. Definition of Done

On top of Plan 1's baseline (PRD DoD + manifesto checklists):

- A version is never overwritten — restoring an old version is provably a new row, verified by a test, not by inspection.
- Uploading an invalid file type or oversized file leaves no orphaned blob and no document row.
- A case's required-document checklist correctly reflects its actual documents after upload/delete.
- Document access respects the same own-vs-all case scoping as the parent case, not just `documents:read` in isolation.
- Search returns documents scoped to the firm with the same Arabic fuzzy-matching behavior already proven for cases/parties.

## 7. Explicitly Deferred

- **OCR engine selection and integration** — PRD §12 open question; `processOcr` stays a no-op until resolved.
- **Confidentiality-level access enforcement** — no policy exists yet beyond classification; revisit when a real requirement surfaces.
- **Frontend** — routes (`_app/cases/$caseId/documents`), the Documents tab, upload/version-history UI, checklist UI — all per IMPLEMENTATION_PLAN.md §2's frontend section, not this plan.
