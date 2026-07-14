# Diwan Implementation Plan

**Status:** Draft, for team review **Based on:** PRD.md v0.3 **Stack:** Convex (backend) + React/Tailwind (frontend), per the company Backend/Frontend Manifestos (mirrored in this repo at [`docs/standards/`](docs/standards/))

---

## 0. How to use this plan

This plan has two layers, matching how both manifestos say to build:

1. **Phase 0 — Foundation.** Schema, errors, the auth/tenant/permission ladder, RBAC seed, and the frontend's tokens/primitives/data-engine/router shell. This is built **once**, before any feature, and every later phase is a leaf on it. Do not let a milestone's feature work start before its slice of Phase 0 exists — a feature built ahead of the foundation is a feature that gets rewritten.
2. **M1–M5 — Features.** Mirrors PRD.md §9 exactly, in the same order, for the same reason (money built early because it's the highest-liability module, not because anything is optional — **everything below is v1**).

Each milestone lists: the schema it needs, the backend functions to build (function surface + model layer), the frontend routes/data slices, and a Definition of Done. The DoD for *every* function and *every* component is the manifestos' own checklists (Backend Manifesto §11, Frontend Manifesto §11) — this plan doesn't repeat those in full per milestone, it just flags anything module-specific on top of them.

Tenant key is **`firmId`** everywhere (the manifestos' `clinicId` pattern, renamed to this domain). Every table, every index, every context object uses that name.

---

## 1. Phase 0 — Foundation

Nothing in M1 starts until this phase is done. Build order within this phase, per the manifestos' own sequencing:

### 1.1 Backend
1. **`schema.ts` skeleton** — every table this plan names below gets defined now, even if a milestone won't populate it until later: `firms`, `subscriptions`, `users`, `firmMembers`, `roles`, `memberPermissionOverrides`, `cases`, `caseTypes`, `parties`, `caseParties`, `documents`, `documentVersions`, `hearings`, `missions`, `ledgerEntries`, `receipts`, `checks`, `installmentPlans`, `financialCounters`, `caseAccountBalances`, `notifications`, `notificationPreferences`, `auditLog`, `aiThreads`, `aiMessages`, `aiUsageCredits`. Every tenant-scoped table carries `firmId: v.id('firms')`; tenant-rooted indexes lead with `firmId`, while child indexes may lead with an already-authorized parent ID.
   - **`subscriptions`**: `firmId`, `plan`, `seatLimit`, `status` (trial/active/past_due/cancelled), `billingNotes` (manual/invoiced in v1 — see PRD §5.6 — but the schema exists now so tenancy-and-billing aren't bolted on later). Seat-count enforcement (denying a new member invite past `seatLimit`) is a real Phase 0/M1 check even though the checkout flow itself is out of scope for v1.
2. **`lib/errors.ts` + `lib/validators.ts`** — `AppError` class, an `ERROR_CODES` catalog seeded with the first real codes we know we need (`UNAUTHENTICATED`, `FIRM_NOT_FOUND`, `NOT_A_FIRM_MEMBER`, `INSUFFICIENT_PERMISSIONS`, `SEAT_LIMIT_REACHED`, `CASE_NOT_FOUND`, `PARTY_NOT_FOUND`, `LEDGER_BALANCE_WOULD_GO_NEGATIVE`, …), `literalUnion` helper.
3. **Shared package** (`packages/shared` or equivalent) — every enum (case status, case type, party role, payment method, mission type/status, notification event type) as `as const` arrays, consumed by both ends. No enum gets hand-typed twice. **RBAC catalog specifically** follows a fixed shape: `RESOURCES`/`ACTIONS` constants → a `buildPermission(resource, action)` string builder → a flat `PERMISSION_CATALOG` array derived from them → per-role permission arrays (`OWNER_ROLE_PERMISSIONS`, `LAWYER_ROLE_PERMISSIONS`, …) → a `normalizePermissionDependencies()` pass that auto-adds implied permissions (e.g. granting case-write implies case-read). Owner gets the wildcard, not an enumerated list.
4. **`functions.ts` — the authenticated boundary.** Auth is **`@convex-dev/auth`** (per the Backend Manifesto's reference stack — this is a settled choice, not an open question). `loadAuthenticatedUser`, `loadMemberContext` (role permissions + per-member overrides, owner wildcard), and the two builders actually used by this application: `firmQuery`/`firmMutation`. They accept an optional explicit firm and otherwise use `activeFirmId`. Add a narrower builder only when a real endpoint needs a different context contract. Export `requireFirmPermission`.
5. **RBAC seed** — `internal/rbac.ts`: idempotent upsert of the six roles (Owner, Lawyer, Associate, Secretary, Accountant, Paralegal) and the permission catalog from PRD §6, built per #3's pattern. Wired into `deploy → rbac:seed → migrate`.
6. **`model/authz/`** — `memberContext.ts` (already covered by #4's `loadMemberContext`), `owned.ts` (`requireLawyerScopedAccess` — the Lawyer "own vs. assigned" pattern, Diwan's equivalent of a dentist-scoping helper), `requireAccessibleCase`.
7. **`internal/provisioning.ts`** — a single `internalMutation` (`createFirmWithOwner`), staff-run, that creates a firm + `subscriptions` row + first Owner `firmMember` in one call. This *is* the v1 onboarding flow (PRD §5.6) — there is no public signup route in v1, so this needs to exist before the first design-partner firm can be created, not just before M5.
8. **Hosting & ops**: self-hosted Convex, docker-compose, on Postgres (PRD §5.6). Backup/point-in-time-recovery policy for the Postgres store is part of this setup, not a later add-on — write it down as an explicit runbook step alongside the deploy scripts, don't leave it implicit.

### 1.2 Frontend
1. **Design tokens** — `colors.css` + `theme.css` (`@theme inline`), the neutral ramp, three text rungs, one primary color (pick the Diwan brand primary — not necessarily the same hex as other products), state pairs, `chart-1..5`. RTL font stack (`--app-font-family-rtl` Tajawal-first, `--app-font-family-ltr`) wired via `:root[dir]`.
2. **Motion budget constants** — spring/tween tokens, reduced-motion wiring, before any animated component exists.
3. **Primitives** — Radix/Base-UI-backed `cva()` components (button, input, select, dialog, etc.), the typed dialog store, the `Form`/`FormField` stack.
4. **Data engine** — Convex bridged into TanStack Query (`ConvexQueryClient`, `makeConvexQuery`/`makeConvexIdQuery`, `staleTime: Infinity`), the optimistic-rollback engine, the `lib/data/<entity>/` quintet template.
5. **Router shell** — `_auth`/`_app` layout routes (no `_admin` needed at Diwan's role scale — Owner covers it) with cached-first `beforeLoad` guards, warmup pipeline, `NavigationProgress`.
6. **App shell top bar** — a persistent header alongside the sidebar on every `_app` screen: a global search trigger (opens the Search module, `⌘K`-style shortcut) and a notifications bell (opens Notifications as a popover, unread-count badge). Build this in Phase 0, not per-screen — every screen mounts inside the same shell rather than each page inventing its own header chrome. (Restores a v0.2 detail dropped in the v0.3 PRD rewrite — see PRD §5.3.)
7. **Responsive shell, three navigation modes off one layout primitive** — per PRD §5.3's breakpoint spec: desktop sidebar, tablet icon-rail (same nav data, no labels), mobile bottom-tab-bar + overflow drawer. Build all three off the *same* nav-item data source (icon + label + route + permission) so adding a nav item is one array entry, not three separate edits. Every list/table screen needs a card-list rendering path for mobile — don't build the desktop table and bolt mobile on later; design the data-to-row mapping so table-row and mobile-card are two renderers over the same row data from day one.

### 1.3 Definition of Done for Phase 0
- A firm can be created, a user invited and assigned a role, and `requireFirmPermission` correctly allows/denies against a seeded permission — provable with one `convex-test` per role.
- Zero raw hex/`bg-gray-*` in the frontend tree; zero components built before the token file exists.
- `tsc --noEmit` and the lint/unused-export gate both green with an empty feature set.

---

## 2. M1 — Multi-tenant core: Cases, Parties, Documents, Search, Audit

### Backend
- **`cases`**: `firmId`, `internalNumber`, `courtNumber`, `courtName`, `caseTypeId`, `claimAmount`, `status` (Intake→Filed→InHearings→Verdict→Execution→Closed→Archived), `deletedAt`. Indexes: `by_firm_status`, `by_firm_deleted_created`, `by_firm_lawyer_deleted_created`, and a `searchIndex` on computed `searchText`.
- **`caseTypes`**: admin-configurable taxonomy row per firm (seeded from a Palestine default set) — `firmId`, `key`, `label`, `requiredPartyRoles`, `requiredDocumentChecklist`. This is what makes a second jurisdiction later a data-entry task, not code (PRD §2). **The actual default content here is a legal-research deliverable, not an engineering one — needs an owner assigned alongside this milestone (PRD §12), or M1 ships with an empty taxonomy.**
- **`parties`**: `firmId`, `nationalId`, `fullName`, `fatherName`, `dob`, `phone`, `address`, `deletedAt`. `nationalId` is the disambiguation key (PRD's non-goal on OTP means this is the *only* identity mechanism — get the dedup-on-nationalId logic right, since there's no second factor to fall back on).
- **`caseParties`**: join row — `firmId`, `caseId`, `partyId`, `role` (plaintiff/defendant/guardian/intervener/…), `representingLawyerId`, `powerOfAttorneyRef`.
- **`documents` + `documentVersions`**: `firmId`, `caseId`, `kind`, `confidentialityLevel`, `ocrText` (Arabic+English), `storageKey`; versions are immutable rows, never overwritten. Storage: presigned S3 upload (`generateUploadUrl` action returns `{uploadUrl, storageId, uploadHeaders}` → client PUTs directly → a save mutation `headObject`-verifies content-type/size server-side before persisting metadata). **Document *versioning* itself (a version-history list, "restore an older version") has no existing pattern to lean on anywhere — budget real design time for it, don't assume it falls out of the upload flow for free.**
- **`auditLog`**: `firmId`, `actorId`, `entityType`, `entityId`, `action`, `before`/`after` snapshots, `createdAt` — written by a single model-layer helper called from every mutating cascade, not hand-rolled per handler.
- **Search/Arabic normalization**: a `normalizeSearchText()` utility applied when computing every table's `searchText` field — NFKD decompose, strip diacritics/tatweel, unify Alef variants (أ إ آ ٱ → ا), unify hamza-on-carrier (ؤ/ئ → و/ي), fold teh-marbuta (ة → ه), strip bare hamza, lowercase, collapse whitespace — plus excluding numeric/date-shaped tokens from fuzzy matching so phone numbers and dates don't pollute name search. Pair it with a match-highlighting function that maps positions in the *normalized* string back onto ranges in the *original* string for display. This is a self-contained utility (`lib/search/normalize.ts` or similar) — write it once in Phase 0/M1, every subsequent `searchText` field uses it.
- **Model layer**: `model/cases/` (create/update/archive + status-transition validation), `model/parties/` (dedup-by-nationalId lookup, merge with history retained), `model/documents/` (version cascade; add OCR scheduling only when an engine exists), `model/audit/` (the one `recordAuditEvent` every other model calls).

### Frontend
- Routes: `_app/cases`, `_app/cases/$caseId`, `_app/cases/$caseId/parties`, `_app/cases/$caseId/documents`, `_app/parties` (**Clients — the firm's full list of people/parties, its own sidebar destination, not just a sub-view of a case**), `_app/parties/$partyId` (cross-case person view — shows every case this person is party to, in any role), `_app/search`.
- Data slices: `lib/data/cases/`, `lib/data/parties/`, `lib/data/documents/` — full quintet each.
- Cases and Clients are two views onto the same `caseParties` join data, cross-linked both directions: a case's Parties tab links out to each party's full profile; a client's profile lists every case, linking back in. Neither view is a dead end.
- **Case-file detail page (`_app/cases/$caseId`) composition pattern**: one page component + a collapsible header + a tab strip (Parties/Documents/Hearings/Missions/Payments), where each tab's data comes from its own dedicated hook (`useCaseParties`, `useCaseDocuments`, …) rather than one giant page-level fetch. Tabs are filtered through the permission catalog before rendering (a Secretary shouldn't see a Payments tab they can't act on, an Associate's Payments tab is read-only). All of a case's dialogs (add party, upload document, schedule hearing, …) are bundled into one lazy-loaded dialog group gated behind a single "any dialog open" boolean, so dialog code isn't in the initial page bundle. This is the load-bearing UI pattern for the whole product — every module attaches to a case, so this page is where they all actually meet.
- Intake flow has a hard speed target (PRD §6, Secretary row: keyboard-driven, under 3 minutes) — build it after the quintets exist, not before, but don't let it slip as "just another form."

### Definition of Done (module-specific, on top of §1.3's baseline)
- Two parties with identical names and different national IDs never merge; two records with the same national ID always resolve to one person, with history retained on merge.
- Archiving a case never deletes anything reachable — it's fully findable from Search and Archive views immediately after.
- Search returns cases/people/documents scoped to the firm, with Arabic fuzzy matching (hamza/ta-marbuta/alef variants) on party names, and highlights matches correctly against the original (non-normalized) text.
- A Secretary account never sees a case-file tab their role can't act on; an Associate's read-only tabs are provably read-only, not just visually greyed.

---

## 3. M2 — Money

Built second, not last, on purpose (PRD §9) — this is the module with the least tolerance for a wrong assumption.

### Backend
- **`ledgerEntries`**: append-only, `firmId`, `caseId`, `accountType` (trust/fee/client), `personId`, `amount`, `direction`, `type` (payment/refund/adjustment), `refType`/`refId`, `createdAt`. No `update`/`delete` mutation exists for this table at all — corrections are new reversing rows (a bounced check inserts an exact negative counter-row rather than mutating the original; a reinstated check inserts the exact positive counter-row back; the full flip-flop history survives forever and every balance is just a sum over the rows). This is the one table where "no mutation exists" is itself the safety mechanism, stronger than a permission check.
- **`receipts`**: `firmId`, `caseId`, `receiptNo`, `payerId`, `payeeId`, `amount`, `method`, `date`, `remainingBalance`, `signatureRef`. **`receiptNo` must be a real gapless sequential counter per firm** (a Convex-transaction-safe increment, not a random code and not a client-computed positional index) — this is a legal/financial requirement, not a display nicety, and there's no shortcut pattern to lean on for it; budget real design attention here specifically.
- **`checks`**: `firmId`, `caseId`, `receiptId`, `checkNumber`, `bank`, `dueDate`, `status` (received→deposited→cleared/bounced). The denormalized `caseId` supports bounded per-case reads and authorization without receipt fan-out. A bounced check both writes a reversing ledger entry and raises a mission (cross-module cascade — call `model/missions/createFromEvent` from `model/billing/`, not the other way around).
- **`installmentPlans`**: schedule rows feeding the notification escalation ladder.
- **`financialCounters`**-style aggregate table for who-owes-whom: running totals keyed by `(firmId, scope: 'firm'|'lawyer', lawyerId)`, maintained by computing a before/after delta on every ledger write and patching the counter row in the same transaction — not recomputed from scratch on every read. This is what makes the lawyer/owner dashboards fast without a full ledger scan per page load.
- **`caseAccountBalances`**: one transactional row per case and trust/client account type, maintained by the same sole ledger append path. Reads stay O(1); any deployment with pre-existing trust/client ledger rows must backfill the counters before this code is deployed.
- **Model layer**: `model/billing/ledger.ts` (the sole append path and indexed account balances), `model/billing/paymentFlows.ts` (atomic payment/refund/disbursement orchestration plus the sequential receipt counter), `model/billing/checks.ts`, `model/billing/aggregates.ts` (fee delta-counter maintenance), and `model/billing/dto.ts` (the validators/mappers shared by billing entrypoints). Every write here needs a `convex-test` that snapshots before/after ledger state, per the manifesto's testing rule for money/cascade logic specifically.

### Frontend
- Routes: `_app/payments`, `_app/payments/receive`, `_app/payments/receipts`, `_app/payments/checks`, `_app/payments/who-owes-whom` (role-scoped: lawyer sees own, owner sees firm-wide).
- Data slice: `lib/data/payments/` (and `lib/data/receipts/`, `lib/data/checks/` if the quintets get large — split by table, not by screen).
- **Page shape**: a KPI stats-strip (declarative card-definitions → summary values, horizontally scrollable on narrow screens) above a tabbed table (by-case / transactions / installments), matching the composition already established for Reports (§6). **Recording a payment** is a multi-step wizard dialog (case/invoice summary → method-specific step, cash vs. check details → confirmation), not one long form.
- **Receipts render as PDFs** (a PDF-rendering library with RTL support — Arabic receipt layout is a solved problem in general, just needs the same care as everything else: right-to-left text flow, correct number formatting, firm branding).

### Definition of Done
- Every ledger mutation is provably append-only in code review (no `patch`/`replace`/`delete` call exists on `ledgerEntries` anywhere outside a migration).
- `receiptNo` never collides and never has a gap traceable to anything other than a genuine void — provable under concurrent writes, not just in a single-threaded test.
- A bounced check produces, in one transaction-equivalent flow: a reversing ledger entry, an updated check status, and a mission — verified by a cascade test, not by manual QA.
- The `financialCounters` aggregate is provably consistent with a full re-sum of `ledgerEntries` after a batch of concurrent writes (a reconciliation test, not just a happy-path check).
- Disbursement-blocked-until-cleared is enforced server-side (not just hidden in the UI), with the override path requiring a reason and writing an audit event.

---

## 4. M3 — Coordination: Hearings, Calendar, Missions, Notifications

### Backend
- **`hearings`**: `firmId`, `caseId`, `date`, `court`, `judge`, `hall`, `outcome`, `nextHearingId` (self-link, preserves postponement chain), `deletedAt`.
- **`missions`**: `firmId`, `caseId`, `title`, `type`, `assigneeId`, `dueDate`, `priority`, `status`, `checklist`. Deadline-critical types (appeal window, statute deadline) are created by `model/missions/createFromEvent`, triggered off verdict/hearing writes — not a cron scanning for "did a verdict happen," a direct cascade call.
- **`notifications` + `notificationPreferences`**: `firmId`, `userId`, `eventType`, `payload`, `read`, `createdAt`, plus a `routingTable` (or a static data structure in `model/notifications/`) mapping event type → notified roles, matching PRD §8's table exactly — **build this as an actual data-driven table from the start**, not a per-handler switch statement that grows unmaintainable as event types multiply. Outbound SMS/WhatsApp to parties is an `action` (external I/O boundary — never inline in the mutation that creates the hearing).
- **Scheduling conflict detection has no existing pattern to lean on — design it fresh.** The mechanism: at write time (inside the `firmMutation` that creates/updates a hearing), an indexed range query on `by_lawyer_date` for the target lawyer's existing hearings overlapping the new time window; a genuine interval-overlap check (`newStart < existingEnd && existingStart < newEnd`), not a naive equality check on start time. Surface it as a warning the scheduler can override (not a hard block — a lawyer legitimately double-booked across two courts may need to proceed), but the check itself must be server-side and consistent regardless of which client is scheduling.
- **Model layer**: `model/hearings/` (the conflict-detection query above), `model/missions/`, `model/notifications/` (the routing table lives here as data).

### Frontend
- Routes: `_app/hearings` (Today/Upcoming/Postponed/Court calendar), `_app/calendar`, `_app/missions`, `_app/notifications`.
- Data slices: `lib/data/hearings/`, `lib/data/missions/`, `lib/data/notifications/`.
- Calendar conflict warning needs to be an inline UI signal at scheduling time, not a separate report — the manifesto's optimistic-write pattern applies here too (show the conflict warning from the same mutation response, don't round-trip separately).
- **Notification center**: this is the same component the app-shell top bar's bell opens (Phase 0 §1.2.6) — don't build a second one here. Each notification's `eventType` drives a routing function to the right destination (a hearing notification opens that hearing's tab on that case, a payment notification opens Payments) — gate navigation through the same permission check as the destination itself, so a notification never accidentally reveals a screen the user couldn't otherwise reach.
- **Missions board is a Kanban, not a table** — matching PRD §4's "task board" language literally. Columns by status (e.g. To Do / In Progress / Done, or however the firm's workflow maps `missions.status`), drag-and-drop to change status, cards showing title, case reference, assignee, due-date badge, priority. A flat sortable table is a legitimate secondary view (useful for bulk triage) but the board is the primary one.
- **Calendar per-lawyer view, reusing an existing drag-and-drop calendar component** — one column per lawyer (a lawyer-scoped view of the shared firm calendar), consistent with how Cases/Hearings are otherwise lawyer-scoped throughout the product. **Revising the earlier call in this doc to scope this down to a plain agenda/list view**: that was reasoned as "not worth building a heavy scheduling widget from scratch for a 1–10 lawyer firm," but the team has a working drag-and-drop calendar component (month view, per-resource columns, collision detection) from a sister product that can be adapted rather than built fresh — reuse cost, not build cost, so the original tradeoff no longer holds. Adapt it: swap the resource axis from doctors to lawyers, keep the drag-and-drop rescheduling and the per-column layout, drop anything genuinely dental-specific.

### Definition of Done
- An appeal-deadline mission is provably auto-created from a verdict-hearing write in a cascade test, with the correct 7d/3d/1d escalation notifications scheduled.
- Two hearings booked for the same lawyer at overlapping times always surface the conflict warning, server-verified (not just client-side) — including partial overlaps, not just identical start times.
- The notification routing table is data (inspectable/editable in one place), not logic scattered across handlers — provable by grep, not just by reading one handler.

---

## 5. M4 — AI Assistant

Depends on M1–M3 existing — this milestone is almost entirely thin wrappers, which is the point.

### Backend
- **`aiThreads` + `aiMessages`**: `firmId`, `userId`, `clientThreadKey` (dedupe across reconnects), message rows reconciled via a `syncSnapshot`-style mutation rather than one-mutation-per-token.
- **`aiUsageCredits`**: `firmId`, `balance`, `ceiling`, event log (`before`/`after` per LLM call) — gate every model call on remaining credit before it fires, in an `action`, never in a query/mutation.
- No new authorization primitive — every tool's `execute` calls an existing `firmQuery`/`firmMutation` from M1–M3. If a tool needs a capability that doesn't exist as a normal backend function yet, **build the normal function first**, then wrap it — never give the agent a bespoke code path a human UI action doesn't also have.

### Frontend / agent runtime
- Client-driven tool-calling loop (chat + voice), calling the same authenticated Convex client the rest of the app uses, so an agent-driven write updates every open screen live.
- Tool catalog v1 (map 1:1 to PRD §5.5 examples, extend as needed): case/party lookup, hearing scheduling, payment registration, mission creation/reassignment, who-owes-whom balance query. Keep the catalog behind lazy tool-discovery from the start if it grows past ~15–20 tools, rather than retrofitting it later.
- System prompt: action-first, no interrogation when enough information is present, hard rule against claiming a result without a real tool call this turn, a corrective retry before ever falling back to a canned refusal.
- Voice: full-duplex speech in/out sharing the exact same tool set as text (one tool catalog, two front-ends onto it — not a separate voice-specific tool list).

### Definition of Done
- Every tool call is provably scoped to the calling user's real permissions — a test where a Secretary-role agent session attempts a Lawyer-only action (e.g., approving a payment) and is denied exactly as a human Secretary would be, with the same error code.
- No tool exists that lacks a corresponding human-clickable UI action calling the same backend function.
- A firm at its AI-credit ceiling gets a clear, coded failure (not a silent hang or an uncapped bill).

---

## 6. M5 — Polish & pilot readiness

- **Reports**: case load by lawyer/type, financial aging, hearing outcomes, mission productivity — all computed read models over M1–M3 data, no new tables. Same KPI stats-strip page shape as Payments (§3) — a horizontally-scrollable card strip of declarative summary values above the detail tables, not a bespoke layout per report.
- **PWA**: installable, VitePWA-style asset caching, light read-cache for calendar/today's hearings/assigned cases (per PRD §5.3 — explicitly not full offline writes).
- **First design-partner firm onboarding**: run `internal/provisioning.ts`'s `createFirmWithOwner` (Phase 0 §1.1.7) to create the firm, seed that firm's real case-type mix into `caseTypes`, invite real users, and staff-assist entering the firm's existing open cases (PRD §5.6 — manual entry, not a bulk-import feature for v1). Dry-run the intake flow for secretary keyboard speed on real cases, not synthetic ones.

### Definition of Done
- A pilot firm's Owner and staff-assisted team can go from a staff-provisioned firm to a fully seeded taxonomy, invited team, and every existing open case entered, in one onboarding session.
- Full gate green: `tsc --noEmit`, `vitest run`, lint, and every `find:unused-*` checker across both backend and frontend.

---

## 7. Sequencing summary

```
Phase 0 (foundation)
  └─ M1 (cases, parties, documents, search, audit)
       └─ M2 (money) ─────────┐
       └─ M3 (hearings, calendar, missions, notifications) ─┐
                                                              ├─ M4 (AI assistant — wraps M1+M2+M3)
                                                              └─ M5 (reports, PWA, pilot onboarding)
```

M2 and M3 can run in parallel once M1 is done (different engineers, non-overlapping tables) — that's where "dedicated team, aggressive timeline" actually buys speed. M4 and M5 cannot start meaningfully until the modules they depend on exist.

## 8. Non-goals reminder (do not build these in this plan)

Same list as PRD §3 — OTP/phone verification, offline-write sync engine, native desktop app, external client/judge portal, e-filing API integration, multi-jurisdiction case-type engine, accounting/tax module. If a milestone's work seems to require one of these, that's a signal to re-read PRD §10 before proceeding, not a signal to add it back quietly.
