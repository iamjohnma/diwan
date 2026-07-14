# PRD — Diwan: Legal Case Management SaaS

**Version:** 0.3 (Draft) **Status:** For review **Owner:** Rani (with Claude) — supersedes v0.2 by Salah al-Din
**Product:** a new vertical SaaS in IzTechValley's product portfolio, following the company's established playbook: a workflow set borrowed from someone else's simple single-firm tool, rebuilt as a proper multi-tenant SaaS to the company's engineering and design quality bar (Backend/Frontend Manifestos).
**Design:** full v1 screen set (desktop/tablet/mobile), design system, and interaction flows are in [`docs/design/`](docs/design/README.md) — source file is `des.pen` (Pencil) at the repo root.

---

## 1. What we're building and why

A small/solo Palestinian law firm (1–10 lawyers) today runs on paper case files, Excel sheets, and WhatsApp. Hearing dates get lost, nobody can say cleanly who owes whom, and case documents live in physical folders or scattered phone photos. We're building the software that replaces that stack: a case, hearing/deadline, document, and money system a firm actually trusts enough to switch to.

This PRD replaces v0.2, which was modeled directly on a single-firm offline .NET desktop app a person we met had built. That app's assumptions (offline-first desktop, single-tenant, heavy identity/OTP verification) leaked into the draft as if they were requirements for us. They're not — see [§10 What changed from v0.2](#10-what-changed-from-v02-and-why) and the companion note to Salah al-Din for the reasoning.

## 2. Market & business model

- **Who:** small/solo West Bank law firms (1–10 lawyers), price-sensitive, currently on paper/Excel/WhatsApp — underserved by any modern, Arabic-first tool.
- **Wedge:** there isn't a single feature wedge here — the pain is that a firm needs all three (case/deadline tracking, money, documents) working together before paper stops being safer than software. v1 ships the full bundle for exactly that reason (see [§4](#4-v1-scope)).
- **Pricing:** per-seat monthly subscription, billed at the firm (tenant) level — fits better than a flat per-firm price because firm size, and who needs a login, varies a lot more here than in other verticals we sell into. Exact price point is an open question, §11.
- **Jurisdiction:** Palestine (West Bank) courts first — case-type taxonomy and legal-deadline templates (appeal windows, case numbering) are built for the local court system, but stored as **admin-configurable data**, not hardcoded logic, so a second jurisdiction is a data-entry exercise later, not a rewrite.
- **Go-to-market:** land 1–2 design-partner firms first, refine, then expand across West Bank cities.

## 3. Goals & non-goals

### Goals
- Multi-tenant SaaS from the first commit — every table, query, and permission scoped to a firm (tenant), never retrofitted.
- Replace the firm's paper/Excel/WhatsApp stack for: case tracking, hearing/deadline calendar, document storage, and the payment ledger.
- Zero data loss: no hard delete anywhere — soft-delete/archive with full audit trail.
- Manifesto-quality build: calm, restrained UI (no "AI-vibe"), hard tenant isolation, RTL/Arabic-first, typed contracts end to end.

### Non-goals (v1)
- **OTP / phone-verified identity.** The source app's national-ID + OTP verification flow (SMS/WhatsApp OTP before every receipt/document signature) is cut entirely. National ID stays as a plain field for disambiguating same-name parties; no phone-verification infrastructure, no per-message SMS cost, no compliance surface. Revisit only if a real fraud/dispute pattern shows up post-launch.
- **Full offline-first sync engine / native desktop app.** No SQLite-replica, conflict-resolving sync engine, no Tauri desktop build. That architecture made sense for a single firm's offline .NET app; it does not make sense as the foundation of a multi-tenant web SaaS. v1 is a responsive, installable web app (PWA) with light read-caching (today's hearings, calendar, assigned cases available without a live connection) — not full offline writes.
- **External client/judge portal.** Employees-only in v1, same as v0.2 assumed.
- **E-filing integration with the official court system.** Manual/structured entry only; revisit if/when the judiciary exposes an API.
- **Multi-jurisdiction case-type engine.** Palestine-only taxonomy shipped in v1; schema is admin-configurable so a second country is config, not code.
- **Accounting/tax module.** Export to an accountant instead of building one.

## 4. v1 scope

Shipping as one bundle — cases, documents, hearings, money, and the AI assistant together — because that's what actually gets a firm to trust the system over paper. A partial slice (e.g., case tracking without payments) still leaves the firm's most sensitive workflow (money) on paper, which undermines the whole pitch. **Payments is a v1 module, full stop** — nothing in this PRD defers it; §9's build order sequences it early specifically because it's the highest-liability piece, not because it's optional.

| Module | Core capability |
|---|---|
| **Cases & Parties** | Case file (internal + court number), Palestine case-type taxonomy (civil, criminal, commercial, labor, personal status, administrative, execution, appeals), party roles (plaintiff/defendant/etc.), National ID as a disambiguation field (no OTP), status lifecycle (Intake → Filed → Hearings → Verdict → Execution → Closed → Archived). A person (client) is a first-class record, not just a row inside a case: a **Clients section** lists every party the firm has ever dealt with, and a client's own profile shows every case they've been party to, in any role, permission-scoped — since the same person routinely appears across multiple matters. |
| **Documents** | Per-case document tree (pleadings, exhibits, POAs, verdicts, receipts), version history, full-text search (Arabic + English), confidentiality levels. Compression/dedup is a nice-to-have, not a v1 gate — see §10. |
| **Hearings & Calendar** | Per-case hearing records (date, court, judge, outcome, next hearing), lawyer calendar with conflict detection, secretary scheduling of client meetings, legal-deadline auto-generation from verdict/hearing events (appeal windows) templated for Palestinian courts. |
| **Missions (tasks)** | Per-file task board (serve summons, submit memo, obtain prison order, etc.) with assignee, due date, priority, checklist. Deadline-critical missions auto-generate from hearing/verdict events and feed notifications. |
| **Payments** | Double-entry, append-only ledger. Cash (signature capture, no OTP), check (received → deposited → cleared/bounced), partial payments/installments, numbered receipts, who-owes-whom dashboards (lawyer and firm-wide). Online/remote payment registration is staff-mediated in v1 (no client self-serve). |
| **AI Assistant** | A conversational agent (text + voice) that takes real actions in the system, not just Q&A: "schedule a hearing for the Khalil case next Tuesday," "what does Ahmad owe on file 214," "create a mission to serve the summons by Thursday." Hands-free enough to run at a busy front desk. See §5.5. |
| **RBAC** | Owner, Lawyer, Associate, Secretary as full roles; Accountant and Paralegal as stubbed roles (permission scaffolding present, UI can be minimal). All permission checks server-side, scoped by firm — see §5. |
| **Notifications** | Role-aware, per-event routing (hearing scheduled, payment received, mission due, deadline approaching). In-app + SMS/WhatsApp to parties for hearing/verdict/payment events (outbound message only, no OTP, no inbox for parties). |
| **Search** | Global search across cases/people/documents/payments/hearings, scoped to the firm, with fuzzy Arabic name matching. |
| **Reports** | Case load by lawyer/type, financial (trust balances, fees, aging), hearing outcomes, mission productivity — enough for an owner to run the firm, not a full BI suite. |

## 5. Architecture

Built to the standard set by the company's Backend and Frontend Manifestos — not aspirational, the actual bar for this codebase. Backend is **Convex** specifically, not a generic "pick a database later" choice — §5.5 explains why that concrete choice matters once the AI assistant is in scope.

### 5.1 Multi-tenancy is the foundation, not a later migration
- **Firm = tenant.** Every tenant-scoped table leads its indexes with `firmId`; every query resolves `firmId` from a pre-validated server context, never from a client-supplied argument.
- **Function boundary:** identity → firm membership → permissions resolve exactly once in the `firmQuery` / `firmMutation` builders. They accept a member firm explicitly or fall back to `activeFirmId`; no handler re-authenticates or re-derives tenant scope.
- **RBAC** resolved once per request from role + per-member overrides; owner gets a wildcard; permission strings are typed constants shared between frontend and backend, never string literals.
- **Billing is tenant-level** (per-seat, per-firm), so the tenant model has to support seat counting and usage from day one.

### 5.2 Backend shape
- Thin function surface (validate → permit → delegate → shape) over a fat model layer (`model/cases/`, `model/billing/`, `model/documents/`, `model/authz/`, …) that owns cascades, ledger math, and recomputation.
- Typed errors (coded, not raw strings), `deletedAt`-based soft delete everywhere financial or clinical-equivalent (case/document/payment records), every access path backed by an index.
- The double-entry ledger is append-only: corrections are reversing entries, never edits.

### 5.3 Frontend shape
- Single responsive web app (installable PWA) — no separate native desktop build. Calm, restrained design system: one primary color, semantic tokens only, no gradients/glassmorphism/emoji, RTL-first with Arabic as a true first-class layout direction (not a translated afterthought).
- **Arabic-only UI for v1** — the target users don't speak English, so full bilingual i18n infrastructure is scope we don't need yet. Structure strings through an i18n layer for future-proofing (cheap to do now, expensive to retrofit), but ship one locale. Revisit if a pilot firm's staff composition changes this.
- Optimistic writes with rollback, cache-first reads. **PWA install + light offline read-caching (calendar, today's hearings, assigned cases) is delivered as part of M5**, not from the first release — see §9. It is architecture we design for from day one (this is why we're not building a full offline-write sync engine instead, §5.4), but the caching layer itself ships with pilot readiness, not before.
- **Persistent app shell**: every screen carries a top bar with a global search trigger (opens the Search module from anywhere, keyboard-shortcut-accessible) and a notifications bell (opens the Notifications module as a popover), alongside the sidebar — this detail was in v0.2 and was silently dropped in the v0.3 rewrite; restoring it here since it's the difference between the app reading as one coherent shell versus a stack of disconnected pages.
- **Responsive breakpoints and navigation, specified, not just asserted.** "Responsive web app (PWA)" was stated as a goal without ever pinning down what changes at what width — fixing that here:
  - **Desktop (≥1280px):** persistent right-edge sidebar (full labels), the two/three-column layouts described per module above.
  - **Tablet (≥768px, <1280px):** sidebar collapses to an icon-only rail (same items, no labels — tooltip on hover); multi-column layouts reflow to fewer columns before dropping to single-column.
  - **Mobile (<768px):** no sidebar at all — a bottom tab bar (Dashboard, Cases, Calendar, Missions) plus an overflow/"more" entry opening a drawer for everything else (Clients, Payments, Reports, Settings); every list/table becomes a stacked card list, never a horizontally-scrolled table.
  - **Mobile-priority modules** — the ones a lawyer or secretary actually reaches for on a phone, away from the desk: Dashboard, Cases (browse/search), Hearings & Calendar (agenda view, not the per-lawyer grid — that's a desktop/tablet layout), Missions, Payments (who-owes-whom lookup), and the AI Assistant (voice is arguably *more* natural on mobile than desktop). Documents (upload-heavy), Reports (data-dense), and Settings are desktop/tablet-primary — present but not optimized first on mobile.
- Types derived end-to-end from the backend contract; no hand-written DTOs drifting from the schema.

### 5.4 What we deliberately did not build
No SQLite replica, no changelog-based bidirectional sync, no per-device conflict resolution, no OTP/SMS-verification service, no content-addressed document dedup pipeline. These were real engineering investments in v0.2 that bought correctness the business doesn't need yet at this stage of the product's life. If a specific pilot firm's connectivity turns out to be bad enough to need real offline writes, that's a scoped v2 investment made with real usage data — not a guess baked into v1.

### 5.5 AI Assistant
A tool-calling conversational agent, text and voice. It can *do* things, not just answer questions: schedule a hearing, pull a case or party by name/ID, register a payment, create or reassign a mission, read back a who-owes-whom balance. **UI entry point: a persistent floating orb, present in a fixed corner on every screen** (not a dedicated routed page reached via the sidebar/nav) — clicking it opens a chat panel or voice mode, with distinct visual states for idle / listening / speaking. The earlier wording here ("not a bolt-on chatbot in a corner") was gesturing at capability, not chrome — the risk was a shallow FAQ-widget with no real actions, not corner placement itself. A corner-anchored orb that opens the *same* deeply-integrated, tool-calling agent (§5.5 below) isn't the shallow thing that phrase was warning against; if anything, being reachable from every screen makes it more integrated, not less. Design principles:

- **No separate authorization path.** Every action the assistant takes is a thin wrapper around the same tenant-scoped, permission-checked backend function a human clicking a button would call. A secretary's assistant session can only do what a secretary can do — the agent introduces no new privilege surface.
- **Client-driven tool-calling loop**, not a separate backend "agent service." The chat/voice loop runs in the app itself and calls the same typed, authenticated backend client the rest of the UI uses. This is *why* the backend has to be a real-time, typed backend like Convex rather than a generic REST/GraphQL layer: when the assistant creates a mission or registers a payment, every open screen for that firm updates live, the instant the action commits — no polling, no manual refresh, no stale UI after an agent-driven change.
- **Action-first, not interrogative.** The assistant acts on what it has rather than chaining clarifying questions when it has enough information, and it is never allowed to report success without a real tool call having actually run this turn.
- **Threaded, persisted conversations**, scoped per user per firm like everything else.
- **Per-firm usage metering.** LLM calls have real marginal cost, unlike the rest of the product — pricing needs a base AI-usage allotment per firm bundled into the per-seat plan, with metered top-ups beyond it (open question, §11).

### 5.6 Operations & provisioning
Decided so these stop being open questions blocking Phase 0:

- **Auth:** Convex's own auth library (`@convex-dev/auth`), matching the Backend Manifesto's reference stack — not a separate decision, just needs to be built to spec rather than assumed.
- **Hosting:** self-hosted Convex (docker-compose, on Postgres), matching the same reference stack and the team's existing operational model. Comes with a real obligation the v0.2→v0.3 rewrite dropped without replacing: **a backup/point-in-time-recovery policy for the underlying Postgres store** is part of Phase 0's deploy setup, not a later add-on — this is a system of record for legal and financial data.
- **Billing (v1):** manual/invoiced, not self-serve checkout. IzTechValley invoices design-partner firms directly, matching how the company already runs its other SaaS trials. The `subscriptions`/seat-count schema still gets built in Phase 0 (so tenancy-and-billing isn't bolted on later, per §5.1's whole point) — what's deferred is the payment-gateway integration and self-serve checkout flow, not the data model.
- **Firm/Owner provisioning:** an internal, staff-run script (a Convex `internalMutation`, not a public signup flow) creates a firm and its first Owner account. Matches the design-partner-led GTM (§2) — there is no public "sign up" button in v1.
- **Pilot data migration:** a design-partner firm's existing open cases are staff-assisted manual entry during onboarding, not a bulk-import engineering feature. Revisit only if a later firm's case volume makes manual entry impractical.

## 6. Users & roles

| Role | Key permissions |
|---|---|
| **Owner** | Everything: all cases, financials, user management, settings, reports, audit log. |
| **Lawyer** | Own/assigned cases full access, own calendar, own payment ledger, create missions. |
| **Associate** | Assigned cases (read/write per assignment), draft documents, cannot approve payments or close cases. |
| **Secretary** | Case intake, scheduling, hearings calendar, notification routing, registers cash/check payments (pending lawyer approval). Intake is the one screen with a hard speed target: keyboard-driven, under 3 minutes per case — this is a UI requirement carried forward from v0.2 that must not get lost, since it's the difference between "faster than paper" and not. |
| **Accountant** *(stub)* | Reconciles ledger, approves refunds, exports financial reports; no privileged legal documents. |
| **Paralegal** *(stub)* | Document prep, exhibit management, no financial access. |

System admin / archivist / process-server / translator roles from v0.2 are deferred — they're real but not needed for a 1–10 lawyer firm's v1; add when a pilot firm's org actually needs them.

## 7. Money & who-owes-whom

Unchanged in spirit from v0.2's model, without the OTP gate: money flows defendant → lawyer (trust) → plaintiff, firm fees deducted per agreement, as immutable ledger entries. Every payment produces a numbered receipt (payer, payee, amount, method, date, remaining balance, signature — captured signature or scanned wet signature, no OTP verification event). Lawyer dashboard shows "owed to me" / "I owe"; owner dashboard shows firm-wide trust balances and aging receivables. Disbursement to a plaintiff can be blocked until source funds clear, configurable, with an audited override.

## 8. Hearings, deadlines & notifications

Per-case hearing records with postponement history; a unified lawyer calendar (hearings + mission deadlines + meetings) with conflict detection; secretary-driven meeting scheduling. Deadline-critical mission types (appeal windows, statute deadlines) auto-generate from verdict/hearing events using Palestinian legal-deadline templates, with an escalation notification ladder (e.g., 7d/3d/1d before an appeal deadline). Notifications are role-aware and routed in-app/SMS/WhatsApp; parties receive outbound messages only (no in-app inbox, no OTP).

## 9. Milestones (proposal)

Full bundle in one v1, per the scoping decision — **every milestone below ships in v1**; this is a build order within v1, not a v1-vs-later split. Money is sequenced early specifically because it's the highest-liability module, not because anything here is optional:

- **M1 — Foundation (multi-tenant core):** firm/tenant model, RBAC ladder, cases, parties, case-type taxonomy, document storage + search, audit log, soft-delete everywhere.
- **M2 — Money:** double-entry ledger, receipts, cash/check/installments, who-owes-whom dashboards. Built early, not last — it's the module with the least room for a wrong assumption.
- **M3 — Coordination:** hearings, calendar, secretary scheduling, missions, deadline auto-generation, notifications.
- **M4 — AI Assistant:** tool-calling agent wired to the modules above (needs them to exist first) — case/party lookup, scheduling, payment registration, mission creation, voice and text.
- **M5 — Polish & pilot readiness:** reports, PWA install + read-caching, first design-partner firm onboarding.

(Timeline TBD against the dedicated team's actual capacity — this milestone list is a build-order proposal, not a schedule.)

## 10. What changed from v0.2, and why

| v0.2 said | v0.3 says | Why |
|---|---|---|
| Multi-firm SaaS tenancy is a v1 **non-goal**; ship single-tenant | Multi-tenant is the **foundation**, day one | We're building a SaaS business, not a single firm's tool. Retrofitting tenant isolation after the fact is far more expensive and risky than building it in from the schema up — this is the whole point of the Backend Manifesto's tenant-isolation-as-invariant discipline. |
| Offline-first desktop app (SQLite + sync engine) + separate mobile PWA | One responsive web app (installable PWA), light read-caching only | The offline-sync engine was the source app's core feature because it was a single-firm offline tool. A SaaS product doesn't inherit that constraint just because the workflows came from an app that had it. Cuts a large, high-risk engineering investment the business doesn't need yet. |
| National ID + OTP verification as core infrastructure for every receipt/document | National ID as a plain disambiguation field; no OTP | Real problem (identical names), wrong-sized solution for v1: needs an SMS/WhatsApp provider, per-message cost, and compliance work before we have a single paying customer. Revisit if field usage shows real fraud/dispute pressure. |
| 16-section spec covering identity/OTP, full ledger, court integration, mobile app, compression/dedup, all as v1 requirements | Scoped to what a firm needs to leave paper behind: cases, documents, hearings/deadlines, money, RBAC | The workflows themselves were largely right — the draft's problem was treating everything the source app did as a requirement, with no prioritization pass. Good instinct to capture the full workflow; missing step was cutting it down to what v1 actually needs. |
| No AI capability mentioned | AI Assistant (text + voice, tool-calling) is a v1 module, §5.5 | Not in v0.2 because the source app didn't have it. It's in v1 here because it's a real differentiator against paper/Excel/WhatsApp and it's cheap to build well once the backend is real-time and typed (Convex) — the assistant is thin wrappers over functions that already have to exist. |

## 11. Open questions

- Exact per-seat price point and plan structure (single tier vs. seat bands), and how the AI-usage allotment (§5.5) bundles into it vs. metered top-ups.
- Which LLM provider(s) to route the assistant through, and per-firm cost/credit ceilings — this is the one part of the product with real, usage-driven marginal cost.
- **OCR engine for Arabic document text extraction** — quality here is a real technical risk (Arabic OCR is meaningfully harder than Latin-script OCR) and directly gates Documents' full-text search; needs an explicit evaluation, not a default pick.
- Which SMS/WhatsApp provider for outbound-only party notifications (no OTP, so requirements are lighter than v0.2 assumed).
- Does a Palestinian firm hold client money in a way that implies specific trust-accounting/reporting obligations we should model explicitly?
- Local payment gateway options for staff-mediated remote payment registration (once v1's manual-billing approach, §5.6, is later upgraded to self-serve).
- Which 1–2 design-partner firms to pilot with first, and what their specific case-type mix looks like (shapes which case-type taxonomy entries to prioritize).

## 12. Pre-pilot checklist (non-engineering)

Work that has to happen alongside M1–M5 but isn't code, so it doesn't get silently forgotten by only tracking engineering milestones:

- **Case-type taxonomy content** — the actual Palestinian court types, required-document checklists, and appeal-deadline rules that seed `caseTypes` (Implementation Plan §2) are legal-research content, not engineering. This needs an owner and a timeline alongside M1, not after it — Phase 0/M1 schema work can proceed in parallel, but M1 isn't truly done without real content in it.
- **Data handling / ToS agreement** with each design-partner firm, covering how their clients' data is handled — needed before any real client data enters the system, i.e., before M5's pilot onboarding, not after.
