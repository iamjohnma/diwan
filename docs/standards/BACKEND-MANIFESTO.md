# The Backend Manifesto

> A binding standard for building a calm, correct, multi-tenant, instantly-trustworthy backend — and for refusing the generic "AI-vibe" backend that leaks tenants, throws raw strings, scans whole tables, and crumbles the first time two clinics share a database. Reverse-engineered from a real production Convex backend (a hospital/clinic ERP) and written to be handed to a development team or pasted directly into an AI coding agent's context.

---

## Preamble — Read This First

This document is not a tutorial and not a style suggestion. It is the **operating constitution** for a backend. Every rule here was extracted from a shipping codebase that real clinics run their day on, where a leaked patient record is a catastrophe and a permission bug is a liability, not a screenshot. The goal is a backend that looks **hand-architected by a senior team that cares about correctness** — not **generated**.

A backend has no pixels to hide behind. Its quality is invisible until the moment it fails: when a receptionist at clinic A sees clinic B's patients, when a deleted invoice silently corrupts a ledger, when an external API call inside a mutation times out the whole transaction. This manifesto is the set of decisions that keep those moments from ever happening.

### How to use this with an AI agent

1. **Load it as context, not inspiration.** Paste this file (or link it) into your agent's working context — `CLAUDE.md`, `AGENTS.md`, a system prompt, or a pinned doc. Treat every "Rules" checklist as a hard constraint, not a guideline.
2. **Build the foundation before features.** Follow the build order in the final section (*The Agent Operating Protocol*): schema → errors → function-builder ladder → RBAC → model layer → features. Do not write a feature function against an unfinished auth context.
3. **Verify against the checklists.** Each section ends with a tight, imperative "Rules" list. Before a function or domain is "done," it must pass every applicable rule. The last section gives a single Definition of Done.
4. **When in doubt, choose the disciplined path.** A typed error code over a thrown string. A model function over an inline handler. An index over a `.collect().filter()`. A pre-validated `ctx.clinicId` over a client-supplied one. If a change makes a function shorter in one diff but less safe, less typed, or less tenant-isolated — reject it.

### The reference stack

The reference implementation is **self-hosted Convex** (the `ghcr.io/get-convex/convex-backend` image on Postgres), with **`@convex-dev/auth`** for authentication, **`convex-helpers`** custom functions for the context-builder ladder, **`convex/values` (`v.*`)** as the only validator vocabulary, **`@naab/shared`** (a Bun workspace package) as the single FE/BE contract, **AWS S3 + SES** (`@aws-sdk/*`) for storage and email, **`@google/genai` + OpenRouter** for AI, **`jose` / `lucia` / `@oslojs/*`** for auth crypto, **`xlsx`** for exports, and **Bun + Vitest + `convex-test`** for the toolchain. The *specific services are replaceable*; the **patterns, layering, and discipline are not**. Where this manifesto names a library, read it as "this role in your stack."

> If your stack differs, map each named tool to its equivalent. A different ORM still defines indexes for every access path; a different auth library still resolves identity exactly once at the function boundary; a different runtime still isolates external I/O from the transactional write.

### The database is the reference, not the requirement

This manifesto shows the data layer with **Convex** (the reference's reactive backend). **Convex is the reference, not a requirement.** Wherever you see a `query`/`mutation`/`action` split, `customQuery`/`customMutation`, `ctx.db.query(...).withIndex(...)`, `v.*` validators, `Doc<>`/`Id<>`, or `internalMutation`, read it as *the Convex instantiation of a backend-agnostic pattern* and translate it to your stack:

| You see (the reference) | Read it as |
|---|---|
| `query` / `mutation` / `action` | "read transaction" / "write transaction" / "effectful task outside the transaction" |
| `customQuery`/`customMutation` builder ladder | "the middleware that resolves identity + tenant + permissions once per request" |
| `ctx.db.query('t').withIndex('by_clinic', …)` | "a tenant-scoped, index-backed query" — never a full scan filtered in app code |
| `v.object({...})` / `returns:` validator | "the wire schema for args and responses" — OpenAPI, a shared `zod` schema, or your framework's DTO validation |
| `Doc<'patients'>` / `Id<'patients'>` | "types generated from the schema" — codegen, not hand-written interfaces |
| `internalMutation` / `internalAction` | "a server-only function the client cannot call" |
| `AppError` + `ERROR_CODES` | "a typed, coded domain error that serializes cleanly to the client" |

What is **non-negotiable on every backend**: every request resolves identity, tenant, and permissions exactly once at the boundary and hands the function an immutable, pre-validated context; every tenant-scoped query is filtered by the tenant key *in the index*, never in application code; business logic lives in a model layer, not in request handlers; errors are typed codes, not strings; external I/O is isolated from the transactional write; deletes are soft; types are generated from one schema; and the deploy pipeline seeds authorization before the first permission check runs. The engine is the product; the database behind it is an implementation detail.

---

## Table of Contents

1. [Philosophy — The Anti-"AI-Vibe" Backend Doctrine](#1-philosophy--the-anti-ai-vibe-backend-doctrine)
2. [Project Architecture, Layering & Separation of Concerns](#2-project-architecture-layering--separation-of-concerns)
3. [The Function-Builder Ladder & Authentication Context](#3-the-function-builder-ladder--authentication-context)
4. [Multi-Tenancy & RBAC: Isolation as an Invariant](#4-multi-tenancy--rbac-isolation-as-an-invariant)
5. [Schema, Validators & the Typed Contract](#5-schema-validators--the-typed-contract)
6. [Errors & the Model Layer: Thin Functions, Fat Models](#6-errors--the-model-layer-thin-functions-fat-models)
7. [Actions, HTTP & External Integrations: The Side-Effect Boundary](#7-actions-http--external-integrations-the-side-effect-boundary)
8. [Internal Functions, Crons, Migrations & Data Lifecycle](#8-internal-functions-crons-migrations--data-lifecycle)
9. [Self-Hosted Convex: Deployment, Environment & Operational Discipline](#9-self-hosted-convex-deployment-environment--operational-discipline)
10. [Testing & the Quality Machine](#10-testing--the-quality-machine)
11. [The Agent Operating Protocol](#11-the-agent-operating-protocol)

---

## 1. Philosophy — The Anti-"AI-Vibe" Backend Doctrine

You are building a system of record for a clinic. A nurse will trust that the allergy on this screen is *this* patient's allergy and no one else's. A clinic owner will trust that the balance is real. The backend must earn that trust the way a ledger does: every write accounted for, every read scoped to exactly who may see it, every error meaningful, every deployment reproducible. The single greatest threat to that trust is the default shape of AI-generated backends — the "AI-vibe backend" — and your first job is to recognize it on sight and refuse to ship it.

### What "AI-vibe-coded" means on a backend — and why it is banned

The frontend "AI-vibe" is purple gradients and spinner-flash. The backend "AI-vibe" is worse because it is invisible until it hurts someone. It optimizes for a handler that returns the right JSON in a Postman screenshot and collapses the moment a second tenant, a concurrent write, or a real permission boundary shows up. Learn the tells and treat each as a defect:

- **Re-authenticating in every handler.** `const userId = await getAuthUserId(ctx); if (!userId) throw ...` copy-pasted into the top of forty functions, each subtly different. Auth is resolved once, at the boundary, or it drifts.
- **Trusting a client-supplied tenant id.** Accepting `clinicId` from arguments and querying with it directly. This is the single most dangerous backend bug there is: any client can ask for any tenant's data.
- **Business logic crammed into the request handler.** A 120-line `mutation` that validates, mutates five tables, recomputes a balance, and formats a response — untestable, unreusable, and impossible to reason about.
- **Raw `throw new Error('Patient not found')`.** A stringly-typed error the client cannot branch on, cannot translate, and cannot distinguish from a crash.
- **No indexes — `.collect()` then `.filter()` in JS.** Loading every row of a table into memory to find three. It works on the demo's twelve rows and dies on the customer's twelve thousand.
- **`v.any()` and untyped returns.** A function whose argument and response shapes are a mystery the client must reverse-engineer and will get wrong.
- **`fetch()` inside a mutation.** An external API call inside a database transaction — blocking the transaction on a third party, holding locks across the network, and timing out under load.
- **Hardcoded secrets.** An API key or AWS credential pasted into a source file, now in git history forever.
- **Hard deletes.** `ctx.db.delete(id)` on a financial or clinical record — no audit trail, no recovery, no way to answer "what happened to invoice #4012?".
- **Hand-written DTOs that duplicate the schema.** An `interface Patient {...}` typed by hand alongside the table definition, drifting the day someone renames a field.
- **Duplicated enums across the FE/BE boundary.** `PAYMENT_METHODS` defined once in the backend and again in the frontend, guaranteed to disagree eventually.
- **Client-callable seed/migration/admin functions.** A `seed` or `grantSuperAdmin` exposed as a public mutation — a privilege-escalation hole with a public URL.
- **Zero tests, or tests that grant every user implicit admin.** A test suite that never sets up a permission boundary will pass while authorization is completely broken.

These are banned not because they are ugly but because they are *unaccountable*. A backend that looks vibe-generated reads as a backend no one is responsible for — and in a clinical system, no one being responsible is the failure.

#### Anti-pattern (AI-vibe smell)

```ts
// NEVER — the AI-vibe handler: re-auth, client-trusted tenant, raw error,
// full scan, business logic inline, hard delete
export const deletePatient = mutation({
  args: { clinicId: v.string(), patientId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('not logged in');           // re-auth, raw error
    const all = await ctx.db.query('patients').collect();    // full table scan
    const patient = all.find((p) => p._id === args.patientId);
    if (!patient) throw new Error('Patient not found');      // raw error
    await ctx.db.delete(patient._id);                        // hard delete, no cascade
    return { ok: true };                                     // untyped
  }
});
```

```ts
// CORRECT — pre-validated tenant ctx, permission gate, delegate to model, coded errors
export const remove = clinicMutation({
  args: { patientId: v.id('patients') },
  handler: async (ctx, args) => {
    requireClinicPermission(ctx, PERMISSIONS.PATIENTS_DELETE);
    const patient = await requireAccessiblePatient(ctx, args.patientId); // tenant + access
    await softDeletePatientRecord(ctx, patient._id);                     // model owns cascade
    return { patientId: patient._id };
  }
});
```

### The counter-creed

Replace each tell with a deliberate, system-wide decision. This is what "hand-architected, not scaffolded" feels like on a backend.

**Resolve identity, tenant, and permissions exactly once.** A single ladder of function builders (`authedQuery` → `activeClinicQuery` → `clinicQuery`) loads the user, validates clinic membership, and assembles the permission set *before the handler runs*. Every handler receives an immutable `ctx` carrying `userId`, `clinicId`, `permissions`, `dentistId`, and role facts. No handler re-authenticates.

**Tenant isolation is a database-level guarantee, not application logic.** Every clinic-scoped table leads its indexes with `clinicId`, and every query filters `.eq('clinicId', ctx.clinicId)` *using the pre-validated context value*. The client never supplies the tenant id that scopes a query. Cross-tenant reads are not "unlikely" — they are *impossible*.

**Thin functions, fat models.** Request handlers validate input, check permission, delegate to a model function, and shape the response. All business logic — cascades, recomputation, ledger entries, aggregates — lives in `convex/model/<domain>/` as pure, testable functions that take a stripped `ctx`.

**Errors are typed codes.** Every domain error is `new AppError(ERROR_CODES.X)` — a coded `ConvexError` the client can branch on and translate. Raw `throw new Error('string')` survives only in internal/admin adapters where no client consumes the code.

**One schema is the source of truth.** `schema.ts` defines every table, validator, and index. Types (`Doc<>`, `Id<>`) are generated from it; shared enums live once in `@naab/shared` as `as const` arrays. No hand-written DTOs, no duplicated enums.

**Every access path is an index.** No query loads rows it will throw away. Composite indexes are ordered by selectivity (`clinicId` first, then `deletedAt`, then the sort key), and full-text search is a `searchIndex`, not a JS `.includes()`.

**External I/O is isolated from the transaction.** Mutations and queries touch only the database and return fast. Anything that calls S3, SES, an AI provider, or any network service is an `action` that does its I/O *outside* any transaction and then calls a mutation (`ctx.runMutation`) to persist the result.

**Deletes are soft.** Every deletable record carries `deletedAt?: number`; reads filter it out (via the index); cascades and recomputation are explicit model functions. Hard deletes are reserved for genuinely transient join rows.

**Authorization is seeded before it is checked, and deployments are reproducible.** The deploy pipeline is `deploy → seed RBAC → migrate`, in that order, every time. Env is synced by script to a filtered allowlist, never hand-wired. The whole stack runs self-hosted from `docker-compose` with health-gated startup.

#### Anti-pattern (AI-vibe smell)

```ts
// NEVER — external call inside a mutation, secret inline, untyped throw
export const sendInvite = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const ses = new SESv2Client({ region: 'us-east-1',
      credentials: { accessKeyId: 'AKIA...', secretAccessKey: 'hunter2' } }); // secret in code
    await ses.send(new SendEmailCommand({ /* ... */ }));    // network I/O inside the txn
  }
});
```

```ts
// CORRECT — mutation enqueues; an internalAction does the I/O outside the transaction
await ctx.scheduler.runAfter(0, internal.internal.email.sendClinicInvitationEmail, {
  to: args.email, inviterName, clinicName, clinicId
});
// ses.ts reads creds from env via requireEnv(); throws AppError(ERROR_CODES.EMAIL_DELIVERY_FAILED)
```

### The Commandments

1. **Resolve auth once, at the boundary.** Use the function-builder ladder; never call `getAuthUserId` inside a handler that a builder already authenticated.
2. **Never trust a client-supplied tenant id.** `ctx.clinicId` comes from validated membership; queries scope to it, not to an argument.
3. **Tenant key leads every index.** Every clinic-scoped query is `.withIndex('by_clinic…', q => q.eq('clinicId', ctx.clinicId))`. No cross-tenant scan is possible.
4. **Permission-gate at the first line.** The handler's first statement after loading context is `requireClinicPermission(ctx, PERMISSIONS.X)`.
5. **Thin functions, fat models.** Handlers delegate; business logic lives in `convex/model/<domain>/`.
6. **Errors are coded.** `throw new AppError(ERROR_CODES.X)` — never a raw string a client can't branch on.
7. **The schema is the source of truth.** Types are generated (`Doc<>`/`Id<>`); enums live once in `@naab/shared`. No hand-written DTOs.
8. **Every read is index-backed.** No `.collect()`-then-`.filter()`; no full table scans; search uses a `searchIndex`.
9. **Validate args and returns.** Every function declares `v.*` arg validators and a `returns:` validator. No `v.any()`.
10. **Isolate side-effects.** Network/external I/O lives in `action`s and persists via `ctx.runMutation`. Never `fetch` inside a mutation.
11. **Soft-delete everything clinical or financial.** `deletedAt` + index + explicit cascade. Hard delete only transient joins.
12. **Internal means internal.** Seed, migration, and admin functions are `internalMutation`/`internalAction`, never client-callable.
13. **Secrets come from env, read through a typed config function.** Never a credential in source.
14. **Seed authorization before checking it.** `deploy → rbac:seed → migrate`, idempotent, every time.
15. **If a value is unaccountable, it is wrong.** Every error code, every index, every permission string, every env key is a named decision — never a default left in place.

### Rules

- Reject any handler that re-runs `getAuthUserId`, accepts a `clinicId` argument it then trusts, throws a raw `Error` for a domain condition, or scans a table with `.collect()` before filtering.
- Route every client-facing function through a context builder (`authed*`/`activeClinic*`/`clinic*`); never a bare `query`/`mutation` for authenticated, tenant-scoped work.
- Put business logic in `convex/model/<domain>/`; keep handlers to validate → permit → delegate → shape.
- Use `AppError(ERROR_CODES.X)` for every domain error; reserve raw `throw new Error` for internal adapters with no client consumer.
- Declare `v.*` arg validators and a `returns:` validator on every function; ban `v.any()`.
- Back every query with an index whose first field is the tenant key; never filter the tenant in app code.
- Do all external I/O in `action`s; persist via `ctx.runMutation`; never call a network service inside a mutation/query.
- Soft-delete with `deletedAt` and an index that includes it; make cascades explicit model functions.
- Keep seed/migration/admin code in `internal*` functions; never expose them to the client.
- Read every secret from `process.env` through a typed config function that throws a coded error when missing.

---

## 2. Project Architecture, Layering & Separation of Concerns

The directory layout IS the architecture. A Convex backend is a flat folder of function modules by default; left to its defaults it becomes forty files where auth, business logic, and database access are tangled in every handler. The reference imposes three crisp layers — **the function surface**, **the model**, and **the shared primitives** — plus a quarantined **internal** zone for server-only code. When you are done, a new engineer must be able to predict where any piece of logic lives before opening the tree, and "where does this rule belong?" must have exactly one answer.

### The four zones

```
convex/
  <entity>.ts          // THE FUNCTION SURFACE — thin, client-callable query/mutation/action
  functions.ts         // the custom function-builder ladder (auth + tenant + permissions)
  schema.ts            // the single source of truth for tables, validators, indexes
  http.ts  crons.ts    // HTTP routes; scheduled jobs
  auth.ts  auth.config.ts

  model/<domain>/      // FAT MODELS — all business logic, cascades, recompute
    authz/  billing/  clinical/  cascade/  inventory/  warmup/  auth/  bugReports/

  lib/                 // SHARED PRIMITIVES — errors, rbac constants, validators, email, s3
    errors.ts  validators.ts  clinical.ts  rbac/  email/  s3.ts

  internal/            // SERVER-ONLY — seed, migrations, action-context, email senders
    rbac.ts  migrations.ts  exports.ts  actionContext.ts  email.ts

  _generated/          // codegen output — NEVER hand-edited
```

- **The function surface** (`convex/<entity>.ts`) is the public API: thin, client-callable functions that validate, permit, delegate, and shape. A function here should read in one screen.
- **The model** (`convex/model/<domain>/`) owns every business rule. Model functions take a stripped context (`Pick<MutationCtx, 'db'>` plus whatever scope they need) so they are unit-testable and reusable across handlers.
- **The shared primitives** (`convex/lib/`) are the cross-cutting kit: the `AppError` class and `ERROR_CODES`, the RBAC constant catalog, validator helpers, the SES and S3 clients.
- **The internal zone** (`convex/internal/`) is everything the client must never call: RBAC seeding, data migrations, the action-context permission resolvers, the email senders invoked by the scheduler.

This split recurs by domain, so learning it once teaches it everywhere: `model/billing/` owns invoices/ledger/refunds; `model/authz/` owns permissions/roles/member-context; `model/cascade/` owns delete orchestration; `model/clinical/` owns record loaders. Never put a business rule in a handler "just this once," and never reach into `_generated/` by hand.

**Anti-pattern (AI-vibe smell):** one mega-file per entity where the `mutation` handler does authentication, tenant filtering, validation, five table writes, balance recomputation, and response formatting inline. You can never test the balance logic without standing up an authenticated request, and you can never reuse it from a cascade. Always split surface from model.

### The thin-function / fat-model contract

A function on the surface delegates immediately. The reference's `create` handlers are often a single line:

```ts
// convex/patients.ts — thin wrapper
export const create = clinicMutation({
  args: createPatientArgs,
  handler: async (ctx, args) => {
    return await createPatientRecord(ctx, args);   // delegate to the model
  }
});
```

The model function (`convex/model/...`) owns the real work — and orchestrating *sequential* model calls is itself the handler's only job when an operation spans concerns:

```ts
// convex/invoices.ts — orchestration only; each step is a model function
export const remove = clinicMutation({
  args: { invoiceId: v.id('invoices'),
          transferPaidAmountToBalance: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const invoice = await requireInvoice(ctx, ctx.clinicId, args.invoiceId); // load + tenant
    requireDentistScopedAccess(ctx, invoice.dentistId,
      PERMISSIONS.MY_INVOICES_DELETE, PERMISSIONS.OTHER_INVOICES_DELETE);     // authz
    await softDeleteInvoice(ctx, invoice._id);                                // model: delete
    await recomputeInvoice(ctx, ctx.clinicId, invoice._id, ctx.userId);       // model: cascade
    await recomputePatient(ctx, ctx.clinicId, invoice.patientId);             // model: aggregate
    return { invoiceId: invoice._id };
  }
});
```

The pattern is always **load + guard → delegate → orchestrate cascades → return a DTO**. The handler is a coordinator; the model is the brain.

### Model functions take a stripped context

Model functions never receive the full authenticated `ctx`. They take exactly the capability they need — usually `Pick<MutationCtx, 'db'>` (aliased `WriteCtx`/`ReadCtx`) plus explicit scope arguments. This is what makes them unit-testable without a request and safe to call from a cascade:

```ts
// convex/model/billing/ledger.ts — pure, scoped, testable
export async function appendLedgerEntry(
  ctx: WriteCtx,
  clinicId: Id<'clinics'>,
  patientId: Id<'patients'>,
  amount: number,
  type: 'payment_credit' | 'refund_credit' | 'manual_adjustment',
  refType: string, refId: string, createdBy?: Id<'users'>,
) { /* validates balance, inserts immutable ledger row, patches denormalized balance */ }
```

Passing scope explicitly (rather than reading it off an ambient `ctx`) is what lets `appendLedgerEntry` be called identically from a payment handler, a refund cascade, and a test.

### File naming and the generated zone

Name entity and model files in `camelCase` matching their domain (`treatmentPlans.ts`, `clinicMembers.ts`, `memberContext.ts`) — Convex derives the API path from the filename, so the name *is* the contract (`api.treatmentPlans.list`). Treat `convex/_generated/` as read-only output of `codegen`; never edit it, never deep-import around it. Internal-zone files are addressed through the `internal.*` reference (`internal.rbac.seed`, `internal.internal.exports.processExportJob`), never imported across the surface/internal boundary by relative path in a way that would make them client-reachable.

**Anti-pattern (AI-vibe smell):** a `utils.ts` grab-bag at the root that mixes a date formatter, a permission check, an S3 helper, and a balance calculation. Every cross-cutting primitive has a home under `lib/` (shared kit) or `model/` (domain logic); there is no junk drawer.

### Rules

- Keep `convex/<entity>.ts` functions thin: validate → permit → delegate → shape. If a handler exceeds a screen, push logic into `model/`.
- Put every business rule, cascade, and recomputation in `convex/model/<domain>/`; group by domain (`billing`, `authz`, `cascade`, `clinical`, `inventory`).
- Give model functions a stripped context (`Pick<…Ctx, 'db'>` + explicit scope args); never pass the full authenticated `ctx` into the model.
- Keep shared primitives (errors, rbac constants, validators, email, s3) under `lib/`; never a root `utils.ts` junk drawer.
- Keep seed/migration/admin/action-context code under `internal/` as `internal*` functions; address them via `internal.*`.
- Never hand-edit or relative-deep-import `_generated/`; consume it through the codegen-provided `api`/`internal` references and `Doc<>`/`Id<>` types.
- Name files to match the API path you want; the filename is the public contract.

---

## 3. The Function-Builder Ladder & Authentication Context

This is the spine of the backend. Every client-callable, authenticated function is built from a **custom function builder** that resolves identity, tenant, and permissions *before* the handler runs and injects an immutable, pre-validated `ctx`. Build this ladder first; every feature is a leaf on it. Get it right once and no handler ever re-authenticates, re-checks membership, or re-loads permissions — because the context is already there, already correct.

### The ladder: progressive context enrichment

The reference defines six builders in `convex/functions.ts`, layered from least to most context, using `convex-helpers`' `customQuery`/`customMutation`:

```
query / mutation                       (Convex base)
  └─ authedQuery / authedMutation       → +userId, +currentUser
       └─ activeClinicQuery/Mutation    → +clinicId (from user.activeClinicId), +member context
       └─ clinicQuery / clinicMutation  → +clinicId (arg OR active), +member context
```

Each layer validates exactly one concern and fails fast with a coded error. `authedMutation` loads and verifies the user:

```ts
// convex/functions.ts — the base of the ladder
export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const authed = await loadAuthenticatedUser(ctx);   // userId + currentUser, or throw
    return { ctx: authed, args: {} };
  }
});
```

`loadAuthenticatedUser` is the one place authentication happens. It extracts the user id, confirms the user document exists and is not archived, applies any temporary super-admin bootstrap, and folds in session-based impersonation:

```ts
// convex/functions.ts:25 — authentication resolved exactly once
async function loadAuthenticatedUser(ctx: AuthableCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
  const currentUser = await ctx.db.get(userId);
  if (!currentUser) throw new AppError(ERROR_CODES.UNAUTHENTICATED);
  if (currentUser.archivedAt !== undefined) throw new AppError(ERROR_CODES.UNAUTHENTICATED);

  const liftedUser = applyTemporarySuperAdminBootstrap(currentUser);
  const sessionId = await getAuthSessionId(ctx);
  const session = sessionId ? await ctx.db.get(sessionId) : null;
  const impersonatedActiveClinicId = session?.impersonatedActiveClinicId;
  if (impersonatedActiveClinicId) {
    return { userId, currentUser: { ...liftedUser, activeClinicId: impersonatedActiveClinicId } };
  }
  return { userId, currentUser: liftedUser };
}
```

### `activeClinic*` vs `clinic*`: two ways to bind a tenant

The two clinic-scoped builders differ in exactly one way — where the clinic id comes from:

- **`activeClinic*`** forces the user's `activeClinicId`. Use it for "the current clinic context" operations (dashboards, the active workspace) where any other clinic is meaningless.
- **`clinic*`** accepts an optional `clinicId` argument and falls back to `activeClinicId`. Use it for operations that may legitimately target a specific clinic the user belongs to (multi-clinic admin views).

```ts
// convex/functions.ts:80 — clinic* resolves arg-or-active, then validates membership
async function loadClinicMembership(ctx: AuthableCtx, clinicId: Id<'clinics'> | undefined) {
  const authed = await loadAuthenticatedUser(ctx);
  const resolvedClinicId = clinicId ?? authed.currentUser.activeClinicId;
  if (!resolvedClinicId) throw new AppError(ERROR_CODES.CLINIC_NOT_FOUND);
  const memberCtx = await loadMemberContext(ctx, authed.userId, resolvedClinicId);
  if (!memberCtx) throw new AppError(ERROR_CODES.NOT_A_CLINIC_MEMBER);
  return { authed, clinicId: resolvedClinicId, memberCtx };
}
```

The crucial discipline: even when `clinic*` accepts a `clinicId` argument, that id is **validated against membership** before anything reads with it. The client cannot pass a clinic it does not belong to — `loadMemberContext` returns `null` and the request dies with `NOT_A_CLINIC_MEMBER`. A trusted tenant id is one that survived a membership check, never one that arrived in the args.

### What the handler receives

After the builder runs, every clinic-scoped handler's `ctx` carries a complete, immutable identity:

```ts
// convex/functions.ts:122 — activeClinicQuery composes authed + clinic + memberCtx
export const activeClinicQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const authed = await loadAuthenticatedUser(ctx);
    const activeClinic = await loadActiveClinicMembership(ctx, authed.userId, authed.currentUser);
    return {
      ctx: { ...authed, clinicId: activeClinic.clinicId, ...activeClinic.memberCtx },
      args: {}
    };
  }
});
```

`ctx` now has: `userId`, `currentUser`, `clinicId`, `memberId`, `roleId`, `roleName`, `isOwner`, `permissions` (a `ReadonlySet<string>`), `dentistId`, `dentistColor`, and `commissionRate`. The handler reads these as facts. It never re-derives them.

### The permission gate is one line

Authorization is a single helper, called as the handler's first statement:

```ts
// convex/functions.ts:197
export function requireClinicPermission(
  ctx: { permissions: ReadonlySet<string> },
  permission: PermissionString,
): void {
  requirePermission(ctx.permissions, permission);
}

// convex/clinicMembers.ts — used at the top of the handler
export const list = clinicQuery({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    requireClinicPermission(ctx, PERMISSIONS.STAFF_READ);   // fail fast, coded error
    /* ... scoped queries using ctx.clinicId ... */
  }
});
```

For resource-level rules (own-vs-others), the model exposes scoped helpers — `requireDentistScopedAccess(ctx, resourceDentistId, ownPerm, otherPerm)` and `requireAccessiblePatient(ctx, patientId)` — so no handler hand-rolls an access decision. (See §4.)

**Anti-pattern (AI-vibe smell):** a handler that opens with `const userId = await getAuthUserId(ctx)`, fetches the member row itself, and `if (member.role === 'admin')` checks a role string inline. That is the ladder's job, done worse and inconsistently. Build on the builder; gate with the constant.

### Rules

- Build every authenticated, client-callable function from a context builder (`authed*`/`activeClinic*`/`clinic*`); never a bare `query`/`mutation`.
- Resolve authentication exactly once, in `loadAuthenticatedUser`; never call `getAuthUserId` inside a builder-backed handler.
- Choose `activeClinic*` when only the current clinic is valid; choose `clinic*` when a specific membership-checked clinic may be targeted.
- Treat a `clinicId` argument as untrusted until `loadMemberContext` validates membership; never query with an unvalidated tenant id.
- Read identity/tenant/role facts off `ctx` (`ctx.userId`, `ctx.clinicId`, `ctx.permissions`, `ctx.dentistId`); never re-derive them in a handler.
- Gate with `requireClinicPermission(ctx, PERMISSIONS.X)` as the first statement; use `requireDentistScopedAccess` / `requireAccessiblePatient` for resource-level rules.
- Fail fast with coded errors (`UNAUTHENTICATED`, `CLINIC_NOT_FOUND`, `NOT_A_CLINIC_MEMBER`, `INSUFFICIENT_PERMISSIONS`).

---

## 4. Multi-Tenancy & RBAC: Isolation as an Invariant

A clinic is the isolation boundary, and the entire backend is built so that one clinic can never, under any code path, see another's data. This is not enforced by careful coding in each handler — careful coding fails. It is enforced structurally: the tenant id is always the pre-validated `ctx.clinicId`, every index leads with it, and permissions are resolved from roles plus overrides at the context boundary. Treat tenant isolation as an invariant the architecture *cannot* violate, not a check you remember to write.

### Clinic scoping is a database-level guarantee

Every clinic-scoped query filters on `ctx.clinicId` — the value validated by the function builder — *inside the index*, never in application code:

```ts
// convex/clinicMembers.ts:334 — tenant scope lives in the index range
const members = await ctx.db
  .query('clinicMembers')
  .withIndex('by_clinic', (q) => q.eq('clinicId', ctx.clinicId))
  .collect();

// convex/invoices.ts:100 — search index also pins clinicId + soft-delete
const invoices = await ctx.db
  .query('invoices')
  .withSearchIndex('search_text', (q) =>
    q.search('searchText', searchTerm)
     .eq('clinicId', ctx.clinicId)
     .eq('deletedAt', undefined))
  .collect();
```

Because the scope comes from `ctx` (not args) and lives in the index predicate (not a post-fetch `.filter`), there is no path by which a query returns another clinic's rows, and no large scan to filter down.

**Anti-pattern (AI-vibe smell):** `const all = await ctx.db.query('invoices').collect(); return all.filter(i => i.clinicId === args.clinicId)`. This trusts a client id, scans every tenant's data into memory, and is one forgotten `.filter` away from a breach. The tenant key must be in the index, sourced from validated context.

### A second tenant axis: dentist scoping

Within a clinic, staff may be limited to their own patients/invoices. This is a second scope dimension, resolved the same way — from immutable context (`ctx.dentistId`), pushed into the index:

```ts
// convex/invoices.ts:118 — dentist scope is also an index predicate, from ctx
if (ctx.dentistId === null) return [];
const invoices = await ctx.db
  .query('invoices')
  .withSearchIndex('search_text', (q) =>
    q.search('searchText', searchTerm)
     .eq('clinicId', ctx.clinicId)
     .eq('deletedAt', undefined)
     .eq('dentistId', ctx.dentistId!))
  .collect();
```

The own-vs-others decision itself is centralized, never hand-rolled per handler:

```ts
// convex/model/authz/owned.ts:51 — three-way scope: owner wildcard > others-perm > own-perm
export function requireDentistScopedAccess(
  ctx: ScopedCtx, resourceDentistId: Id<'dentists'>,
  ownPermission: string, otherPermission: string,
): void {
  if (ctx.permissions.has(RBAC.OWNER_WILDCARD) || ctx.permissions.has(otherPermission)) return;
  if (ctx.dentistId !== null && ctx.dentistId === resourceDentistId
      && ctx.permissions.has(ownPermission)) return;
  throw new AppError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
}
```

Patient visibility for a dentist is computed from real relationships (created-by, assigned dentist, or having a visit/treatment-plan) and centralized in `requireAccessiblePatient` — handlers call the helper, never reimplement the rule.

### The permission set is resolved once, from roles + overrides

`loadMemberContext` (called by the clinic builders) assembles the permission set before any handler runs. Owners get a wildcard; everyone else gets role permissions adjusted by per-member grant/revoke overrides:

```ts
// convex/model/authz/memberContext.ts:47
export async function loadMemberContext(ctx, userId, clinicId) {
  const member = await loadMember(ctx, userId, clinicId);
  if (!member || !isActiveMember(member)) return null;          // pending invites get nothing
  const [role, dentist] = await Promise.all([
    ctx.db.get(member.roleId), findDentistByMember(ctx, member._id),
  ]);
  const roleName = role?.name ?? SYSTEM_ROLES.PATIENT;
  const isOwner = roleName === SYSTEM_ROLES.OWNER;

  let permissions: Set<string>;
  if (isOwner) {
    permissions = new Set([RBAC.OWNER_WILDCARD]);                // owner = '*'
  } else {
    permissions = new Set(await listRolePermissionNames(ctx, member.roleId));
    for (const override of await listMemberOverrides(ctx, member._id)) {
      if (override.effect === 'grant') permissions.add(override.name);
      else permissions.delete(override.name);                    // per-member revoke
    }
  }
  return { memberId: member._id, roleId: member.roleId, roleName, isOwner,
           permissions, dentistId: dentist?._id ?? null, /* ... */ };
}
```

Resolving permissions once at the boundary (not per-check in each handler) means no N+1 permission lookups, and a member's permissions are a consistent snapshot for the whole request.

### Permission strings are typed constants from a shared catalog

Permissions are never string literals. They are typed constants re-exported from `@naab/shared/rbac`:

```ts
// convex/lib/rbac/constants.ts
export {
  ACTIONS, PERMISSIONS, RBAC, RESOURCES, SYSTEM_ROLES,
  type Action, type PermissionKey, type PermissionString, type Resource, type SystemRole,
} from '@naab/shared/rbac';
```

A typo in `PERMISSIONS.PATIENTS_RAED` is a compile error, not a silent authorization hole. The same catalog drives the frontend, so a permission the UI hides is exactly the permission the backend denies.

### RBAC is seeded idempotently, and owner roles are locked

System roles and the permission catalog are seeded at deploy time via an idempotent upsert (see §8), so a fresh database and a schema upgrade both converge to the same authorization state without manual SQL. And destructive role operations are guarded — the owner role can never be reassigned, and changing a member's role clears their stale permission overrides:

```ts
// convex/clinicMembers.ts:389 — guard the owner role; clear overrides on role change
if (currentRole?.name === SYSTEM_ROLES.OWNER) throw new AppError(ERROR_CODES.OWNER_ROLE_LOCKED);
if (nextRole.name === SYSTEM_ROLES.OWNER) throw new AppError(ERROR_CODES.OWNER_ROLE_LOCKED);
if (member.roleId !== nextRole._id) {
  await ctx.db.patch(member._id, { roleId: nextRole._id });
  await clearMemberPermissionOverrides(ctx, member._id);   // prevent stale escalation
}
```

### Impersonation is session-scoped, not user-scoped

Support/debugging uses impersonation that lives on the *session*, not the user. An admin sets `session.impersonatedActiveClinicId`; `loadAuthenticatedUser` folds it into the effective `activeClinicId` for the life of that session and nothing more:

```ts
// convex/functions.ts:43 — impersonation overrides the active clinic for this session only
const impersonatedActiveClinicId = session?.impersonatedActiveClinicId;
if (impersonatedActiveClinicId) {
  return { userId, currentUser: { ...liftedUser, activeClinicId: impersonatedActiveClinicId } };
}
```

This gives "show me what this clinic's staff sees" without granting the admin super-permissions and without mutating the impersonated user — it evaporates when the session ends.

### Rules

- Scope every clinic query with `.eq('clinicId', ctx.clinicId)` *in the index*, sourcing the id from validated context; never from args, never as a post-fetch `.filter`.
- Lead every clinic-scoped table's indexes with `clinicId`; add `deletedAt` and the sort/filter key in selectivity order.
- Resolve the permission set once in `loadMemberContext` (role permissions + per-member grant/revoke overrides); never load permissions per check.
- Centralize resource-level access in helpers (`requireDentistScopedAccess`, `requireAccessiblePatient`); never reimplement own-vs-others or patient-visibility inline.
- Reference permissions only via `PERMISSIONS.X` typed constants from `@naab/shared/rbac`; never a string literal.
- Seed RBAC idempotently before any permission check runs; guard system roles (owner is locked) and clear member overrides when a role changes.
- Implement impersonation on the session (`impersonatedActiveClinicId`), never by elevating the user; never grant blanket super-permissions for support.

---

## 5. Schema, Validators & the Typed Contract

`schema.ts` is the single source of truth, and everything downstream is generated or derived from it. The validator vocabulary is **Convex `v.*` only** — Zod is present in the dependency tree but unused in the backend, because the schema validators already double as the code-gen source for types and the optimizer's index hints. Shared enums live exactly once, in `@naab/shared`, as `as const` arrays. Build the schema with index and validator discipline and the type safety is automatic and end-to-end; skip it and you get the untyped-handler, full-scan, drifting-DTO backend that fails silently at scale.

### Tables are defined with validators, indexes, and soft-delete from the start

Every table is a `defineTable` with precise `v.*` validators, the tenant key, a `deletedAt` soft-delete marker, and an index for every access path:

```ts
// convex/schema.ts:415 — patients: tenant key, materialized aggregates, soft-delete, indexes
patients: defineTable({
  clinicId: v.id('clinics'),
  familyId: v.optional(v.id('families')),
  fullName: v.string(),
  balance: v.number(),
  totalInvoiced: v.number(), totalPaid: v.number(), totalUnpaid: v.number(),
  visitCount: v.number(), lastVisitAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),                 // soft-delete marker
  createdAt: v.number(), updatedAt: v.number(),
})
  .index('by_clinic', ['clinicId'])
  .index('by_clinic_created_at', ['clinicId', 'createdAt'])
  .index('by_clinic_deleted_created_at', ['clinicId', 'deletedAt', 'createdAt'])
  .index('by_clinic_deleted_full_name', ['clinicId', 'deletedAt', 'fullName'])
  .searchIndex('search_text', { searchField: 'searchText',
    filterFields: ['clinicId', 'deletedAt'] }),
```

Three disciplines are visible at once: `clinicId` leads every index (tenant isolation), `deletedAt` is woven into the composite indexes (so "active records only" is an index range, not a scan), and aggregate fields (`balance`, `visitCount`) are *materialized* on the row and maintained transactionally by the model — fast reads without a join.

### Indexes encode every query, ordered by selectivity

An index exists for each real access path, and composite indexes are ordered most-selective-first so the database can range-scan precisely what a query needs:

```ts
// convex/schema.ts:571 — visits: a distinct index per access pattern
.index('by_clinic', ['clinicId'])
.index('by_clinic_deleted_status_scheduled_at',
       ['clinicId', 'deletedAt', 'status', 'scheduledAt'])  // "this clinic's completed visits this week"
.index('by_dentist_scheduled_at', ['dentistId', 'scheduledAt'])  // "a dentist's schedule"
.index('by_patient_status_scheduled_at', ['patientId', 'status', 'scheduledAt'])
```

```ts
// convex/patients.ts:286 — queries name the index; no scans
const members = await ctx.db.query('patients')
  .withIndex('by_family', (q) => q.eq('familyId', familyId))
  .collect();
```

**Anti-pattern (AI-vibe smell):** defining tables with only the implicit `_id` index and then `.collect()`-ing whole tables to `.filter()` in JavaScript. It is invisible on seed data and a production outage at scale. Every access path is an index; every list query names one.

### Validators are built from shared constants via `literalUnion`

Enum validators are not hand-typed unions that can drift from the frontend. They are generated from the shared `as const` catalogs through a `literalUnion` helper:

```ts
// convex/lib/clinical.ts — validators built from the shared source of truth
import { PATIENT_GENDERS, VISIT_STATUSES, PAYMENT_METHODS } from '@naab/shared/clinical';
import { literalUnion } from './validators';

export const patientGenderValidator = literalUnion(PATIENT_GENDERS);
export const visitStatusValidator   = literalUnion(VISIT_STATUSES);
export const paymentMethodValidator = literalUnion(PAYMENT_METHODS);
```

```ts
// convex/lib/validators.ts:10 — const array -> v.union(v.literal(...), ...)
export function literalUnion<const TValues extends readonly [LiteralValue, ...LiteralValue[]]>(
  values: TValues,
): Validator<TValues[number], 'required', never> {
  const literals = values.map((value) => v.literal(value)) as /* ... */;
  return v.union(...literals) as Validator<TValues[number], 'required', never>;
}
```

High-reuse validators live in `lib/`; one-off shapes are inline `v.object({...})` at the table. Either way, the value `'male'` or `'cash'` is written exactly once in the codebase.

### `@naab/shared` is the one FE/BE contract

The shared workspace package owns every enum, domain constant, and piece of domain logic used by both ends — exported per domain, with types derived from the constants:

```ts
// packages/shared/src/clinical.ts — define the enum once; derive the type
export const VISIT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'credit'] as const;
```

Even domain logic that both ends must agree on — tooth numbering, jaw placement, trial-day defaults — lives here, so the frontend's `<Select options={PAYMENT_METHODS}>` and the backend's `paymentMethodValidator` can never disagree.

**Anti-pattern (AI-vibe smell):** the backend defines `PAYMENT_METHODS` and the frontend redefines the same list; or the backend ships branded types only and the frontend casts to `any`. The enum lives once, in `@naab/shared`, and both ends import it.

### Functions validate args AND returns

Every function declares argument validators and a `returns:` validator. The `returns:` validator is the wire contract the client can trust, and it must match the handler's TypeScript return:

```ts
// convex/adminPasswordLink.ts:12 — args and returns both validated
export const linkPasswordAccountByEmail = internalAction({
  args: { email: v.string(), password: v.string() },
  returns: v.object({ userId: v.id('users'), created: v.boolean(), updated: v.boolean() }),
  handler: async (ctx, args): Promise<{ userId: Id<'users'>; created: boolean; updated: boolean }> => {
    /* ... */
    return { userId: created.user._id, created: true, updated: false };
  }
});
```

`v.null()` is the explicit return for fire-and-forget mutations/actions. `v.any()` is banned — it discards the entire wire contract.

### Types are generated; ids are branded

The schema generates `Doc<'table'>` and `Id<'table'>` in `_generated/`. `Id<'patients'>` is a distinct type from `Id<'dentists'>` at compile time, so passing a dentist id where a patient id is expected does not compile. Context objects are generic over these branded ids, which is what makes a clinic-mixing bug a type error:

```ts
// convex/patients.ts:58 — context typed with branded ids
export interface PatientAccessReadCtx extends PatientReadCtx {
  clinicId: Id<'clinics'>;
  userId: Id<'users'>;
  permissions: ReadonlySet<string>;
  dentistId: Id<'dentists'> | null;
}
```

Stored data is `Doc<'patients'>`; client-facing DTOs are *computed* read models (formatting timestamps to ISO, joining allergies, clamping `availableBalance`), never the stored row dumped raw and never a second stored copy.

**Anti-pattern (AI-vibe smell):** `type Patient = { id: string; ... }` hand-written next to the schema, plus storing ids as `string`. The hand-written type drifts the day a field is renamed and nothing catches it; raw `string` ids let a clinic id flow into a patient slot silently. Generate the types; brand the ids.

### Strict TypeScript is the first checker

`tsconfig.json` runs strict, and `tsc --noEmit` is the build (§10). The flags that matter most for a data backend:

```jsonc
// tsconfig.json
"strict": true,
"noUncheckedIndexedAccess": true,   // obj[key] is T | undefined — no silent undefined
"noImplicitOverride": true,
"verbatimModuleSyntax": true,       // import type stays erasable
"allowImportingTsExtensions": true  // import @naab/shared .ts sources directly
```

### Rules

- Define every table in `schema.ts` with precise `v.*` validators, the tenant key, and `deletedAt`; never `v.any()`.
- Create an index for every access path; lead clinic tables with `clinicId`, include `deletedAt`, order composites by selectivity; use `searchIndex` for text search.
- Build enum validators with `literalUnion` from the `@naab/shared` `as const` catalogs; write each enum value exactly once.
- Keep all shared enums, domain constants, and cross-end domain logic in `@naab/shared`; import them on both ends. Never duplicate an enum across FE/BE.
- Declare a `returns:` validator on every function, matching the handler's type; use `v.null()` for no-result; never `v.any()`.
- Use generated `Doc<>`/`Id<>` types and branded ids everywhere; never hand-write DTO interfaces or store ids as `string`.
- Compute client DTOs as read models; never store the DTO or return a raw stored row.
- Keep `strict: true` and `noUncheckedIndexedAccess: true`; let `tsc --noEmit` gate the build.

---

## 6. Errors & the Model Layer: Thin Functions, Fat Models

Two disciplines make the backend reasoning-friendly: errors are typed codes the client can act on, and business logic lives in a model layer that is testable in isolation. Together they mean a handler reads like a table of contents — load, permit, delegate — and the substance lives in pure functions you can call from a test, a cascade, or a migration with equal ease.

### `AppError` + `ERROR_CODES`: every domain failure is coded

Domain errors are a single class extending `ConvexError`, carrying a code that serializes cleanly to the client:

```ts
// convex/lib/errors.ts
export class AppError extends ConvexError<AppErrorData> {
  constructor(code: ErrorCode) { super({ code }); this.name = 'AppError'; }
  get code(): ErrorCode { return this.data.code; }
}
export function isAppError(error: unknown): error is AppError {
  return error instanceof ConvexError && readErrorCode(error) !== null;
}
```

Every business rule throws a code, never a string:

```ts
// convex/model/billing/ledger.ts:40
if (nextBalance < 0 && type !== 'manual_adjustment')
  throw new AppError(ERROR_CODES.BALANCE_WOULD_GO_NEGATIVE);
// convex/model/clinical/records.ts:33
if (!patient || !matchesClinic(patient, clinicId))
  throw new AppError(ERROR_CODES.PATIENT_NOT_FOUND);
```

The reference has ~97 `throw new AppError` against fewer than 15 raw `throw new Error` — and those survive only in internal/external adapters (e.g. a Notion sync) where no client branches on the code. The client can branch on `error.code`, the UI can translate it, and "not found" is forever distinguishable from "crashed."

**Anti-pattern (AI-vibe smell):** `throw new Error('Patient not found')`. The client gets a string it cannot reliably match, cannot translate, and cannot tell apart from an unhandled exception. Coded errors or nothing.

### The delegation pattern, end to end

The handler loads and guards; the model does the work and owns the cascade. The invoice soft-delete shows the full shape:

```ts
// convex/model/billing/invoices.ts:117 — the model owns the cascade
export async function softDeleteInvoice(ctx: WriteCtx, invoiceId: Id<'invoices'>) {
  const before = await ctx.db.get(invoiceId);
  await ctx.db.patch(invoiceId, { deletedAt: Date.now(), updatedAt: Date.now() });
  const after = await ctx.db.get(invoiceId);
  await adjustOutstandingForInvoiceChange(ctx, before, after);  // financial aggregate
  if (after) await syncPaymentFactsForInvoice(ctx, after);      // payment facts
  await refreshInvoiceSearchText(ctx, invoiceId);               // search index
}
```

One model call, and every downstream consequence — outstanding totals, payment facts, the search index — is updated transactionally. The handler never knows the details; it just calls `softDeleteInvoice` then `recomputeInvoice` then `recomputePatient`.

### The model is organized by domain, and owns the hard parts

| Domain (`model/…`) | Owns |
|---|---|
| `billing/` | invoice lifecycle, immutable ledger, LIFO refunds, recompute, payment facts, invoice search |
| `clinical/` | record loaders (`require*`), visit/plan queries, name formatting |
| `authz/` | permission checks, role/permission loading, member context, dentist + patient access, RBAC seed |
| `cascade/` | cascading deletes (visit → stock → invoice), terminal-status handling, invoice ownership transfer |
| `inventory/` | branch stock queries and transactional quantity adjustment |
| `warmup/` | query pre-warming on app load |
| `auth/` | OAuth/password/OTP strategies |

The genuinely hard logic — money and cascades — lives here as idempotent, observable functions. Invoice recompute loads before/after state, computes deltas, issues a LIFO auto-refund on overpayment, repatches the invoice, and re-syncs aggregates and search — and can be re-run safely to converge:

```ts
// convex/model/billing/recompute.ts:86 (shape)
const targetTotal = applyInvoiceDiscount(subtotal, invoice.discount);
if (effectivePaidBefore > targetTotal) {
  await applyLifoRefund(ctx, clinicId, invoice._id,
    effectivePaidBefore - targetTotal, 'invoice_recompute_delta', 'invoice', actorUserId);
}
await ctx.db.patch(invoice._id, { totalAmount: targetTotal, paidAmount, refundedAmount, updatedAt: Date.now() });
await adjustOutstandingForInvoiceChange(ctx, invoice, nextInvoice);
await refreshInvoiceSearchText(ctx, invoice._id);
```

The ledger is the model's other anchor: insert-only, balance-validated, with a denormalized cache and a `refType`/`refId` audit trail — never updated, never deleted.

### Cascades are explicit, not scattered

When deleting a visit must revert stock, soft-delete the visit, and decide an invoice's fate, that orchestration is one model function in `model/cascade/`, not logic smeared across handlers:

```ts
// convex/model/cascade/visits.ts:34 — one place owns the consequence graph
export async function cascadeDeleteVisit(ctx, clinicId, visitId, userId) {
  const visit = await requireVisit(ctx, clinicId, visitId);
  // 1) revert stock for scheduled/completed visits
  // 2) delete visit-line detail rows (transient joins -> hard delete)
  // 3) soft-delete the visit; sync patient access
  // 4) recompute the owning invoice; hard-delete a bare visit invoice,
  //    soft-delete a plan invoice only when no live plan visits remain
}
```

**Anti-pattern (AI-vibe smell):** each handler that touches a visit re-implements "and also fix the stock and the invoice." The rules drift, a path gets missed, and stock or balances silently corrupt. Cascades are named model functions with a single home.

### Soft-delete is universal and consistent

Every deletable record uses `deletedAt?: number`; the predicate is the same everywhere and is backed by an index:

```ts
// convex/model/clinical/records.ts:7
function matchesClinic(row: { clinicId: Id<'clinics'>; deletedAt?: number }, clinicId: Id<'clinics'>) {
  return row.clinicId === clinicId && row.deletedAt === undefined;
}
```

Hard delete is reserved for genuinely transient join rows (visit tooth-treatments, payment facts being rebuilt). Users use `archivedAt` as the same concept for accounts (checked in `loadAuthenticatedUser`). One marker, one filter, one meaning across the whole schema.

### Rules

- Throw `new AppError(ERROR_CODES.X)` for every domain failure; reserve raw `throw new Error` for internal adapters with no client consumer.
- Keep handlers to load + guard + delegate + shape; put all business logic in `model/<domain>/` functions taking a stripped `ctx`.
- Make money and cascade logic idempotent and observable (load before/after, compute deltas, converge on re-run).
- Keep cascades in `model/cascade/` as named functions; never re-implement a consequence graph inline in multiple handlers.
- Keep the ledger insert-only with a `refType`/`refId` audit trail and a denormalized balance; never update or delete a ledger row.
- Soft-delete with `deletedAt` (and `archivedAt` for users); filter via an index everywhere; hard-delete only transient joins.
- Make the error code the contract: clients branch on `error.code`; never depend on a message string.

---

## 7. Actions, HTTP & External Integrations: The Side-Effect Boundary

The database transaction is sacred and fast; everything that talks to the outside world is quarantined outside it. In Convex terms: **queries and mutations are transactional and touch only the database; actions run effectful code (network, SDKs, Node APIs) and persist results by calling mutations.** This boundary is the difference between a backend that holds up under load and one whose transactions block on a third party's latency. AI scaffolds get this exactly wrong — they `fetch()` inside a mutation — so make the boundary explicit and absolute.

### The rule: I/O in actions, persistence in mutations

An action does its external work, then calls a mutation to write the result. It never touches `ctx.db` directly:

```ts
// convex/clinicAiCredits.ts:380 — external I/O outside the txn, persisted via runMutation
export const syncForActiveClinic = action({
  args: { clinicId: v.optional(v.id('clinics')) },
  handler: async (ctx, args): Promise<ClinicAiCreditsClientSnapshot> => {
    const user = await requireActionUser(ctx);
    const clinicId = await requireActionClinicPermission(ctx, {
      ...user, clinicIdArg: args.clinicId, permission: PERMISSIONS.SUBSCRIPTION_READ });
    try {
      const record = await ensureClinicOpenRouterKey(ctx, { clinicId, actorUserId: user.userId });
      const snapshot = await fetchOpenRouterKeyUsage({ /* network call, OUTSIDE any txn */ });
      return await ctx.runMutation(                       // persist INSIDE a txn
        internal.clinicAiCredits.persistClinicOpenRouterSnapshot,
        { clinicId, actorUserId: user.userId, snapshot });
    } catch (error) {
      return await ctx.runMutation(                       // even failures are recorded
        internal.clinicAiCredits.recordClinicOpenRouterSyncFailure,
        { clinicId, actorUserId: user.userId, errorText: getProviderErrorText(error) });
    }
  }
});
```

**Anti-pattern (AI-vibe smell):** `ctx.db.insert(...)` inside an action, or `await fetch(provider)` inside a mutation. The first bypasses the transaction; the second holds a transaction open across the network. I/O in actions, writes in mutations, joined by `ctx.runMutation`.

### Auth in actions: query for the context, don't re-derive it

Actions cannot use the clinic function-builder ladder (that runs in the query/mutation layer), so they resolve identity by calling internal queries that reuse the *same* membership/permission logic:

```ts
// convex/internal/actionContext.ts:65 — actions borrow the real authz via internalQuery
export const requireClinicPermissionForAction = internalQuery({
  args: { userId: v.id('users'), authSessionId: v.optional(v.union(v.id('authSessions'), v.null())),
          clinicIdArg: v.optional(v.id('clinics')), permission: v.string() },
  returns: v.object({ clinicId: v.id('clinics'), isOwner: v.boolean() }),
  handler: async (ctx, args) => {
    const actionCtx = await loadActionClinicContext(ctx, { /* ... */ });
    requirePermission(actionCtx.permissions, args.permission as PermissionString);
    return { clinicId: actionCtx.clinicId, isOwner: actionCtx.isOwner };
  }
});
```

The action calls `ctx.runQuery(internal.internal.actionContext.requireClinicPermissionForAction, …)` and gets a validated `clinicId` back. Authorization logic is never duplicated into action code.

### AI providers: gate credits, provision lazily, record every event

AI calls are gated and metered. Per-clinic provider keys are provisioned lazily with a polling state machine (so concurrent first-uses don't double-create), usage is synced before more spend is allowed, and every credit event is written to an audit table with before/after snapshots:

```ts
// convex/clinicAiCredits.ts:243 — lazy provisioning with bounded polling
for (let attempt = 0; attempt < PROVISIONING_POLL_ATTEMPTS; attempt += 1) {
  const begin = await ctx.runMutation(internal.clinicAiCredits.beginClinicOpenRouterKeyProvisioning, {...});
  if (begin.state === 'ready') return begin.record;
  if (begin.state === 'pending') { await sleep(PROVISIONING_POLL_MS); continue; }  // another action is creating it
  const created = await createOpenRouterClinicKey({ config: readOpenRouterClinicKeyConfig(), /* ... */ });
  return await ctx.runMutation(internal.clinicAiCredits.finalizeClinicOpenRouterKeyProvisioning, {...});
}
```

Provider config is read from env through a typed function with a fallback chain, never hardcoded:

```ts
// convex/model/openRouter.ts — config from env, coded error if missing
const apiKey = readOptionalEnv('OPENROUTER_MANAGEMENT_API_KEY')
            ?? readOptionalEnv('OPENROUTER_API_KEY') ?? '';
if (!apiKey) throw new OpenRouterConfigError('OPENROUTER_MANAGEMENT_API_KEY ... is required');
```

Token-minting for live AI (Gemini Live) is itself an action that permission-gates via an internal query, reads config from env, and returns a short-lived client token — minting auth, not persisting anything.

### Storage: presigned PUT, then persist metadata, then clean up

Uploads never stream bytes through a mutation. An action mints a presigned S3 PUT URL; the client uploads directly to S3; a second action validates the object and calls a mutation to persist the metadata, then deletes the previous object:

```ts
// convex/uploads.ts:93 — generate a presigned URL (no DB write yet)
const uploadUrl = await presignPutObject({ key, contentType: args.contentType,
  cacheControl: IMMUTABLE_PUBLIC_ASSET_CACHE_CONTROL });
return { uploadUrl, storageId: key, uploadHeaders: buildPresignedPutObjectHeaders(/* ... */) };

// later: saveCurrentUserAvatar — verify in S3, persist via mutation, clean up old object
const head = await headObject(args.storageId);
validateImageHeadMetadata(head.contentType, head.contentLength);   // validate before accepting
await ctx.runMutation(internal.internal.uploadsActions.applyUserAvatar, { userId, image: imageUrl, ... });
await safeDeleteObject(previousKey);
```

S3 configuration is resolved from env with fallbacks (`AWS_S3_BUCKET` → `BOOTSTRAP_BUCKET`), and access is permission-gated per upload category.

**Anti-pattern (AI-vibe smell):** returning a raw storage id as a public URL with no presigning, or accepting an upload without validating its MIME type and size. Presign for writes, validate the head before trusting the object, and gate by category.

### Email: an internal action over SES, creds from env

Email is an `internalAction` invoked by the scheduler or other server code; it constructs the message and sends via SES with credentials read from env, mapping SDK failures to a coded error:

```ts
// convex/lib/email/ses.ts — creds via requireEnv; failures become a coded error
function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new AppError(ERROR_CODES.SES_NOT_CONFIGURED);
  return value;
}
export async function sendSesEmail({ to, subject, text, html }: SendSesEmailArgs) {
  try { return await createSesClient().send(new SendEmailCommand({ /* ... */ })); }
  catch { throw new AppError(ERROR_CODES.EMAIL_DELIVERY_FAILED); }
}
```

### Background jobs: enqueue from a mutation, run in an internal action

Long work (XLSX export) is enqueued by a mutation via the scheduler and executed by an `internalAction` that generates the file, stores it, and writes status/result back through mutations:

```ts
// convex/exports.ts:307 — client mutation inserts a 'pending' job and enqueues it
const exportJobId = await ctx.db.insert('exportJobs', { clinicId: ctx.clinicId, status: 'pending', /* ... */ });
await ctx.scheduler.runAfter(0, internal.internal.exports.processExportJob, { exportJobId });
// internal/exports.ts: internalAction reads data -> builds XLSX -> ctx.storage.store -> runMutation(status, storageId)
```

The mutation returns immediately with a job the client can poll; the heavy, fail-prone work happens off the transaction.

### HTTP: a thin router, auth wired in, health as an httpAction

`http.ts` mounts a minimal router: a `no-store` health/version endpoint as an `httpAction`, and the auth library's routes:

```ts
// convex/http.ts
const http = httpRouter();
http.route({ path: '/version', method: 'GET', handler: httpAction(async () =>
  new Response(JSON.stringify({ status: 'ok', service: 'naab-be-convex', version: NAAB_BACKEND_VERSION }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })) });
auth.addHttpRoutes(http);
export default http;
```

The health endpoint is load-bearing: the self-hosting scripts and Docker health checks poll `/version` to gate startup and migrations (§9).

### Rules

- Do all external/network I/O in `action`s; persist exclusively via `ctx.runMutation`. Never `ctx.db` in an action; never `fetch` in a mutation/query.
- Resolve action auth by calling internal queries (`requireClinicPermissionForAction`) that reuse the real membership/permission logic; never re-derive authz in action code.
- Gate AI spend before calling a provider; provision per-tenant keys lazily with bounded polling; record every credit event with before/after snapshots.
- Read every external credential/config from env through a typed function with a fallback chain and a coded error; never hardcode a secret.
- Upload via presigned S3 PUT; validate the object head (type/size) before persisting metadata; clean up replaced objects; gate by category.
- Send email via an `internalAction` over SES with env creds; map SDK failures to `AppError` (`EMAIL_DELIVERY_FAILED`).
- Run long jobs as scheduled `internalAction`s enqueued from a mutation; track status (`pending`/`processing`/`complete`) and persist results via mutations.
- Keep `http.ts` thin: health as a `no-store` `httpAction`, auth via `auth.addHttpRoutes(http)`.

---

## 8. Internal Functions, Crons, Migrations & Data Lifecycle

Some functions must never be reachable from a client: seeding authorization, migrating data, granting super-admin, the permission resolvers actions borrow. These are `internalMutation`/`internalQuery`/`internalAction` — invoked only by the deploy pipeline, the scheduler, or other server functions. Quarantining them is not a nicety; a client-callable `seed` or `grantSuperAdmin` is a privilege-escalation hole with a public URL.

### `internal*` is the server-only surface

The distinction is structural: `mutation`/`query`/`action` are client-callable; `internalMutation`/`internalQuery`/`internalAction` are not — they are addressed through the `internal.*` reference and can only be called by the CLI, crons, the scheduler, or other functions. RBAC seeding is the canonical example:

```ts
// convex/internal/rbac.ts — server-only; client cannot call this
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ensureRbacSeeded(ctx);
    const [permissions, roles, rolePermissions] = await Promise.all([
      ctx.db.query('permissions').collect(),
      ctx.db.query('roles').collect(),
      ctx.db.query('rolePermissions').collect(),
    ]);
    return { permissions: permissions.length, roles: roles.length, rolePermissions: rolePermissions.length };
  }
});
```

**Anti-pattern (AI-vibe smell):** exposing `seed`, a migration, or `grantSuperAdmin` as a public `mutation`. Anything that mutates authorization, runs a migration, or elevates privileges is `internal*`, full stop.

### Seeding is idempotent — safe on every deploy

Seed logic upserts; it never blindly inserts. Running it on a fresh database and on an existing one both converge to the same catalog of permissions and system roles, so a new permission rolls out automatically and no manual migration is needed:

```ts
// convex/model/authz/rbacSeed.ts:60 — three-step idempotent seed
export async function ensureRbacSeeded(ctx: WriteCtx): Promise<void> {
  for (const permission of PERMISSION_CATALOG) await upsertPermission(ctx, permission);
  const systemRoleIds = new Map<SystemRole, Id<'roles'>>();
  for (const roleName of SYSTEM_ROLE_NAMES) systemRoleIds.set(roleName, await upsertSystemRole(ctx, roleName));
  for (const roleName of SYSTEM_ROLE_NAMES)
    await replaceRolePermissions(ctx, systemRoleIds.get(roleName)!, DEFAULT_ROLE_PERMISSIONS[roleName]);
}

// upsertPermission: query by name -> patch if exists, insert if not (re-runnable)
```

### Migrations are audited, then repaired, and gate on blockers

Data migrations come in an `audit` (read-only, classifies issues into blockers vs repairable) and a `repair` (the write) — both `internal*`, invoked by a post-deploy script that fails on blockers unless explicitly overridden:

```ts
// convex/internal/treatmentPlanMigration.ts — audit (internalQuery) + repair (internalMutation)
export const audit  = internalQuery({  args: { clinicId: v.optional(v.id('clinics')), sampleLimit: v.optional(v.number()) },
  handler: (ctx, args) => auditTreatmentPlanMigration(ctx, args) });
export const repair = internalMutation({ args: { clinicId: v.optional(v.id('clinics')) },
  handler: (ctx, args) => repairTreatmentPlanMigration(ctx, args) });
```

The post-deploy runner (`scripts/post-deploy-migrations.mjs`) calls these via the CLI, parses the JSON result, logs each step, and exits non-zero if blockers exist (unless `--allow-blockers`). The migration is reproducible and observable, not a hand-run SQL script.

### Crons: one registry, idempotent jobs, interval not wall-clock

Scheduled work lives in one `crons.ts`, calls internal functions, and is written to be idempotent and timezone-safe by using intervals plus local-date logic rather than a single wall-clock fire:

```ts
// convex/crons.ts
const crons = cronJobs();
// Hourly so each clinic-local day is covered shortly after local midnight;
// materialization is idempotent per recurring rule and local date.
crons.interval('materialize due recurring expenses', { hours: 1 },
  internal.internal.recurringExpenses.materializeDue, {});
export default crons;
```

Running hourly with idempotent, per-local-date materialization covers every timezone and tolerates a missed or doubled run — far safer than a single daily fire that assumes one timezone.

### Data lifecycle: soft-delete, denormalized aggregates, immutable facts

The lifecycle rules from §5–6 are the backbone here too: records are soft-deleted (`deletedAt`), aggregates (`balance`, `outstandingTotal`, `visitCount`) are materialized on rows and maintained transactionally by model functions on every relevant write, and financial events are appended to immutable fact/ledger tables for audit. Reads stay fast (no joins), history stays intact (no destructive updates), and any aggregate can be recomputed from the event history if it ever drifts.

### Rules

- Make every seed/migration/admin/action-context function `internal*`; never expose authorization, migration, or privilege changes as a client-callable function.
- Write seeds as idempotent upserts (query-by-key → patch-or-insert); run them on every deploy.
- Split migrations into `audit` (read-only, classify blockers vs repairable) and `repair` (write); run them from the post-deploy script; fail on blockers unless explicitly overridden.
- Keep one `crons.ts`; have crons call `internal*` functions; make jobs idempotent and timezone-safe (interval + local-date), not single wall-clock fires.
- Maintain materialized aggregates transactionally in model functions; keep financial history in append-only ledger/fact tables; never destructively update history.

---

## 9. Self-Hosted Convex: Deployment, Environment & Operational Discipline

The backend runs self-hosted — Convex on Postgres, in Docker, with auth keys you generate and an env you sync by script. This buys data residency and control, and it imposes discipline: deployment is an ordered pipeline, environment is split between runtime and function scopes and synced (never hand-set), and startup is health-gated. Treat the operational story as part of the architecture, because a backend you cannot reproducibly deploy is a backend you cannot trust.

### The deploy pipeline: code → seed RBAC → migrate, in order

Deployment is a single, sequential, three-step command — and the order is load-bearing:

```jsonc
// package.json
"deploy": "bun scripts/convex-cli.mjs deploy
        && bun scripts/convex-cli.mjs run --push internal/rbac:seed \"{}\"
        && bun scripts/post-deploy-migrations.mjs"
```

1. **Deploy code** — push functions and schema.
2. **Seed RBAC** — run `internal/rbac:seed` so every permission and system role exists *before* any new permission check can run against live traffic.
3. **Migrate** — run `post-deploy-migrations.mjs` to audit/repair data after the schema change.

Seeding before checking is the rule that prevents "deployed a new permission, now every request 403s." Migrating after deploy is what makes a schema change safe on existing data.

**Anti-pattern (AI-vibe smell):** deploying code and stopping. New permissions aren't seeded (checks fail), data isn't migrated (the new schema meets old rows), and there's no record of what ran. The pipeline is one command, in order, every time.

### The Docker stack: Postgres + backend + dashboard, health-gated

The stack is three services with explicit dependencies and health checks:

```yaml
# docker-compose.yml (shape)
services:
  postgres:   # the source of truth; data in a named volume
    image: postgres:17
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U convex -d convex_self_hosted"], interval: 5s, retries: 20 }
  backend:    # the Convex backend image, on two ports: 3210 functions, 3211 auth/JWKS
    depends_on: { postgres: { condition: service_healthy } }
    environment:
      POSTGRES_URL: ${POSTGRES_URL:?Set POSTGRES_URL in .env}      # fail-fast on missing env
      INSTANCE_SECRET: ${INSTANCE_SECRET:?Set INSTANCE_SECRET in .env}
    healthcheck: { test: ["CMD-SHELL", "curl -fsS http://localhost:3210/version || exit 1"], retries: 20 }
  dashboard:  # admin UI; waits for backend health
    depends_on: { backend: { condition: service_healthy } }
```

The backend waits for Postgres to be healthy, requires its critical env (`:?` fails the start if unset), and exposes `/version` for health checks. The provisioning script (`ensure-convex-compose.mjs`) polls `/version` until healthy before the CLI runs migrations, and recreates the backend container if its URL settings changed — so "is the backend ready?" is never a guess.

### Environment: split runtime from function scope, and sync — never hand-set

Env vars live in two scopes that must not mix:

- **Backend runtime** (`POSTGRES_URL`, `INSTANCE_SECRET`, `CONVEX_*_ORIGIN`) — set on the Docker container, managed by infra, **never** synced into functions.
- **Function environment** (`AWS_SES_*`, `AWS_S3_*`, `JWT_PRIVATE_KEY`, `JWKS`, `OPENROUTER_*`, `GEMINI_*`, `SITE_URL`) — synced into the Convex deployment from `.env` by `sync-convex-env.mjs`, filtered to an explicit allowlist:

```js
// scripts/sync-convex-env.mjs — only these keys reach functions
const deploymentEnvKeys = new Set([
  'SITE_URL', 'AWS_SES_REGION', 'AWS_SES_ACCESS_KEY_ID', 'AWS_SES_SECRET_ACCESS_KEY', 'AWS_SES_FROM_EMAIL',
  'AWS_REGION', 'AWS_S3_BUCKET', 'BOOTSTRAP_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL_BASE',
  'JWT_PRIVATE_KEY', 'JWKS', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', /* OPENROUTER_*, GEMINI_*, ... */
]);
```

Keeping `POSTGRES_URL` out of the function scope is a hard isolation rule; functions never get the database connection string. And `CONVEX_SITE_URL` is *not* synced — the backend derives it from `CONVEX_SITE_ORIGIN` and recent CLIs reject setting it manually.

**Anti-pattern (AI-vibe smell):** `convex env set` by hand for each key (drift, no audit, forgotten keys), or syncing `POSTGRES_URL`/`INSTANCE_SECRET` into functions (isolation break). Env is a filtered, scripted sync from `.env`.

### Auth keys are generated and validated, not improvised

JWT signing keys are generated by script and kept internally consistent — the JWKS is *derived* from the private key and validated against any provided JWKS to catch tampering or mismatch:

```js
// scripts/generate-auth-keys.mjs — fresh RSA private key + JWKS
const { jwtPrivateKey, jwks } = generateAuthEnv();
// scripts/lib/auth-env.mjs — resolveAuthEnv: normalize PEM, derive JWKS, detect mismatch, regenerate if invalid
```

Helper scripts round this out: `verify-(local-)convex-site-auth.mjs` confirm the auth issuer is reachable from both the container and the CLI host, `normalize-local-env.mjs` fixes stale local URLs, and `write-backend-version.mjs` stamps the version that `/version` reports. The operational surface is scripted and verifiable end to end.

### Rules

- Deploy with the ordered pipeline: push code → `internal/rbac:seed` → post-deploy migrations. Never deploy code alone; never check a permission you haven't seeded.
- Run the stack from `docker-compose`: Postgres (source of truth, named volume) + backend (ports 3210/3211, fail-fast `:?` env) + dashboard; gate startup on health checks (`pg_isready`, `/version`).
- Split env into backend-runtime vs function scope; sync function env from `.env` via `sync-convex-env.mjs` against an explicit allowlist; never `convex env set` by hand.
- Never put `POSTGRES_URL`/`INSTANCE_SECRET` in the function scope; never manually set `CONVEX_SITE_URL` (it's derived from `CONVEX_SITE_ORIGIN`).
- Generate auth keys by script; derive and validate JWKS from the private key; verify the auth issuer is reachable from container and host before trusting a deploy.
- Poll `/version` for readiness before running migrations; recreate the backend container when URL settings change.

---

## 10. Testing & the Quality Machine

Correctness here is proven, not hoped for. The reference carries **44 test files / ~13.5k lines** of integration tests that run real functions against an in-memory Convex runtime with the *actual* schema and modules — and, critically, with real permission fixtures, so a test cannot pass while authorization is broken. The compiler is the first gate (`tsc --noEmit`); the test suite is the second. A feature is not done until both are green.

### The `convex-test` harness runs the real backend

Tests instantiate the genuine schema and all modules — no mocking of the data layer:

```ts
// tests/helpers.ts:18
export function makeTest(): T {
  return convexTest({ schema, modules });   // real schema, real functions, in-memory
}
```

Identity is mocked at the auth seam with `withIdentity`, returning an `authed` wrapper whose `.mutation()`/`.query()` calls run as that user:

```ts
// tests/helpers.ts:69
const userId = await runDb(t, (ctx) => ctx.db.insert('users', { name, email, emailVerificationTime: Date.now() }));
return { userId, authed: t.withIdentity({ subject: userId, tokenIdentifier: `token|${userId}` }) };
```

### Fixtures set up real tenants and real permissions

A reusable `bootstrapClinic` creates an authenticated owner, a clinic, and completes onboarding — the baseline most tests start from:

```ts
// tests/helpers.ts:119
export async function bootstrapClinic(t) {
  const owner = await createAuthedUser(t, { email: 'owner@example.com', name: 'Clinic Owner' });
  const { clinicId } = await owner.authed.mutation(api.clinics.create, { name: 'Alpha Clinic', slug: 'alpha-clinic' });
  await owner.authed.mutation(api.clinicOnboarding.complete, { clinicId, language: 'ar' });
  return { owner, clinicId };
}
```

The non-negotiable discipline: permissions are wired **explicitly**, never assumed. A test for a limited role creates the member with a system role and grants exactly the permissions under test:

```ts
// tests/patients.test.ts:99 — permission granted explicitly, by constant
await owner.authed.mutation(api.memberPermissions.setMember, {
  clinicId, memberId, permissionNames: [PERMISSIONS.PATIENTS_READ],
});
```

**Anti-pattern (AI-vibe smell):** tests that run everything as the owner (who has the wildcard) and never set up a constrained role. They pass while every non-owner permission boundary is broken. Test the boundary, or you haven't tested authorization.

### Tests assert on coded errors and on real side-effects

Error tests use a helper that unpacks the `ConvexError` and checks the code — so the test asserts the *contract*, not a message string:

```ts
// tests/helpers.ts:45
await expectRejectedWithCode(
  owner.authed.mutation(api.branches.create, { clinicId, name: 'Main', code: 'B' }),
  ERROR_CODES.BRANCH_NAME_TAKEN);
```

And behavioral tests verify the full cascade by snapshotting the database via `t.run`:

```ts
// tests/clinical-billing.test.ts:132 — delete a paid visit, assert the refund cascade
await fx.owner.authed.mutation(api.visits.remove, { clinicId: fx.clinicId, visitId: fx.visitId });
const snap = await fx.t.run(async (ctx) => ({
  invoice: await ctx.db.get(fx.invoiceId),
  ledger: await ctx.db.query('patientLedger').withIndex('by_patient', q => q.eq('patientId', fx.patientId)).collect(),
  patient: await ctx.db.get(fx.patientId),
}));
expect(snap.invoice).toBeNull();
expect(snap.ledger.find(e => e.type === 'refund_credit')?.amount).toBe(fx.amount);
expect(snap.patient?.balance).toBe(fx.amount);
```

The test exercises the real mutation and asserts the *consequences* (invoice gone, refund ledgered, balance updated) — exactly the cascade logic §6 mandates.

### Tests mirror the function surface; complex setup uses `t.run`

Test files mirror entity modules (`branches.test.ts` ↔ `branches.ts`, `clinical-billing.test.ts` for the visit/invoice/payment loop). When public APIs can't easily produce a fixture state (or legacy state for a migration test), tests drop to the database directly via `t.run(ctx => ...)` to insert exactly the rows they need — then call the function under test.

### The compiler is the first gate

Type-check is the build: `"check": "tsc --noEmit --pretty"`, `"build": "bun run check"`. Tests run with `vitest run --testTimeout=20000` (CI mode, generous timeout for fixture setup). A type error is a failed build; a failing test is a failed merge. There is no separate "lint" theater — strict TypeScript plus the integration suite is the machine.

### Rules

- Test through `convex-test` with the real `schema` + `modules`; mock identity with `t.withIdentity`, not the data layer.
- Start from a real tenant fixture (`bootstrapClinic`); grant permissions explicitly with `memberPermissions.setMember` and `PERMISSIONS.*` constants.
- Always test a constrained role, never only the owner; a suite that can't fail on a permission boundary hasn't tested authorization.
- Assert domain failures by error *code* (`expectRejectedWithCode`/`expectAppErrorCode`), never by message string.
- Verify behavior by snapshotting the DB via `t.run` and asserting the full cascade (records, ledger, aggregates), not just the return value.
- Mirror test files to the function surface; use `t.run` to set up complex or legacy fixture state.
- Gate on both `tsc --noEmit` and `vitest run`; treat either failing as un-mergeable.

---

## 11. The Agent Operating Protocol

This is the contract. Everything above describes WHAT the reference backend is; this section tells you HOW to build it without regressing the bar. You are not assembling a working API — you are reproducing a *disciplined* one, where auth is resolved once at the boundary, the tenant key is an architectural invariant, business logic lives in a testable model, errors are typed codes, and external I/O never touches a transaction. Build in the order below. Do not skip ahead to a feature because a handler "returns the right JSON": a feature built before the schema, the function-builder ladder, and the error layer exist is a feature you will rewrite.

### Build in this order — foundations before features

1. **Schema + errors first.** Define `schema.ts` (tables with `v.*` validators, the tenant key on every clinic table, `deletedAt`, an index per access path led by `clinicId`). Stand up `lib/errors.ts` (`AppError` + the `ERROR_CODES` catalog) and `lib/validators.ts` (`literalUnion`). Put every shared enum/constant in `@naab/shared`. **No function is written before its tables, validators, and error codes exist.**
2. **The function-builder ladder second.** Build `functions.ts`: `loadAuthenticatedUser` (auth resolved once), `loadMemberContext` (role permissions + overrides), and the six builders (`authed*` → `activeClinic*`/`clinic*`). Export `requireClinicPermission`. Every later function is built on these — never a bare `query`/`mutation`.
3. **RBAC + the model authz layer third.** Build `model/authz/*` (permissions, member context, dentist/patient scoping helpers) and the idempotent `rbacSeed`. Wire `internal/rbac:seed`. Authorization must be seedable and resolvable before any feature checks a permission.
4. **The model layer fourth.** Establish `model/<domain>/` with stripped-context functions: the record loaders (`require*`), the billing core (ledger, recompute, refunds), and the cascade orchestrators. Business logic lives here, tested in isolation, before any feature handler calls it.
5. **The function surface fifth.** Write thin `convex/<entity>.ts` handlers: validate args (`v.*`) → `requireClinicPermission` → delegate to the model → return a computed DTO with a `returns:` validator. Clone the established shape for each entity.
6. **Integrations, internal jobs, and ops last.** Add actions for external I/O (presigned uploads, AI with credit gating, SES email), scheduled `internalAction`s for long jobs, crons, and the deploy/env scripts. A new integration follows the action→`runMutation` boundary; if it wants to `fetch` in a mutation, the design is wrong.

### Definition of Done — every function and domain must pass ALL of these

- [ ] **Built on a context builder.** Authenticated, tenant-scoped functions use `authed*`/`activeClinic*`/`clinic*`. No bare `query`/`mutation`; no `getAuthUserId` inside a builder-backed handler.
- [ ] **Tenant-isolated by construction.** Every clinic query filters `.eq('clinicId', ctx.clinicId)` *in an index* led by `clinicId`, sourced from validated context. No client-supplied tenant id; no post-fetch `.filter` for tenancy.
- [ ] **Permission-gated first.** First statement after loading context is `requireClinicPermission(ctx, PERMISSIONS.X)` (or a scoped helper). Resource rules use `requireDentistScopedAccess`/`requireAccessiblePatient`.
- [ ] **Thin handler, fat model.** Logic lives in `model/<domain>/`; the handler validates, permits, delegates, shapes. Cascades are named model functions.
- [ ] **Typed contract.** `v.*` arg validators + a `returns:` validator (matching the handler type); no `v.any()`. Types are `Doc<>`/`Id<>` from codegen; enums from `@naab/shared`. No hand-written DTOs.
- [ ] **Index-backed reads.** Every list/lookup names an index; no `.collect()`-then-`.filter()`; search via `searchIndex`.
- [ ] **Coded errors.** Domain failures throw `AppError(ERROR_CODES.X)`; raw `throw new Error` only in internal adapters with no client consumer.
- [ ] **Side-effects isolated.** External/network I/O is in `action`s, persisted via `ctx.runMutation`; secrets read from env via a typed config function. No `fetch`/SDK call in a mutation/query; no secret in source.
- [ ] **Soft-delete + lifecycle.** Deletable records use `deletedAt` (filtered in-index); aggregates maintained transactionally; financial history append-only. Hard delete only transient joins.
- [ ] **Internal means internal.** Seed/migration/admin/action-context functions are `internal*`, never client-callable.
- [ ] **Tested with real permissions.** A `convex-test` test exercises the function against a real tenant fixture with explicitly granted permissions (including a constrained role), asserts coded errors, and verifies the cascade via a `t.run` DB snapshot.
- [ ] **Gate is green.** `tsc --noEmit` and `vitest run` both pass.

### Guardrails — ask these BEFORE you write the line

- **Before you read or write any row:** "Is this scoped to `ctx.clinicId` in an index?" If you typed a `clinicId` from args into a query, or reached for `.collect().filter()`, stop — use the validated context value and an index whose first field is the tenant key.
- **Before you write a handler:** "Did a builder already authenticate this?" If you're about to call `getAuthUserId` inside a `clinicMutation`, stop — the context is already there. Is the first line a `requireClinicPermission`?
- **Before you put logic in a handler:** "Does this belong in the model?" If the handler is growing past load-permit-delegate-shape, stop — move it to `model/<domain>/` as a stripped-context function.
- **Before you throw:** "Is there an `ERROR_CODES` entry?" If you typed `throw new Error('...')` for a domain condition, stop — add a code and throw `AppError`.
- **Before you call anything external:** "Am I in an action?" If you're about to `fetch`, hit an SDK, or read a secret inside a mutation/query, stop — move it to an `action` and persist via `ctx.runMutation`. Is the credential read from env via a typed config function?
- **Before you define a field or function:** "Is this validated and typed off the schema?" If you reached for `v.any()`, a hand-written `interface`, or a duplicated enum, stop — use `v.*`, `Doc<>`/`Id<>`, and `@naab/shared`.
- **Before you delete:** "Should this be soft?" If you typed `ctx.db.delete` on a clinical/financial record, stop — soft-delete with `deletedAt` and run the cascade model function. Hard delete only a transient join.
- **Before you expose a function:** "Should the client be able to call this?" If it seeds, migrates, or elevates privilege, it is `internal*`.

### House Rules — keep this block in context at all times

```
ARCHITECTURE
- Zones: convex/<entity>.ts (thin surface) | model/<domain>/ (fat business logic) | lib/ (errors, rbac, validators, email, s3) | internal/ (server-only). _generated/ is read-only.
- Handlers: validate(v.*) -> requireClinicPermission -> delegate to model -> return DTO(+returns: validator). One screen max.
- Model fns take stripped ctx (Pick<…Ctx,'db'> + explicit scope args); unit-testable; reused by handlers, cascades, tests.

AUTH & TENANCY (the invariant)
- Build every authed/tenant fn from authedQuery/Mutation, activeClinicQuery/Mutation, or clinicQuery/Mutation. NEVER bare query/mutation; NEVER re-run getAuthUserId in a builder-backed handler.
- auth resolved once in loadAuthenticatedUser; permissions resolved once in loadMemberContext (role perms + per-member grant/revoke; owner = RBAC.OWNER_WILDCARD).
- ctx carries userId, clinicId, permissions(ReadonlySet), dentistId, roleName, isOwner. Read them; never re-derive.
- A clinicId ARG is untrusted until loadMemberContext validates membership. Query scope = ctx.clinicId, IN AN INDEX (.withIndex('by_clinic…', q=>q.eq('clinicId',ctx.clinicId))). Dentist scope = ctx.dentistId, also in-index.
- Gate first line: requireClinicPermission(ctx, PERMISSIONS.X). Resource rules: requireDentistScopedAccess / requireAccessiblePatient. PERMISSIONS.* constants only — never string literals.
- Impersonation = session.impersonatedActiveClinicId only; never elevate the user.

SCHEMA & TYPES
- schema.ts is the source of truth. Tables: v.* validators + clinicId + deletedAt + an index per access path (clinicId-first, deletedAt included, selectivity order). searchIndex for text.
- Enum validators via literalUnion(@naab/shared const arrays). Shared enums/constants/domain-logic live ONCE in @naab/shared.
- Every fn: v.* args + returns: validator (matches handler type). NO v.any(). Types: Doc<>/Id<> from codegen; branded ids; client DTOs are computed read models. NO hand-written DTOs.
- tsconfig: strict + noUncheckedIndexedAccess. tsc --noEmit is the build.

ERRORS & MODEL
- Domain failures: throw new AppError(ERROR_CODES.X). Raw throw new Error only in internal adapters w/ no client consumer. Clients branch on error.code.
- Money/cascade logic idempotent + observable (load before/after, deltas, converge). Ledger insert-only + refType/refId + denormalized balance. Cascades = named model/cascade/* fns.
- Soft-delete (deletedAt; archivedAt for users), filtered in-index. Hard delete only transient joins. Aggregates materialized transactionally.

SIDE-EFFECTS (the boundary)
- queries/mutations: DB only, fast, transactional. actions: external I/O (S3/SES/AI/Node), NO ctx.db, persist via ctx.runMutation. NEVER fetch in a mutation.
- Actions resolve authz via internalQuery (requireClinicPermissionForAction), not re-derived.
- AI: gate credits before provider calls; lazy per-clinic key provisioning (bounded poll); record every credit event (before/after). Config from env via typed fn + fallback; coded errors.
- Uploads: presigned S3 PUT -> client uploads -> validate head(type/size) -> persist metadata via mutation -> cleanup old. Email: internalAction over SES, env creds. Long jobs: scheduler -> internalAction -> status + runMutation.

INTERNAL / OPS
- Seed/migration/admin/action-context = internal* (never client-callable). Seeds idempotent (upsert). Migrations: audit(read)+repair(write), post-deploy, fail on blockers.
- Crons: one crons.ts -> internal* fns; idempotent + timezone-safe (interval+local-date).
- Deploy (ordered): push code -> internal/rbac:seed -> post-deploy-migrations. Self-hosted: docker-compose postgres+backend+dashboard, health-gated (/version, pg_isready).
- Env: split runtime (POSTGRES_URL/INSTANCE_SECRET — container only) vs function scope (synced from .env via sync-convex-env allowlist). Never hand-set; never sync POSTGRES_URL to functions; never set CONVEX_SITE_URL. Auth keys generated by script; JWKS derived+validated from private key.

TESTING (un-mergeable if violated)
- convex-test with real schema+modules; identity via t.withIdentity. Start from bootstrapClinic; grant perms explicitly (memberPermissions.setMember + PERMISSIONS.*); ALWAYS test a constrained role.
- Assert domain failures by code (expectRejectedWithCode). Verify cascades via t.run DB snapshot (records+ledger+aggregates). Gate: tsc --noEmit + vitest run.
```

Treat this protocol as non-negotiable. When in doubt, prefer the disciplined-but-slower path: a coded error over a thrown string, a model function over an inline handler, an index over a scan, a pre-validated `ctx.clinicId` over a client argument, an action-plus-`runMutation` over a `fetch`-in-a-mutation. The reference backend feels hand-architected because every one of these choices was made the same way every time — your job is to make them the same way too.

---

## Closing Word

A backend earns trust the way a ledger does: not by looking impressive, but by being right every time, for every tenant, under every concurrent write, and by saying exactly what went wrong when something does. The discipline in this manifesto — resolve auth once, make tenancy an index-level invariant, keep logic in a testable model, type every error, isolate every side-effect, soft-delete everything that matters, and prove it with tests that respect permissions — is what turns "it returned the right JSON in my test" into "I would trust this with a patient's record." Build the foundation once — the schema, the function-builder ladder, the error layer, the model — and every feature after it inherits the correctness for free. Hold the line on the checklists, make the unsafe thing structurally impossible rather than merely discouraged, and the result will read as engineered, not generated.

<sub>Reverse-engineered from a production self-hosted Convex backend (a clinic ERP). Adapt the named tools to your stack; keep the principles intact.</sub>
