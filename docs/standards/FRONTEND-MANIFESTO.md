# The Frontend Manifesto

> A binding standard for building calm, dense, instantly-responsive, clinically-trustworthy frontends — and for refusing the generic "AI-vibe" aesthetic. Reverse-engineered from a real production React 19 application (a hospital/clinic ERP) and written to be handed to a development team or pasted directly into an AI coding agent's context.

---

## Preamble — Read This First

This document is not a tutorial and not a style suggestion. It is the **operating constitution** for a frontend. Every rule here was extracted from a shipping codebase that real clinicians use for nine hours a day, where a flashy screenshot is worthless and a spinner-flash on every click is a defect. The goal is a frontend that looks **hand-architected by a senior team that cares**, not **generated**.

### How to use this with an AI agent

1. **Load it as context, not inspiration.** Paste this file (or link it) into your agent's working context — `CLAUDE.md`, `AGENTS.md`, a system prompt, or a pinned doc. Treat every "Rules" checklist as a hard constraint, not a guideline.
2. **Set up the foundation before features.** Follow the build order in the final section (*The Agent Operating Protocol*): design tokens → primitives → data/caching layer → features. Do not write feature screens against an unfinished design system.
3. **Verify against the checklists.** Each section ends with a tight, imperative "Rules" list. Before a component or feature is "done," it must pass every applicable rule. The last section gives a single Definition of Done.
4. **When in doubt, choose restraint.** If a change makes the app flashier in one screenshot but slower, louder, less consistent, or harder to verify — reject it.

### The reference stack

The reference implementation uses **React 19** (with the React Compiler), **Vite**, **Tailwind CSS v4** (CSS-first `@theme`), **TanStack Router + Query**, **Convex** (realtime backend) bridged into Query, **motion** (Framer Motion), **class-variance-authority** + `clsx`/`tailwind-merge`, **Radix UI / Base UI** primitives, **@phosphor-icons/react**, **i18next**, **Zustand**, and **Bun + Turborepo**. The *specific libraries are replaceable*; the **patterns, behaviors, tokens, and discipline are not**. Where this manifesto names a library, read it as "this role in your stack."

> If your stack differs, map each named tool to its equivalent. A different router still pre-warms routes; a different data layer still does optimistic-with-rollback; a different CSS framework still consumes semantic tokens and never raw hex.

### The backend is a reference, not a requirement

This manifesto shows the data layer with **Convex** (the reference's realtime backend) bridged into **TanStack Query**. **Convex is the reference, not a requirement.** Wherever you see `convex`, the `'skip'` sentinel, `FunctionArgs` / `UnbrandConvexIds`, `makeConvexQuery`, `lib/convex/data/…`, or the phrase "websocket subscription," read it as *the realtime-backend instantiation of a backend-agnostic pattern* and translate it to your stack:

| You see (the reference) | Read it as |
|---|---|
| Convex websocket subscription | "the read transport" — a realtime socket **or** a cached `fetch` / GraphQL query |
| `'skip'` sentinel | "the disabled-query mechanism" — Convex `'skip'` **or** TanStack `enabled: false` |
| `FunctionArgs` / `FunctionReturnType` / `UnbrandConvexIds` | "types generated from the backend contract" — Convex codegen **or** OpenAPI / GraphQL codegen / shared `zod` schemas |
| `lib/convex/data/<entity>/` | "the entity data slice" — the `convex` path segment is incidental; name it `lib/data/<entity>/` on any other backend |
| `makeConvexQuery` / `makeConvexIdQuery` | "the query-options factory" wrapping your fetcher |

What is **non-negotiable on every backend**: the cache is the source of truth the UI paints from; writes are optimistic with a snapshot + LIFO rollback; a write fans out to every cached copy of the record; you **replace** cache data with the server's response instead of refetching; you never show a spinner over data you already hold; and you persist successful queries to IndexedDB. Section 6 closes with a dedicated subsection — **Optimistic UI without a realtime backend** — that wires this exact engine to a plain REST/GraphQL API. The engine is the product; the database behind it is an implementation detail.

---

## Table of Contents

1. [Philosophy — The Anti-"AI-Vibe" Doctrine](#1-philosophy--the-anti-ai-vibe-doctrine)
2. [Project Architecture, Folder Taxonomy, Naming & Separation of Concerns](#2-project-architecture-folder-taxonomy-naming--separation-of-concerns)
3. [Design Tokens, Color System, Typography & the Restrained Aesthetic](#3-design-tokens-color-system-typography--the-restrained-aesthetic)
4. [Animation, Micro-interactions & Small Details](#4-animation-micro-interactions--small-details)
5. [How Components Are Built — Primitives, CVA Variants, Forms, Dialogs, Composition](#5-how-components-are-built--primitives-cva-variants-forms-dialogs-composition)
6. [Data Layer: Caching, Optimistic Writes, and Persistence for Any Backend](#6-data-layer-caching-optimistic-writes-and-persistence-for-any-backend)
7. [TanStack Router: Layout Splits, Auth Gating, Multi-Layer Warmup & Loading Choreography](#7-tanstack-router-layout-splits-auth-gating-multi-layer-warmup--loading-choreography)
8. [Build + Runtime Performance Optimizations](#8-build--runtime-performance-optimizations)
9. [i18n (English-first, Arabic toggle), RTL-from-day-one, and Accessibility](#9-i18n-english-first-arabic-toggle-rtl-from-day-one-and-accessibility)
10. [Tooling & Discipline: The Quality-Preservation Machine](#10-tooling--discipline-the-quality-preservation-machine)
11. [The Agent Operating Protocol](#11-the-agent-operating-protocol)

---

## 1. Philosophy — The Anti-"AI-Vibe" Doctrine

You are building a clinical system. A doctor will read a lab result off this screen at 2am and act on it. The interface must earn trust the way a precision instrument does: calm, dense, predictable, fast, and utterly free of decoration that does not carry meaning. The single greatest threat to that trust is the default aesthetic of AI-generated frontends — the "AI-vibe" — and your first job is to recognize it on sight and refuse to ship it. Everything else in this manifesto is the positive expression of that refusal.

### What "AI-vibe-coded" means — and why it is banned

"AI-vibe" is the recognizable house style of an LLM left to its own defaults. It optimizes for a flashy first screenshot and collapses under real use: inconsistent spacing, drifting colors, dead code, broken RTL, spinner-flashing on every click. It looks like a demo, not a product. Learn the tells and treat each as a defect:

- Purple/indigo/violet gradients on buttons, headers, and "hero" blocks. A `from-purple-500 to-indigo-600` anywhere is an instant reject.
- Neon glows, `shadow-purple-500/50`, glowing borders, and animated gradient backgrounds.
- Glassmorphism everywhere — `backdrop-blur` frosted panels stacked three deep.
- Rainbow categorical palettes — a different saturated hue per card, per tag, per chart series.
- Arbitrary hex and raw Tailwind palette steps scattered through components: `#4f46e5`, `bg-gray-100`, `text-gray-400`, `bg-slate-50`.
- Random drop-shadows — `shadow-lg`/`shadow-xl`/`shadow-2xl` on every card to fake depth.
- Emoji in the UI and "✨ AI" sparkle spam — sparkles on buttons, rocket emoji in empty states.
- Oversized `rounded-3xl` bubbly cards with huge padding, the "toy app" silhouette.
- 300ms+ bouncy springs with `bounce: 0.5` on every element; everything wobbles.
- Centered-hero everything — every page is a centered column with a big title and a CTA, regardless of whether it is a data screen.
- Default-shadcn sameness — untouched defaults so every AI app looks like the same app.

These are banned not because they are ugly in isolation but because they are *unconsidered*. They signal that no one made a decision. A clinical tool that looks like it was vibe-generated reads as a tool no one is accountable for — and a doctor will not trust it.

#### Anti-pattern (AI-vibe smell)

```tsx
// NEVER — the AI-vibe button
<button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white
  rounded-3xl shadow-xl shadow-purple-500/50 px-8 py-4 hover:scale-105
  transition-all duration-300">
  ✨ Save Patient
</button>
```

```tsx
// CORRECT — calm, token-driven, purposeful
<Button variant="primary" prefixIcon={CheckIcon} loading={isSaving}>
  {t('patients.save')}
</Button>
// bg-primary hover:bg-primary-hover active:bg-primary-active,
// rounded-lg, shadow-xs, transition-all duration-100, focus-visible:ring-0.4
```

### The counter-creed

Replace each tell with a deliberate, system-wide choice. This is what "hand-architected, not scaffolded" feels like.

**One calm primary, no gradients.** The product carries a single flat blue, `#2e6acd`, with discrete `hover` / `active` / `light` tints. No second accent hue, no gradient on UI chrome. Even charts are tints of the one blue (`chart-1..5`), never a categorical rainbow.

**Semantic tokens only — zero raw hex in components.** Every concrete color is defined once as a semantic CSS variable and mapped to a Tailwind utility via `@theme inline`. Components consume the token, never the value.

| Token (Tailwind class)     | Role                                    |
|----------------------------|-----------------------------------------|
| `bg-background-base`       | page canvas (`#ffffff`)                 |
| `bg-background-surface`    | raised panels                           |
| `bg-background-elevated`   | popovers / accents                      |
| `bg-background-muted`      | inset wells                             |
| `bg-primary` / `-hover` / `-active` / `-light` | the one blue + states   |
| `text-text-primary`        | headings/values (`#0a0a0a`)             |
| `text-text-secondary`      | supporting copy (`#525252`)             |
| `text-text-tertiary`       | placeholders/captions (`#737373`)       |
| `text-<state>` + `bg-<state>-bg` + `border-<state>/30` | success/warning/error, state ONLY |

**Near-monochrome neutrals.** Surfaces come from a tight near-white ramp (`#ffffff → #fbfcfe → #f5f5f5 → #e3e9ef`), not from grey palette steps. Three fixed text rungs, never `text-gray-500`.

**Subtle borders over shadows.** Depth comes from the near-white background ramp and `border-border-default`, with at most `shadow-xs`. Radius lives on a 2–15px ramp (`rounded-lg`/`rounded-xl`), never `rounded-3xl`. Drop-shadows do not fake hierarchy.

**Light-mode-only, on purpose.** Dark mode is deliberately removed at boot and `colorScheme` pinned; there are zero `.dark` / `prefers-color-scheme` matches in the source. A half-broken dark mode with forgotten tokens is worse than none.

**Fast, purposeful motion (100–200ms).** Two vocabularies only: over-damped springs (stiffness 400–520, damping 25–38, mass 0.65–0.85) where something physically moves, and short named tweens for fades/scales. Durations cluster: 100ms instant feedback, 150–220ms enter, 130–150ms exit (exit always faster than enter). Use `cubic-bezier(0.16,1,0.3,1)` for enters, `cubic-bezier(0.4,0,1,1)` for exits. Dialogs scale `0.96→1` on enter and shrink only to `0.985` on exit — a settle, not a pop. Reduced-motion is honored at every layer.

**Density appropriate to a professional tool.** This is not a marketing page. No centered-hero layouts on data screens; tables, forms, and panels at a working density. NumberFlow counters use `tabular-nums` and only roll on real value changes (gated by a `hasMounted` ref), never animating up from zero on every load.

**Optimistic, instant interactions.** Every write mutates the cache by hand before the server answers, then reconciles — never spinner-then-refetch. Reads are cache-first — the reference bridges Convex websocket subscriptions into TanStack Query (`staleTime: Infinity`); a request/response backend uses finite stale times with quiet background refetch — so revisiting a screen always paints from cache with no spinner. Each entity owns an `optimistics.ts` with pure apply → replace/rollback functions; rollback is a per-key LIFO snapshot with an identity guard, not a naive clobber.

**RTL and a11y from day one.** Every spatial class is logical (`ms-`/`me-`/`ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`, `text-start`/`text-end`); physical `left`/`right` survives only where the meaning is truly physical. Carets flip with `rtl:rotate-180`. Interactive primitives wrap Radix / Base UI so focus, keyboard, and ARIA are correct — never `<div onClick>` masquerading as a button. Reduced-motion branches in JS where motion is JS-driven.

**Types and dead-code discipline.** Request/response types are derived from the backend's generated contract (the reference uses Convex's `FunctionArgs` / `FunctionReturnType` + `UnbrandConvexIds`; OpenAPI, GraphQL codegen, or shared `zod` schemas do the same job), never hand-written DTOs that drift. `no-explicit-any` is an error; default exports are banned except at lazy boundaries; a `find:unused-*` fleet fails CI on any orphan export, hook, route, dialog, permission, or asset. The wrong thing is made un-mergeable, not merely discouraged.

#### Anti-pattern (AI-vibe smell)

```tsx
// NEVER — refetch-after-mutate (spinner flash) + drifting hand-written DTO
async function onSave(p: { name: string }) {        // invented shape
  await fetch('/api/patients', { method: 'POST', body: JSON.stringify(p) });
  await queryClient.invalidateQueries({ queryKey: ['patients'] }); // flashes
}
```

```ts
// CORRECT — optimistic write, typed off the API, reconcile not refetch
type CreatePatientArgs = UnbrandConvexIds<FunctionArgs<typeof api.patients.create>>;
async function useCreatePatient() { /* applyOptimistic → await → replaceOptimistic / rollback */ }
```

### The Commandments

1. **Thou shalt have one primary, and it is calm.** No gradients on UI chrome. No second accent hue.
2. **No raw hex, no palette steps in components.** Only semantic tokens (`bg-background-surface`, `text-text-tertiary`, `border-border-default`).
3. **Color means state.** Green/amber/red appear only to signal success/warning/error, never as decoration.
4. **Borders before shadows.** Depth from the near-white ramp; `shadow-xs` max; `rounded-lg`/`xl`, never `rounded-3xl`.
5. **No emoji, no sparkles, no "✨ AI" in the UI.** Icons come from the icon set, with `DEFAULT_ICON_PROPS`.
6. **Motion is fast and physical or it does not exist.** 100–220ms tweens; over-damped springs only where something moves; exits faster than enters; honor reduced-motion.
7. **Never spinner-then-refetch.** Mutate the cache optimistically, reconcile with the server result, roll back on throw.
8. **The cache is the product.** Cache-first reads (the reference uses `staleTime: Infinity` with websocket correction; a request/response backend uses finite stale + quiet refetch), zero `pendingComponent` skeletons — pre-warm the destination instead.
9. **Logical properties only.** `ms`/`me`/`ps`/`pe`/`start`/`end`; physical `left`/`right` only for genuinely physical positioning; carets `rtl:rotate-180`.
10. **Wrap headless primitives; never hand-roll interactive HTML.** Radix / Base UI for keyboard + ARIA; `focus-visible:ring-0.4`, not a chunky default ring.
11. **Derive types from the API; never hand-write DTOs.** Server changes must be compile errors.
12. **Dead code is a defect.** No `any`, no stray default exports, no orphan exports — CI must reject them.
13. **The folder layout is the mental model.** Every kind under `common`/`core`/`pages`; every entity a fixed quintet (`queries`/`hooks`/`optimistics`/`types`/`index`).
14. **Light-mode only, on purpose.** No half-broken dark mode; pin `colorScheme` at boot.
15. **If a value is unconsidered, it is wrong.** Every duration, radius, color, and easing is a named decision — never a default left in place.

### Rules

- Reject any gradient, neon glow, glassmorphism, rainbow palette, emoji, or "✨ AI" sparkle on sight.
- Use only semantic tokens; grep your diff for raw hex and `bg-gray-`/`text-gray-`/`slate-` and remove every hit.
- Confine green/amber/red to state; never decorative.
- Cap depth at `shadow-xs` and radius at `rounded-xl`; rely on the near-white background ramp and `border-border-default`.
- Keep motion in the 100–220ms band with named cubic-beziers; springs over-damped (damping 25–38) and only where something physically moves; exits faster than enters.
- Make writes optimistic with per-key rollback; never `invalidateQueries` as a substitute for an optimistic update.
- Ship zero `pendingComponent`/skeleton spinners on routes; pre-warm code, data, and assets so the destination paints populated.
- Use logical Tailwind properties everywhere; reserve physical `left`/`right` for truly physical positioning; flip carets with `rtl:rotate-180`.
- Build interactive primitives on Radix / Base UI; never `<div onClick>`; always real `focus-visible` rings.
- Derive all request/response types from the backend's generated contract (Convex codegen, OpenAPI, GraphQL, or shared `zod` schemas); ban hand-written DTOs and `any`.
- Keep the tree clean: named exports only (default exports at lazy boundaries), and let the `find:unused-*` checks fail CI on any orphan.
- Confirm there are zero `.dark` / `prefers-color-scheme` matches; light-mode is pinned at boot.

---

## 2. Project Architecture, Folder Taxonomy, Naming & Separation of Concerns

The folder layout IS the mental model. Every file lives at the intersection of two axes — a *kind* (component / hook / util / constant / schema / type / store) and a *scope* (`common` / `core` / `pages`) — and that intersection is the only place it may live. Domain data is sliced separately, one fixed-shape folder per entity, so the create-patient optimistic update sits in the exact same relative path as the create-invoice one. Do not scaffold; architect. When you are done, a new engineer must be able to predict the path of any file before opening the tree, and a fleet of `find:unused-*` scripts must agree that nothing is orphaned.

### The two-axis taxonomy: kind x scope

Every non-data file is filed under a *kind* directory, and inside it under exactly one of three *scopes*:

- **`common/`** — reusable primitives used by 2+ features (loading spinner, phone input, data table, stat card).
- **`core/`** — app shell and cross-cutting infrastructure: layout, root providers, error boundaries, command palette, navigation, app header.
- **`pages/`** — feature code, mirroring the route tree (`_app`, `_auth`, `_admin`, `session-replay`).

This identical split recurs under *every* kind, so learning it once teaches it everywhere:

```
src/components/common/   // loading-spinner, phone-input, data-table, stat-card
src/components/core/     // layout.tsx, root-providers.tsx, command-palette, app-header.tsx
src/components/pages/_app/patients/   // patients-table.tsx, age-input.tsx

src/hooks/common/      src/hooks/core/      src/hooks/pages/_app/
src/utils/common/      src/utils/core/      src/utils/pages/_app/
src/constants/common/  src/constants/core/  src/constants/pages/
src/schemas/common/    src/schemas/pages/   src/schemas/routes/
src/@types/common/     src/@types/core/     src/@types/pages/   src/@types/generated/
```

Never invent a fourth top-level scope. Before creating any file, answer both questions explicitly: *which kind?* and *which scope?* If you can't decide between `common` and `pages`, it's `pages` until a second feature consumes it, then it graduates to `common`.

**Anti-pattern (AI-vibe smell):** dumping everything into a flat `src/components/` plus a catch-all `src/lib/` so that the app shell, a reusable button, and a one-off patient table are indistinguishable siblings. You can never tell shell from feature from primitive. Always pick a scope.

### The per-entity data slice quintet

Model every domain entity as a folder `lib/convex/data/<entity>/` (the `convex` segment is incidental to the reference backend — name it `lib/data/<entity>/` on any other stack) containing exactly five files, always in the same shape:

| File | Responsibility |
|------|----------------|
| `queries.ts` | Read query-option *factories* (never raw `useQuery`) |
| `hooks.ts` | The `hooks = {...}` object of `useGetX` / `useCreateX` thin React hooks |
| `optimistics.ts` | Pure cache-mutation + rollback functions |
| `types.ts` | Request/response types derived from the Convex API |
| `index.ts` | A 3-4 line barrel `export *` |

Roughly 35 entities (patients, invoices, visits, treatment-plans, stock, families, expenses, treasury, …) all follow this identical contract, so create/read/optimistic-update for *any* entity is in a predictable file. The barrel is mechanical and is the only place barrels are allowed to exist:

```ts
// lib/convex/data/patients/index.ts
export * from './hooks';
export * from './optimistics';
export * from './queries';
export * from './types';
```

```ts
// patients/queries.ts — query-option factories, never raw useQuery
export const queries = {
  list: makeConvexQuery(convexApi.patients.list, { ids: patientListIds }),
  detail: makeConvexIdQuery(convexApi.patients.get, 'patientId', 'patients')
};
```

```ts
// patients/hooks.ts — thin React hooks over the factories
export const hooks = {
  useGetPatient: (patientId: string, options?: PatientsQueryOptions) => {
    const isEnabled = !!patientId && (options?.enabled ?? true);
    const query = useQuery({ ...patientQueries.detail(patientId, isEnabled) });
    return { ...query, isPending: isEnabled && query.isPending };
  }
};
```

Scaffold the full quintet for a new entity even if some files start tiny. Add a sixth file only when a real concern exists (e.g. `intent-refresh.ts` for invoices); never pre-emptively. The slice is a contract, not a vibe — that consistency is the single biggest signal that a human architected this and a machine did not.

### Types are derived from the backend contract — never hand-written

Derive every request/response type from the backend's generated contract — never hand-author DTOs. The reference uses Convex: `FunctionReturnType<typeof api.x>` for responses and `FunctionArgs<typeof api.x>` for arguments, then strips branded ids with the shared `UnbrandConvexIds<>` mapped type (on REST/GraphQL, use OpenAPI/GraphQL codegen or a shared `zod` schema as the single source of truth instead):

```ts
// patients/types.ts
export type PatientResponse = FunctionReturnType<typeof api.patients.get>;
export type PatientListResponse = FunctionReturnType<typeof api.patients.list>;
export type PatientSummaryItem = PatientSummaryListResponse['data'][number];

export type CreatePatientRequest = UnbrandConvexIds<
  FunctionArgs<typeof api.patients.create>
>;
export type UpdatePatientRequest = Omit<
  UnbrandConvexIds<FunctionArgs<typeof api.patients.update>>,
  'patientId'
>;
```

The client types stay in lockstep with the backend automatically: a shape change on the server becomes a compile error on the client. The frontend `@types` directory itself follows the scope axis (`common` / `core` / `pages`) plus a `generated/` bucket (including `generated/permissions.ts`).

**Anti-pattern (AI-vibe smell):** hand-authoring `interface Patient { id: string; name: string; ... }` in the frontend. It silently drifts from the API the day someone renames a server field, and nothing catches it. Never re-declare server shapes by hand.

### Query-option factories with branded-id mapping

Build query options through `makeConvexQuery` / `makeConvexIdQuery` (both live in `lib/convex/query-options.ts`). Declare which arg fields are branded ids via an `ids` map. The factory normalizes args — sorts keys, drops `undefined` — and returns `'skip'` when `enabled` is false:

```ts
export const queries = {
  list: makeConvexQuery(convexApi.patients.list, {
    ids: { clinicId: 'clinics', familyId: 'families', primaryDentistId: 'dentists' }
  }),
  detail: makeConvexIdQuery(convexApi.patients.get, 'patientId', 'patients')
};
// makeConvexQuery returns a callable with an .args() escape hatch:
export const toPatientListRequestArgs = queries.list.args;
```

Because args are normalized to a canonical, stable shape, query keys are deduplicated and cache hits are reliable — this is *why* caching just works. Never call `convexQuery(...)` ad-hoc inside a component or pass a raw, unsorted arg object to `useQuery`; key-ordering differences will silently produce cache misses and duplicate network traffic.

### Optimistic updates as pure, rollback-returning functions

Optimistic UI is a headline craft feature here, not an afterthought — `patients/optimistics.ts` is ~28KB and `invoices/optimistics.ts` is ~98KB. Write each optimistic update as a standalone `applyOptimisticX(queryClient, ...)` function that mutates the cache and **returns a rollback handle** (or a `{ rollback }` object). The hook calls apply-before, awaits the mutation, then `replaceOptimisticX(...)` on success or `rollback()` in the catch. Keep this cache surgery out of components entirely:

```ts
// hooks.ts usage of optimistics.ts
useCreatePatient: (options) => {
  const queryClient = useQueryClient();
  const createPatient = useConvexMutation(convexApi.patients.create);
  return useConvexMutationRequest({
    mutation: async (body) => {
      const optimisticPatient = applyOptimisticPatientCreate(queryClient, body);
      try {
        const patient = await createPatient(body);
        replaceOptimisticPatientCreate(queryClient, optimisticPatient, patient);
        return patient;
      } catch (error) {
        optimisticPatient.rollback();
        throw error;
      }
    }
  });
}
```

Centralizing the cache mutations as pure functions makes them testable and reusable across hooks.

**Anti-pattern (AI-vibe smell):** skipping optimistic UI entirely (spinner → mutate → refetch), or inlining a fragile `setQueryData` in `onMutate` with no rollback. Instant, rollback-safe mutations are a core quality bar; the apply→await→replace-or-rollback shape is mandatory.

### File naming and exports

Name every file kebab-case: `loading-spinner.tsx`, `mutation-callbacks.ts`. Route files follow the TanStack convention, e.g. `patients_.$patientId.tsx`. Export React components and hook/query bundles as **named** exports; reserve `default` exports strictly for lazy-import boundaries, where you immediately re-map to `{ default: X }`:

```tsx
// pages/_app/patients.tsx
export function PatientsPage() { /* ... */ }

const LazyPatientDialog = lazy(async () => {
  const { PatientDialog } = await import(
    '@/components/dialogts/pages/_app/patients/patients-dialog-patient-dialog'
  );
  return { default: PatientDialog };  // only here is `default` used
});
```

Named exports keep `find:unused-exports` deterministic and refactors greppable; kebab-case avoids Windows case-insensitivity bugs (this is a Windows-developed repo). Default-export-everywhere (the Next.js/AI habit) breaks rename-safety and dead-code detection.

### Imports: the `@/` alias and enforced ordering

Import across the src tree with the `@/` alias. Use relative `./` imports *only* between files of the same data slice (inside `lib/convex/data/<entity>/`), which keeps a slice self-contained and portable. Reach the backend through the dedicated `@convex-be/*` alias — never deep-import the generated output by relative path:

```jsonc
// tsconfig.json paths
"paths": {
  "@convex-be/*": ["./convex-dist/convex/*"],
  "@/*": ["./src/*"],
  "sonner": ["./src/components/ui/sonner.tsx"]  // local wrapper wins over the lib
}
// inside a slice, relative is correct:
import { queries as invoiceQueries } from './queries';
```

Note that `sonner` is re-pointed to a local wrapped component so there is one source of truth for toasts. Import ordering is mechanical, not a matter of taste — `@trivago/prettier-plugin-sort-imports` enforces it, with the scope folders literally encoded in the regex:

```js
// prettier.config.js
importOrder: [
  '^react$', '^react-dom$', '<THIRD_PARTY_MODULES>',
  '^(?:@/(?:assets|components|constants|hooks|pages|routes|stores|utils)(?:/.*|$)|\\.\\.?/.*)$'
],
importOrderSortSpecifiers: true,
importOrderSeparation: false
```

Do not hand-sort imports or hand-group them with blank lines (`importOrderSeparation` is `false`). Let the plugin produce zero-debate, churn-free diffs.

### Routes are thin adapters; pages hold the screen; behavior lives in a page hook

Split every screen into four files with one responsibility each: a **route** (`createFileRoute` wiring shell — component + `validateSearch` + loaders), a **page** (`export function XPage()`, the rendered screen, declarative), a **page hook** (`useXPage()` under `hooks/pages/<scope>/`, holding all state and handlers), and a **search schema** (a Zod validator under `schemas/routes/<scope>/`):

```tsx
// routes/_app/patients.tsx — wiring only
export const Route = createFileRoute('/_app/patients')({
  component: PatientsPage,
  validateSearch: patientsSearchSchema
});

// pages/_app/patients.tsx — screen
export function PatientsPage() {
  const patientsPage = usePatientsPage();  // all behavior in the hook
  return <PatientsTable {...patientsPage} />;
}

// schemas/routes/_app/patients.ts — typed search
export const patientsSearchSchema = createSearchValidator({
  tab: optionalEnumSearchParam(PATIENT_ACTIVITY_FILTER_VALUES),
  filters: optionalString
});
```

**Anti-pattern (AI-vibe smell):** cramming data fetching, search-param parsing, and JSX into one route file. The route ↔ page ↔ page-hook ↔ search-schema separation keeps routing, presentation, and behavior cleanly split and the page component declarative.

### A typed global dialog registry

Model every app-level overlay through a single Zustand store keyed by a `DialogId` union, with a `DialogPayloads` map giving each dialog a typed payload (and an optional `DialogExtras` map for derived state). Open and close via the store, never by threading `isXOpen` / `setXOpen` booleans through component trees. Note the subsystem folder is deliberately named `dialogts` (`components/dialogts`, `@types/.../dialogts`) and is split `common` / `core` / `pages` like everything else:

```ts
export type DialogId =
  | 'commandPalette' | 'createVisit' | 'payment' | 'sendSms' | 'addPatient' /* ... */;

export interface DialogPayloads {
  payment: PaymentDialogPayload;
  sendSms: SendSmsDialogPayload;
  addPatient: undefined;
}
// store exposes a fully-typed API:
open: <T extends DialogId>(id: T, payload?: DialogPayloads[T]) => void;
getData: <T extends DialogId>(id: T) => DialogPayloads[T] | undefined;
```

Centralizing dialogs gives stacking and z-layer management, a top-level submit handler for Enter, and toast-layer sequencing for free — and makes any dialog openable from anywhere (command palette, AI tools) in a type-safe way.

**Anti-pattern (AI-vibe smell):** dozens of local `const [open, setOpen] = useState(false)` with prop-drilled setters and no coordination. Use the central typed registry.

### Centralized route warmup and prefetch

Perceived speed is engineered, not hoped for. Treat preloading as its own subsystem: keep route/asset/query warmup specs in `lib/convex/data/warmup/` (`app-warmup-paths.ts`, `prefetch-query-specs.ts`, `refetch-on-hover.ts`, `idle-route-preload.ts`) and configure the router in `lib/routing/app-router.ts` with infinite stale time plus structural sharing:

```ts
// lib/routing/app-router.ts
export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultStructuralSharing: true,
  defaultStaleTime: Infinity,
  defaultPreloadStaleTime: 0,
  defaultOnCatch: (error) => {
    if (isRecoverableAssetLoadError(error)) void recoverStaleBuild();
    else if (isPermissionError(error)) void router.navigate({ to: '/', replace: true });
  }
});
```

Infinite default stale time + structural sharing + a warmup spec registry (idle preload, hover-refetch, stale-build recovery) are why navigation feels native-fast. Do not inline ad-hoc `prefetch` calls in components.

### Dead code is a failing check

Treat unused exports as build errors. There is a dedicated `find:unused-*` script for *every* kind — exports, utils, constants, schemas, stores, lib, types, hooks, routes, pages, dialogs, permissions, route-warmup (13 in total) — plus a `fix:unused-exports` remover, all wired into `bun run check`:

```jsonc
// package.json scripts (excerpt)
"check": "bun run sync:convex && bun run scripts/check/index.ts",
"find:unused-utils": "bun run scripts/check/tools/find-unused-utils.ts",
"find:unused-hooks": "bun run scripts/check/tools/find-unused-hooks.ts",
"find:unused-dialogs": "bun run scripts/check/tools/find-unused-dialogs.ts",
"fix:unused-exports": "bun run scripts/check/tools/remove-unused-exports.ts"
```

This per-kind tooling is exactly why the taxonomy stays clean over time: the structure is mechanically self-policing. Prune anything flagged.

### Baseline config you must match

| Setting | Value |
|---------|-------|
| `tsconfig` strictness | `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `verbatimModuleSyntax: true` |
| Module resolution / target | `moduleResolution: 'bundler'`, `target: ES2022` |
| Prettier | `tabWidth: 2`, `printWidth: 80`, `singleQuote: true`, `jsxSingleQuote: false`, `trailingComma: 'none'`, `arrowParens: 'always'` |
| shadcn | `'new-york'` style, `baseColor: zinc`, `rsc: false` |
| Icon library | `@phosphor-icons/react` (NOT lucide) |
| i18n | first-class integration (`src/integrations/i18n`) with `en.json` + `ar.json` — bilingual/RTL from day one |
| Router defaults | `defaultStaleTime: Infinity`, `defaultPreloadStaleTime: 0`, `defaultStructuralSharing: true`, `disableGlobalCatchBoundary: true` |

### Rules

- Cross every new file against both axes: choose a *kind* AND a *scope* (`common` / `core` / `pages`) before creating it. Never invent a fourth scope.
- Never create a flat `src/components` or `src/lib` bucket that mixes shell, primitives, and feature code.
- For any new entity, scaffold the full quintet under `lib/convex/data/<entity>/` (`queries`, `hooks`, `optimistics`, `types`, `index`) even if some files start tiny.
- Keep barrels (`export *`) only at the data-slice `index.ts`. Do not sprinkle barrels elsewhere.
- Derive request/response types via `FunctionArgs` / `FunctionReturnType<typeof api.x>` + `UnbrandConvexIds`. Never hand-write DTO interfaces.
- Build query options through `makeConvexQuery` / `makeConvexIdQuery` and declare branded-id fields in the `ids` map. Never call `convexQuery(...)` or pass raw arg objects to `useQuery` in a component.
- Write optimistic updates as pure `applyOptimisticX(queryClient, ...)` functions that return a rollback; call apply → await → replace-or-rollback in the hook. Never inline `setQueryData` in a component or `onMutate`.
- Use named exports; reserve `default` exports strictly for `lazy()` boundaries (then remap to `{ default: X }`).
- Import across folders with `@/...`; use relative `./` only within a single data slice; reach the backend via `@convex-be/*`. Never use long `../../../` chains or deep-import `node_modules`.
- Keep route files to `createFileRoute` wiring; put the screen in `pages/` and behavior in a `useXPage()` hook; validate search with a Zod schema in `schemas/routes/`.
- Register app-level overlays in the typed dialogs store (`DialogId` + `DialogPayloads`) and open them via the store — never local `useState` booleans with prop-drilled setters.
- Configure the router with `defaultStaleTime: Infinity` and a warmup/prefetch registry; never refetch on every navigation or inline ad-hoc prefetch calls.
- Run `bun run check` / `find:unused-*` and delete everything flagged. Treat dead exports as a failing build.
- Name files kebab-case; use `@phosphor-icons/react` not lucide; ship `en` + `ar` locales and RTL from day one.

---

## 3. Design Tokens, Color System, Typography & the Restrained Aesthetic

The reason the reference app reads as a designed product and not a Tailwind demo is restraint encoded as a system. The canvas is deliberately near-monochrome: a white/neutral-grey ramp carrying a single calm blue primary and exactly three text greys, with green/amber/red reserved strictly for state. Color is never written as a literal in a component — raw hex lives in exactly one file, gets named for its intent, and is consumed only as a Tailwind utility. Build the same two-tier system and the discipline becomes automatic; skip it and you get the scattered-grey, gradient-button, rounded-3xl look that screams machine-generated.

### Two-tier token architecture: hex once, semantic everywhere

Every concrete color is defined exactly once as a semantic CSS custom property in a single `:root` block (`colors.css`). A second file maps each variable to a Tailwind color utility via `@theme inline`. Components only ever touch the generated utility (`bg-background-surface`, `text-text-secondary`) — never a hex, never `bg-gray-100`, never `bg-white`.

```css
/* colors.css — the ONLY place raw hex lives */
:root {
  --background-base: #ffffff;
  --background-surface: #fbfcfe;
  --background-elevated: #f5f5f5;
  --background-muted: #e3e9ef;
  --text-primary: #0a0a0a;
  --text-secondary: #525252;
  --text-tertiary: #737373;
  --primary: #2e6acd;
  --border-default: #e5e5e5;
}

/* theme.css — maps semantic var -> Tailwind utility (INLINE so it stays live) */
@theme inline {
  --color-background-surface: var(--background-surface);
  --color-text-secondary: var(--text-secondary);
  --color-primary: var(--primary);
  --color-border: var(--border-default);
}
```

`@theme inline` is load-bearing: it makes the Tailwind color track the *live* CSS variable instead of snapshotting it at build time. That single distinction is what lets the boot script swap the brand color at runtime (`document.documentElement.style.setProperty('--primary', ...)`) and have every `bg-primary` in the app follow. Use plain `@theme` and you freeze the value at build and the runtime theming silently breaks.

The workflow for any new color is fixed and three-step: add a semantic var in `colors.css`, map it in `@theme inline`, consume only the utility. There is no fourth option.

**Anti-pattern (AI-vibe smell):** scattering `#fff`, `bg-gray-50`, `bg-gray-100`, `text-gray-500`, `text-slate-700` across components. That is the tell of a generated UI — dozens of greys with no source of truth, impossible to retheme. The reference app has zero raw hex in components and one semantic set.

### Near-monochrome canvas: a layered background ramp

Express elevation with the named neutral ramp, not with grey palette steps plus a drop shadow. The four values sit intentionally close together so depth is *felt*, not shouted.

| Token | Hex | Use |
|---|---|---|
| `bg-background-base` | `#ffffff` | the page |
| `bg-background-surface` | `#fbfcfe` | raised panels |
| `bg-background-elevated` | `#f5f5f5` | popovers, menus, accents |
| `bg-background-muted` | `#e3e9ef` | inset wells |
| `--background-card` | `rgba(253,253,253,0.15)` | translucent card fill |
| `--background-table-header` | `#f9fafc` | table headers |

```tsx
// card.tsx — raised card uses the translucent card token + a whisper shadow
const cardVariants = cva(
  'group/card text-text-primary flex flex-col rounded-xl border shadow-xs bg-(--background-card)'
);
// popovers/menus use elevated, page uses base:
// --color-popover: var(--background-elevated);
// --color-background: var(--background-base);
```

Depth comes from the ramp, not the shadow. Card shadow is `shadow-xs`; a tooltip is `0 1px 2px rgb(0 0 0 / 0.04), 0 4px 6px -1px rgb(0 0 0 / 0.05)`. Whisper-soft, always.

### One primary blue: a hover/active/light family, never a gradient

There is exactly one accent hue. Its interactive states are baked as discrete tokens so every blue surface in the app shifts identically on hover and press. Never invent a second accent, never reach for a gradient on UI chrome.

| Token | Hex |
|---|---|
| `--primary` | `#2e6acd` |
| `--primary-foreground` | `#ffffff` (contrast-computed at boot) |
| `--primary-hover` | `#2b65c2` |
| `--primary-active` | `#d5e1f5` |
| `--primary-light` | `#eaf0fa` |
| `--secondary` | `#eff7ff` |
| `--secondary-hover` | `#e9f4ff` |
| `--secondary-active` | `#e6f2fe` |
| `--secondary-foreground` | `#0053d9` |

```tsx
// button.tsx primary variant — all states are tokens, no gradient
primary:
  'text-primary-foreground hover:bg-primary-hover active:bg-primary-active bg-primary focus-visible:bg-primary/70 border-transparent',
secondary:
  'text-secondary-foreground active:bg-secondary-active hover:bg-secondary-hover bg-secondary focus-visible:bg-secondary/70 border-secondary',
```

**Anti-pattern (AI-vibe smell):** a purple-to-blue gradient on the primary button and per-component one-off opacity tweaks for hover. The reference app uses one flat calm blue with predefined hover/active/light tokens — consistent across the entire app, zero gradients on chrome.

### Status colors as paired foreground + tint-bg, reserved for state

Green, amber, and red mean something. Use them only for state, and always as the matched trio: saturated foreground, desaturated `-bg` tint, and a faint `/30` border. The result reads as a quiet chip, not a stoplight.

| State | Foreground | Background |
|---|---|---|
| success | `--success #56b550` | `--success-bg #e9f7dc` |
| warning | `--warning #eab308` | `--warning-bg #fefce8` |
| error | `--error #f04842` | `--error-bg #fef2f2` |

```tsx
// badge.tsx — status variants are always foreground + tint-bg + faint border
success: 'border-success/30 bg-success-bg text-success',
warning: 'border-warning/30 bg-warning-bg text-warning',
error:   'border-error/30 bg-error-bg text-error',
default: 'border-primary/30 bg-primary-light text-primary',
```

Never use these hues decoratively. A red divider or a green icon "because it looks nice" destroys the legibility that comes from reserving the hue for meaning. (There are rare non-core hues — `--purple #9333ea`/`--purple-bg #f3e8ff`, `--invitation #8b5cf6`/`--invitation-bg #f5edff` — but they too are paired and reserved; do not multiply them.)

### Three-rung text hierarchy: primary / secondary / tertiary

All body and UI text uses exactly three named greys. Hierarchy comes from the ladder, not from color.

| Rung | Hex | Use |
|---|---|---|
| `text-text-primary` | `#0a0a0a` | headings, values, titles |
| `text-text-secondary` | `#525252` | supporting copy |
| `text-text-tertiary` | `#737373` | placeholders, captions, descriptions |

```tsx
// card.tsx
// CardTitle:       'text-text-primary text-base font-semibold'
// CardDescription: 'text-text-tertiary text-sm font-normal'
// input.tsx inner: 'text-text-primary placeholder:text-text-tertiary'
```

**Anti-pattern (AI-vibe smell):** scattering `text-gray-400`, `text-gray-500`, `text-gray-600`, `text-gray-700`, `text-gray-900` inconsistently across screens. The reference app has exactly three rungs and never deviates.

### Charts are tints of one hue, not a rainbow

For charts, use the predefined `chart-1..5` ramp. Two ramps exist: a blue sequential ramp authored in `colors.css`, and a pure-neutral ramp that `theme.css` actually wires into the Tailwind `--color-chart-*` utilities. Both are single-hue/sequential. Never introduce saturated categorical colors.

```css
/* colors.css: blue sequential ramp */
--chart-1:#2e6acd; --chart-2:#5b8dd8; --chart-3:#88b0e3; --chart-4:#b5d3ee; --chart-5:#d5e1f5;
/* theme.css: neutral ramp used by Tailwind chart utilities */
--color-chart-1:#0a0a0a; --color-chart-2:#404040; --color-chart-3:#737373; --color-chart-4:#a3a3a3; --color-chart-5:#d4d4d4;
```

Sequential single-hue and neutral ramps keep dashboards calm and on-brand. The AI default of five saturated categorical colors (`#ef4444`, `#22c55e`, `#a855f7`...) shatters the restrained look in a single chart.

### Compact radius ramp anchored at 6px

Corners are tight. The whole ramp is small, and the defaults are: controls `rounded-lg` (6px), cards `rounded-xl` (8px), chips/badges/tooltips `rounded-md` (4px). Never hand-pick an arbitrary `border-radius`.

```css
@theme inline {
  --radius: 6px;
  --radius-xs: 2px; --radius-sm: 3px; --radius-md: 4px; --radius-lg: 6px;
  --radius-xl: 8px; --radius-2xl: 10px; --radius-3xl: 11px; --radius-4xl: 15px;
}
// usage: button -> rounded-lg, card -> rounded-xl, badge -> rounded-md
```

**Anti-pattern (AI-vibe smell):** `rounded-2xl`/`rounded-3xl` on every card plus `drop-shadow-lg`. Big radii and big shadows read as a toy. The reference app stays inside a 2–15px ramp and gets depth from the background ramp instead.

### Direction-aware fonts: Geist (LTR) / Tajawal (RTL), swapped by `dir`

RTL is a first-class concern, not an afterthought. Never hardcode `font-family` on a component. Let the body inherit one of two direction-specific stacks, selected by the `dir` attribute on the root. The LTR stack leads with Geist; the RTL stack leads with the self-hosted Tajawal. Both end in the same system fallback chain.

```css
/* base.css */
:root {
  --app-font-family-rtl: 'Tajawal','Amiri','Geist','PT Serif',-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;
  --app-font-family-ltr: 'Geist','PT Serif','Tajawal','Amiri',-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto',sans-serif;
}
:root[dir='rtl'] body { font-family: var(--app-font-family-rtl); text-align: right; }
:root[dir='ltr'] body { font-family: var(--app-font-family-ltr); text-align: left; }
@font-face { font-family:'Tajawal'; src:url('@/assets/fonts/tajawal/Tajawal-Medium.woff2') format('woff2'); font-weight:500; font-display:block; }
```

Self-host the Arabic font (Tajawal `woff2`, weights 400/500/700) with `font-display: block` — that avoids a flash of Latin glyphs rendering inside Arabic UI before the font loads. The body also sets `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale`.

**Anti-pattern (AI-vibe smell):** one Latin font hardcoded on components, Arabic/RTL ignored or broken. The reference app swaps the entire font stack on the `dir` attribute and self-hosts the RTL face.

### Fluid type scale driven by one `--font-scale` multiplier

Drive every font size off the `text-*` utilities. Each step is `calc(<rem> * var(--font-scale))` with a paired line-height, so a single accessibility multiplier scales the whole ramp. The boot script reads the user's preference and sets `[data-font-size]` on `<html>` — global text-sizing for free.

```css
@theme { --text-md: calc(0.9375rem * var(--font-scale)); --text-md--line-height: calc(1.35 / 0.9375); }
:root { --font-scale: 1;
  --text-sm: calc(0.875rem * var(--font-scale)); --text-sm--line-height: calc(1.25 / 0.875);
  --text-base: calc(1rem * var(--font-scale)); --text-base--line-height: calc(1.5 / 1);
}
[data-font-size='small']  { --font-scale: 0.9; }
[data-font-size='large']  { --font-scale: 1.1; }
```

The ramp (× `--font-scale`): `xs` .75rem, `sm` .875rem, `md` .9375rem (custom in-between body size), `base` 1rem, `lg` 1.125rem, `xl` 1.25rem, `2xl` 1.5rem, `3xl` 1.875rem, `4xl` 2.25rem, `5xl` 3rem. `--font-scale` is 0.9 / 1 / 1.1 for small / medium / large.

**Anti-pattern (AI-vibe smell):** hardcoded `text-[14px]` with no global scaling. That breaks the accessibility ramp and the RTL font swap at once.

### Runtime-themeable primary with WCAG-aware foreground, computed before paint

Keep `--primary` swappable. If users can pick a brand color, compute `--primary-foreground` from contrast — never assume white text. The inline boot script in `index.html` runs before React mounts (so there is no flash), validates the saved hex with a strict regex, sets `--primary`, and derives the foreground via WCAG relative-luminance contrast.

```ts
// index.html boot script
function contrastForeground(hex){
  const v=hex.replace('#',''); const r=parseInt(v.slice(0,2),16)/255,g=parseInt(v.slice(2,4),16)/255,b=parseInt(v.slice(4,6),16)/255;
  const toLin=c=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  const L=0.2126*toLin(r)+0.7152*toLin(g)+0.0722*toLin(b);
  return 1.05/(L+0.05)>=3 ? '#ffffff' : '#000000';
}
document.documentElement.style.setProperty('--primary', primaryColor);
document.documentElement.style.setProperty('--primary-foreground', contrastForeground(primaryColor));
```

Validate the hex against `/^#[0-9a-fA-F]{6}$/` and fall back to the default `#2e6acd` if it fails. This is exactly the detail AI builds skip — they hardcode white-on-primary and the button text vanishes the moment a user picks a light brand color.

### Light-mode-only, by deliberate decision

Do not add a `.dark` variant, `prefers-color-scheme`, or `data-theme` switching. This product ships one light theme. A repo-wide grep for `.dark` / `prefers-color-scheme` / `data-theme` returns zero matches in source. The boot script actively strips the dark class and pins the color scheme.

```ts
// index.html boot script
document.documentElement.classList.remove('dark');
document.documentElement.style.colorScheme = 'light';
```

Committing to one theme is a craft choice: it halves the surface area you must keep consistent and avoids the half-broken dark mode AI scaffolds (unreadable contrast, forgotten tokens). If dark is ever needed, it is a deliberate second `:root` block — never an automatic `prefers-color-scheme` toggle. PWA `theme-color` is `#ffffff`.

### Thin neutral scrollbars and on-brand selection

Style scrollbars globally to 6px with a `border-default` thumb (3px radius) on a transparent track, and tie `::selection` to the primary token so even text highlight is on-brand. Provide a `hide-scrollbar` utility and a `scrollbar-hidden` variant that only reveals the thumb on hover.

```css
/* base.css */
* { scrollbar-width: thin; scrollbar-color: var(--color-border-default) transparent; }
*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-thumb { background-color: var(--color-border-default); border-radius: 3px; }
/* styles.css base layer */
::selection { background-color: var(--primary); color: var(--primary-foreground); }
```

These are the small signals of hand-craft. AI builds leave default chunky OS scrollbars and the browser-default blue selection.

### Effects derive from tokens via `color-mix`, not literal rgba

When you need glows, pulses, or shimmers, derive the color from the token with `color-mix(in srgb, var(--primary) N%, transparent)`. Effects then follow the themeable primary automatically and never drift off-palette.

```css
/* nprogress.css */
#nprogress .bar {
  background: color-mix(in srgb, var(--primary) 50%, transparent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--primary) 50%, transparent), 0 0 5px color-mix(in srgb, var(--primary) 50%, transparent);
}
/* animations.css highlight-pulse */
box-shadow: 0 0 0 5px color-mix(in srgb, var(--primary) 12%, transparent), 0 0 22px 4px color-mix(in srgb, var(--primary) 18%, transparent);
```

**Anti-pattern (AI-vibe smell):** `box-shadow: 0 0 20px rgba(168,85,247,.6)` and hardcoded neon rgba glows. The reference app's effects are built from the token, so a retheme carries them along and nothing ever goes off-brand.

### shadcn baseColor zinc, but every token overridden

You may adopt shadcn's component contracts and CSS-variable names (`--color-popover`, `--color-ring`, `--color-destructive`, `data-slot` attributes), but remap all of them onto your semantic tokens. Never ship the stock zinc/neutral shadcn palette — that is instantly recognizable as default scaffolding.

```ts
// components.json
{ "style": "new-york", "baseColor": "zinc", "tailwind": { "cssVariables": true }, "iconLibrary": "@phosphor-icons/react" }
// theme.css — shadcn names remapped to your tokens
--color-popover: var(--background-elevated);
--color-ring: var(--primary);
--color-destructive: var(--error);
--color-muted-foreground: var(--text-secondary);
```

This gives you shadcn's ergonomics without the recognizable default look. Icons are `@phosphor-icons/react` with the `duotone` weight as the default — not lucide.

### Rules

- Define every color once as a semantic var in `colors.css`, map it via `@theme inline` in `theme.css`, and consume only the Tailwind utility. Never write raw hex, `bg-white`, `bg-gray-*`, or `text-slate-*` in a component.
- Use `@theme inline` (not `@theme`) for color mappings so utilities track the live CSS variable and runtime theming works.
- Express elevation with the `base/surface/elevated/muted` background ramp, not arbitrary greys plus shadows. Keep shadows whisper-soft (`shadow-xs`).
- Keep exactly one primary blue; use its `hover`/`active`/`light` tokens for all interactive states. No second accent hue, no gradients on UI chrome.
- Use `success`/`warning`/`error` strictly for state, always as the `text-<state>` + `bg-<state>-bg` + `border-<state>/30` trio. Never decoratively.
- Restrict all text to `text-text-primary` / `-secondary` / `-tertiary`. No ad-hoc grey steps.
- Default controls to `rounded-lg`, cards to `rounded-xl`, chips/tooltips to `rounded-md`. Stay inside the 2–15px ramp; no `rounded-2xl`/`3xl`/`full` on cards and inputs.
- Switch fonts via `:root[dir]`; self-host the Arabic (Tajawal) `woff2` with `font-display: block`. Never hardcode `font-family` on a component.
- Drive all font sizes off the `text-*` utilities so the global `--font-scale` accessibility multiplier works. Never hardcode px sizes.
- Compute `--primary-foreground` from WCAG contrast at boot, validate the hex with `/^#[0-9a-fA-F]{6}$/`, and fall back to `#2e6acd`. Never assume white-on-primary.
- Stay light-mode-only: no `.dark`, no `prefers-color-scheme`, no `data-theme`. Strip the dark class and pin `colorScheme = 'light'` at boot.
- Build glows/pulses/shimmers with `color-mix(in srgb, var(--primary) N%, transparent)`. No literal neon rgba box-shadows.
- Use the `chart-1..5` sequential blue or neutral ramp for charts. Never saturated categorical rainbow colors.
- Style scrollbars to 6px with a `border-default` thumb and 3px radius; set `::selection` to the primary token.
- When using shadcn, remap every shadcn CSS var onto your token and keep `@phosphor-icons/react` (duotone) over lucide.

---

## 4. Animation, Micro-interactions & Small Details

Motion here is fast, physical, and purposeful. It confirms an action or guides the eye — it never decorates. Use exactly two motion vocabularies: springs ONLY where something physically moves or slides, and short tweens (100–250ms) with named cubic-beziers for fades, scales, and overlays. The result reads "alive but calm": nothing bounces gratuitously, springs are critically/over-damped (damping 25–38, no visible overshoot), exits are always faster than enters so dismissal feels snappy, and reduced-motion is a designed branch at every layer — not an afterthought.

The library is `motion/react` (Motion v11+, the successor to Framer Motion). Use it for layout, presence, and physical movement only. Everything cheap and stateless — hovers, focus rings, color/opacity transitions — stays in CSS via Tailwind `transition-*` with tuned durations.

```ts
import { motion, AnimatePresence, useReducedMotion, useAnimation, animate } from 'motion/react';
```

### Two vocabularies, never more

Durations cluster tightly. Do not ship a single global `300ms ease` for everything — tier it:

| Tier | Duration | Use |
|------|----------|-----|
| Instant feedback | 100ms | button base state, input icon swap |
| Enter | 150–220ms | dialog/overlay/banner enter |
| Exit | 130–150ms | always faster than the matching enter |
| Content tween | 200–250ms | icon crossfade, tooltip size |

Named cubic-beziers — learn these four and reuse them:

| Easing | Name | Use |
|--------|------|-----|
| `cubic-bezier(0.16,1,0.3,1)` | gentle landing | all enters |
| `cubic-bezier(0.4,0,1,1)` | fast out | all exits |
| `cubic-bezier(0.22,1,0.36,1)` | EASE_OUT_QUINT | strong decel motion |
| `cubic-bezier(0.4,0,0.2,1)` | collapse | input/sidebar collapse |

Spring catalog — keep these in named consts and reuse them. Never invent per-component magic numbers. Every one is over-damped (damping 24–38); none has positive overshoot.

| Const | Spring | Where |
|-------|--------|-------|
| `SPRING_TRANSITION` | `{stiffness:400, damping:25, mass:0.8}` | button spinner width slide |
| `INDICATOR_TRANSITION` | `{stiffness:500, damping:35}` | tab indicator |
| `SLAB_SPRING` | `{stiffness:520, damping:38, mass:0.85, opacity:{duration:0.15}}` | floating list slab |
| AI voice input | `{stiffness:520, damping:32, mass:0.65}` | voice input button |
| Voice 3D input | `{stiffness:190, damping:24, mass:1.05}` | 3D voice transition |
| Tooltip size | `{bounce:0, duration:0.25}` | tooltip resize |
| session-recording | `{stiffness:300, damping:25}` | recording overlay |

### Canonical button spring (width that pushes)

The inline loading spinner slides in by animating `width: 0 → auto`. Spring it — never animate width with a duration tween. A spring on width reads as the spinner physically making room and pushing the label sideways; a linear width tween looks like a glitch. `damping:25` against `stiffness:400` is over-damped enough that it never overshoots the text layout.

```tsx
const SPRING_TRANSITION = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 0.8
} as const;

const SPINNER_SLIDE_VARIANTS = {
  initial: { width: 0, opacity: 0, scale: 0.5 },
  animate: { width: 'auto', opacity: 1, scale: 1 },
  exit: { width: 0, opacity: 0, scale: 0.5 }
} as const;

<AnimatePresence mode="wait" initial={false}>
  {showInlineSpinner && (
    <motion.span
      key="inline-spinner"
      className="flex items-center justify-center overflow-hidden"
      variants={SPINNER_SLIDE_VARIANTS}
      initial="initial" animate="animate" exit="exit"
      transition={SPRING_TRANSITION}
    >
      <LoadingSpinner size="xxs" removePadding color={resolvedSpinnerColor} />
    </motion.span>
  )}
</AnimatePresence>
```

### Prefix-icon → spinner crossfade (zero layout shift)

When a button already has a prefix icon, do NOT add a second spinner. Swap the icon for the spinner in place via `AnimatePresence` with a pure-opacity crossfade over `0.2s easeInOut`, both stacked `absolute inset-0`. This keeps button width perfectly stable during loading, and the icon morphing into a spinner reads as "this exact action is working" rather than a generic global spinner. Opacity-only avoids the jitter that scale or position cause on small glyphs.

```tsx
const PREFIX_ICON_SWAP_VARIANTS = {
  initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }
} as const;
const PREFIX_ICON_SWAP_TRANSITION = { duration: 0.2, ease: 'easeInOut' } as const;

<AnimatePresence initial={false}>
  {showPrefixSpinner ? (
    <motion.span key="spinner" className="absolute inset-0 flex items-center justify-center"
      variants={PREFIX_ICON_SWAP_VARIANTS} initial="initial" animate="animate" exit="exit"
      transition={PREFIX_ICON_SWAP_TRANSITION}>
      <LoadingSpinner size="xxs" removePadding />
    </motion.span>
  ) : (
    <motion.span key="icon" className="absolute inset-0 flex items-center justify-center"
      variants={PREFIX_ICON_SWAP_VARIANTS} initial="initial" animate="animate" exit="exit"
      transition={PREFIX_ICON_SWAP_TRANSITION}>
      {renderIcon(prefixIcon, prefixIconProps)}
    </motion.span>
  )}
</AnimatePresence>
```

### Haptics on pointer-down (touch/pen only)

Fire a light haptic in `onPointerDown`, not `onClick` — pointer-down feels instant because click only fires after release. Gate it to `pointerType` `'touch' | 'pen'`, `button === 0`, and not `defaultPrevented`/`disabled`/`loading`, so mouse clicks never buzz. iOS Safari has no `navigator.vibrate`, so route iOS through a hidden `<input switch>` label click; Android uses `navigator.vibrate` with tuned millisecond pulses. Pulses are deliberately tiny so taps feel crisp, not alarming.

```ts
const TAP_PULSE_MS = { light: 25, medium: 40, selection: 20 };

export function hapticFromPointerEvent(event) {
  if (event.defaultPrevented || event.button !== 0 ||
      (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
  hapticTap('light');
}

// in Button:
onPointerDown={(e) => {
  onPointerDown?.(e);
  if (e.defaultPrevented || disabled || loading) return;
  hapticFromPointerEvent(e);
}}
```

Haptic pulse table (ms): `light 25`, `medium 40`, `selection 20`, `drag-pick 30`, `commit [30,35,35]`, `voice-start 65`, `voice-end [42,48,100]`.

### Hover/active/focus-visible is CSS's job (base 100ms)

Never reach for the motion library for hover, focus, or active. State feedback must be near-instant and GPU-cheap; 100ms is the sweet spot where it feels reactive but not jumpy. Express states with Tailwind variant classes on the root, distinct semantic background tokens (`bg-primary-hover`, `bg-primary-active`) instead of opacity hacks so states stay legible in both themes and RTL, and a thin `focus-visible:ring-0.4` — not a chunky default ring.

```tsx
const buttonVariants = cva(
  'relative flex gap-x-2 full-center group rounded-lg outline-none focus-visible:ring-0.4 cursor-pointer transition-all border border-transparent duration-100 overflow-hidden',
  { variants: { variant: {
    primary: 'text-primary-foreground hover:bg-primary-hover active:bg-primary-active bg-primary focus-visible:bg-primary/70 border-transparent',
    ghost: 'hover:text-secondary-foreground hover:bg-secondary active:bg-secondary-active focus-visible:bg-secondary',
  }}});

// link variant gets opacity instead of bg:
isLinkVariant && 'transition-opacity duration-150'
```

CSS state-transition durations to standardize on: button base `transition-all duration-100`; link `transition-opacity duration-150`; input variant `transition-all duration-200 ease-out`; input icon `transition-all duration-100`; floating-slab colors `transition-colors duration-200`.

### Dialogs animate in CSS, not JS

Animate dialogs with named CSS keyframes triggered by `data-state` — do not mount the motion runtime for every modal. Content scales `0.96 → 1` on enter (barely perceptible — it reads as "settling into place", not the AI-default "pop in from 0.8 with a bounce") and `1 → 0.985` on exit (a tiny shrink, not a collapse). The overlay is pure opacity. Exits are intentionally faster and barely-scaling so dismissal feels immediate, not draggy.

```css
/* animations.css */
@keyframes dialog-content-enter {
  from { opacity: 0; scale: 0.96; }
  to   { opacity: 1; scale: 1; }
}
@keyframes dialog-content-exit {
  from { opacity: 1; scale: 1; }
  to   { opacity: 0; scale: 0.985; }
}
```

```tsx
/* dialog.tsx className */
'data-[state=open]:animate-[dialog-content-enter_220ms_cubic-bezier(0.16,1,0.3,1)_both]'
'data-[state=closed]:animate-[dialog-content-exit_150ms_cubic-bezier(0.4,0,1,1)_both]'
'data-[state=open]:animate-[dialog-overlay-enter_180ms_cubic-bezier(0.16,1,0.3,1)_both]'
'data-[state=closed]:animate-[dialog-overlay-exit_130ms_cubic-bezier(0.4,0,1,1)_both]'
```

Durations: overlay enter `180ms` / exit `130ms`; content enter `220ms` / exit `150ms`. Overlay is always `bg-black/40 backdrop-blur-[2px]`. The drawer (vaul) follows the same overlay recipe with `noBodyStyles` + tailwindcss-animate `animate-in/animate-out fade-in-0/fade-out-0`, and a drag handle `h-1.5 w-12 rounded-full bg-foreground/20`.

**Anti-pattern (AI-vibe smell):** dialog pops in with `scale: 0.8 → 1` plus a spring bounce. That announces the modal like a toy. The correct settle is `0.96 → 1`, exit shrinks only to `0.985` over `150ms`, and the overlay never scales — it only fades.

### Route progress bar with a 400ms suppression delay

Drive the top nprogress bar from TanStack Router navigation state, but only start it after a `400ms` `setTimeout` so instant navigations never flash a bar. Showing a loading bar for a sub-100ms route change is visual noise that makes a fast app feel busy; the gate means the bar only appears when there is real waiting. `minimum: 0.15` starts it already 15% full so it never looks stuck at zero.

```ts
const PROGRESS_DELAY_MS = 400;
NProgress.configure({ showSpinner: false, minimum: 0.15, trickleSpeed: 200 });

useEffect(() => {
  if (!isNavigating) return;
  const timerId = setTimeout(() => NProgress.start(), PROGRESS_DELAY_MS);
  return () => { clearTimeout(timerId); NProgress.done(); };
}, [isNavigating]);
```

```css
/* nprogress.css */
#nprogress .bar {
  background: color-mix(in srgb, var(--primary) 50%, transparent);
  height: 2px;
}
[dir='rtl'] #nprogress .bar { scale: -1 1; }
```

The bar is 2px tall, derives its color from `--primary` via `color-mix`, and mirrors for RTL with `scale: -1 1`.

### Animated tab indicator: measured spring, instant on resize

Animate the active-tab pill/underline by measuring rects and springing `x/y/width/height` with `INDICATOR_TRANSITION` `{stiffness:500, damping:35}`. A measured spring makes the indicator feel like one continuous object gliding between tabs — the single most "premium" tab detail. Use `initial={false}` so it never plays an entrance animation. Switch the transition to `{duration:0}` when the change came from a `ResizeObserver` (layout reflow) rather than a user selection — otherwise the indicator lazily slides on window/container reflow, which looks broken. Add a press-preview that slides the indicator toward a pressed-but-not-yet-active tab for sub-100ms anticipation, cancelled if the pointer moves more than 10px.

```tsx
const INDICATOR_TRANSITION = { type: 'spring' as const, stiffness: 500, damping: 35 };

<motion.div
  initial={false}
  animate={{ x: pos.left, y: variant==='underline' ? -pos.bottom : pos.top,
             width: pos.width, height: variant==='underline' ? undefined : pos.height }}
  transition={shouldAnimate && pressPreviewEnabled ? INDICATOR_TRANSITION : { duration: 0 }}
  data-slot="tab-indicator"
/>
```

### Floating list slab (a highlight that glides)

For a moving highlight behind list rows, render ONE absolutely-positioned `motion.div` and spring its `top/height` between rows. Do not transition per-row backgrounds. A single shared slab that springs between rows feels like a physical token following the cursor — far classier than per-row background transitions. Keep `opacity:{duration:0.15}` separate from the position spring so appearance/disappearance stays crisp while motion stays springy; `mass:0.85` gives it just enough weight to feel deliberate. Support an `instantTransition: {duration:0}` for jumps that shouldn't animate.

```tsx
const SLAB_SPRING = {
  type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.85,
  opacity: { duration: 0.15 }
};
<motion.div initial={false}
  animate={{ top: slab.layout.top, height: slab.layout.height, opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={slab.instantTransition ? { duration: 0, ease: 'linear' } : SLAB_SPRING}
/>
```

### Animated numbers, gated to skip first paint

Wrap `@number-flow/react` with a default-on `animated` prop. In usage, hold a `useRef(false)` "hasMounted" flag and pass `animated={hasMounted.current}` so numbers do NOT animate on initial mount — animating from 0 on first render is the classic AI tell; it draws attention to load instead of change. Gating on mount means digits only roll when a value genuinely transitions (live sales totals, etc.), which is the actual signal worth showing. Always pair with `tabular-nums` to prevent width jitter, and an explicit `Intl` format.

```tsx
const CURRENCY_FORMAT: Format = { style:'currency', currency:'ILS', currencyDisplay:'symbol', minimumFractionDigits:2, maximumFractionDigits:2 };

const hasMounted = useRef(false);
const shouldAnimate = hasMounted.current;
if (!hasMounted.current) hasMounted.current = true;

<NumberFlow value={card.value} format={CURRENCY_FORMAT} animated={shouldAnimate} className="tabular-nums" />
```

Gate reduced-motion through NumberFlow's `useCanAnimate()`.

### Text shimmer for AI "thinking"

Signal AI working states with a CSS `background-clip: text` shimmer — a moving light band across the text — driven by CSS custom props (`--shimmer-duration`, `--shimmer-bg-size`). A slow text shimmer says "AI is working" without a spinner or fake progress bar: calm, ambient, on-brand. Do it in CSS so it costs no JS. Expose an `active` prop to fall back to plain text, and ALWAYS disable the keyframe under `prefers-reduced-motion` in the same file.

```css
/* prompt-kit.css */
.text-shimmer {
  --text-shimmer-bg-size: var(--shimmer-bg-size, 280%);
  background-image: linear-gradient(90deg, var(--text-tertiary) 0%, var(--text-secondary) 42%,
    color-mix(in srgb, var(--text-secondary) 35%, var(--background-base)) 50%,
    var(--text-secondary) 58%, var(--text-tertiary) 100%);
  background-size: var(--text-shimmer-bg-size) 100%;
  -webkit-background-clip: text; background-clip: text;
  animation: text-shimmer var(--shimmer-duration, 2.5s) linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .text-shimmer, .text-shimmer-reverse { animation: none; background-position: 0% center; }
}
```

```tsx
<TextShimmer active spread={28} duration={2.2} className="text-sm">{label}</TextShimmer>
```

The component sets `--shimmer-bg-size` to `220 + spread*2 %`; live AI status uses `duration 2.2s`, `spread 28`.

### Ambient cues: scroll-hint and one-shot highlight-pulse

Use named utility keyframes for tiny ambient signals. A `4px` chevron nudge (`animate-scroll-hint-{left,right,up,down}`, opacity `0.72 ↔ 1` over `1.6s ease-in-out infinite`) at the edge of a scrollable strip tells users "there's more" without a scrollbar or hard arrow button. `animate-highlight-pulse` is a one-shot, self-terminating glow (`2s ease-out`, box-shadow ring built from `color-mix(--primary)`, ending at fully transparent) that confirms "this is the thing you came for" then gets out of the way — versus an AI-default permanent colored border.

```css
@keyframes scroll-hint-right {
  0%, 100% { transform: translateX(0);   opacity: 0.72; }
  50%      { transform: translateX(4px); opacity: 1; }
}
@keyframes highlight-pulse {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 42%, transparent),
                     0 0 14px 1px color-mix(in srgb, var(--primary) 24%, transparent); }
  50%  { box-shadow: 0 0 0 5px color-mix(in srgb, var(--primary) 12%, transparent),
                     0 0 22px 4px color-mix(in srgb, var(--primary) 18%, transparent); }
  100% { box-shadow: 0 0 0 0 transparent, 0 0 0 0 transparent; }
}
.animate-highlight-pulse { animation: highlight-pulse 2s ease-out; }

// usage: <CaretRightIcon className="... animate-scroll-hint-right" />
```

An `upload-arrow-float` (translateY `5px ↔ 2px`, `2.2s ease-in-out infinite`) follows the same ambient-hint recipe.

### System overlays: small directional fades

For transient banners and blocking overlays, use motion with tiny offsets and a flat `0.2s` duration. A banner animates from the direction it lives — the offline banner does `{opacity:0, y:-8} → {opacity:1, y:0}`, sliding down from the top edge it is attached to. Blocking full-screen overlays do pure `{opacity:0} → {opacity:1}`. Wrap in `AnimatePresence` so the exit plays, and respect safe-area insets in the className. Keeping system-state changes (offline/online) to `0.2s` opacity / `8px` keeps them calm and non-alarming.

```tsx
<AnimatePresence>
  {connectionIssue && (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none fixed inset-x-0 top-0 z-100 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto w-full max-w-lg"><OfflineStatusBanner /></div>
    </motion.div>
  )}
</AnimatePresence>
```

### Reduced-motion is a designed branch, not `animation:none`

Anywhere an animation is large or 3D, call `useReducedMotion()` and supply a dedicated reduced variant. True high-craft means the reduced-motion path is designed: the 3D voice-input exit (rotateX/Y/Z + z-translate + scale) would be nauseating for motion-sensitive users, so it is swapped for a flat `{y:48, opacity:0}` that still communicates the same state change.

```tsx
const reducedMotion = useReducedMotion();
const inputMotionState = aiAssistantLiveVoiceModeActive
  ? reducedMotion ? VOICE_MODE_INPUT_REDUCED_MOTION_EXIT : VOICE_MODE_INPUT_EXIT
  : reducedMotion ? VOICE_MODE_INPUT_REDUCED_MOTION_VISIBLE : VOICE_MODE_INPUT_VISIBLE;

export const VOICE_MODE_INPUT_REDUCED_MOTION_EXIT = { y: 48, opacity: 0 };
export const VOICE_MODE_INPUT_EXIT = { y:148, z:-132, rotateX:52, rotateY:-16, rotateZ:7, scale:0.72, opacity:0 };
```

Disable text-shimmer keyframes in CSS; gate NumberFlow via `useCanAnimate()`; supply a flat fade for every 3D/large animation.

### High-frequency feedback: rAF + inline style, skip React

For high-frequency hover feedback — a segmented progress bar brightening with a follow tooltip — bypass React state entirely. Re-rendering on every `mousemove` drops frames; mutate the DOM inside `requestAnimationFrame` with very short CSS transitions (filter `75ms ease-out`, opacity `50ms ease-out`) so it stays buttery and the tooltip feels attached to the cursor. Portal the tooltip to `document.body`.

```ts
const rafIdRef = useRef(0);
const handleMouseMove = useCallback((e, segment, barEl) => {
  cancelAnimationFrame(rafIdRef.current);
  rafIdRef.current = requestAnimationFrame(() => {
    barEl.style.filter = 'brightness(1.25)';
    const el = tooltipRef.current; if (!el) return;
    el.style.left = `${e.clientX}px`;
    el.style.top = `${e.clientY - 32}px`;
    el.style.opacity = '1';
  });
}, []);
// bar: style={{ transition: 'filter 75ms ease-out' }}
// tooltip: style={{ opacity: 0, transition: 'opacity 50ms ease-out' }}
```

### Loading primitives

Keep loading primitives boring and consistent. Skeletons are `bg-accent animate-pulse rounded-md` — Tailwind's built-in pulse, no custom shimmer. The `LoadingSpinner` is a Phosphor `SpinnerIcon` + `animate-spin` (size `xxs = size-5`). Glows and rings in motion always derive from CSS variables via `color-mix(in srgb, var(--primary) N%, transparent)` so they stay on-theme in light and dark and never hardcode a hex or neon gradient.

### Rules

- Use `motion/react` (Motion v11+), NOT `framer-motion`. Reserve springs for things that physically move/slide; use CSS for hover/active/focus/color/opacity.
- Keep canonical springs in named consts (`SPRING_TRANSITION`, `SLAB_SPRING`, `INDICATOR_TRANSITION`) and reuse them — no per-component magic numbers.
- Keep all UI springs over-damped (damping 24–38). Never put positive overshoot/bounce on a UI spring.
- Tier durations: 100ms instant / 150ms / 180–220ms enter / 250ms content. Never one global 300ms ease.
- Make every exit faster than its enter (≈130–150ms exit vs 180–220ms enter); `cubic-bezier(0.16,1,0.3,1)` in, `cubic-bezier(0.4,0,1,1)` out.
- Spring the button spinner's width so it pushes the label; crossfade prefix-icon ↔ spinner with opacity only (zero layout shift); never add a second spinner.
- Fire haptics in `onPointerDown`, gated to touch/pen + button 0, with the iOS hidden-switch fallback. Never on mouse clicks or in `onClick`.
- Animate dialogs in CSS keyframes by `data-state`: content `0.96 → 1` enter / `1 → 0.985` exit, overlay opacity-only. Never `0.8 → 1` with a bounce.
- Delay the route progress bar `400ms` so fast navigations never flash it; 2px, `--primary` via `color-mix`, `showSpinner:false`, RTL `scale:-1 1`.
- Use a measured spring for the tab indicator with `initial={false}`; switch to `{duration:0}` on ResizeObserver-driven changes.
- Use one shared springing slab for list highlights, not per-row background transitions.
- Gate NumberFlow / entrance animations behind a `hasMounted` ref so values never animate from zero on first paint; pair with `tabular-nums`.
- Use a CSS `background-clip:text` shimmer (~2.2s linear) for AI "thinking", never an emoji or bouncing GIF.
- Design a reduced-motion variant (a flat fade) for every large/3D animation; add `@media (prefers-reduced-motion: reduce){animation:none}` for CSS keyframes. Never ignore or fake it.
- Build all motion colors/glows from `color-mix(in srgb, var(--primary) N%, transparent)`; never hardcode hex or neon gradients.
- For high-frequency cursor feedback, mutate the DOM in `requestAnimationFrame` with sub-100ms CSS transitions; never re-render React on `mousemove`.

---

## 5. How Components Are Built — Primitives, CVA Variants, Forms, Dialogs, Composition

Components are headless-primitive-wrapped, token-driven, and composition-first. Every interactive primitive is a thin styled wrapper over a headless library — never raw HTML reinvented. Every variant is a `cva()` recipe keyed to semantic tokens — never raw hex. Every element carries a `data-slot` for styling and targeting. And props are `React.ComponentProps<'el'> & VariantProps<typeof xVariants>` so the full native surface stays available. The hard-to-get-right behavior — focus restoration, RTL, mobile-vs-desktop rendering, optimistic mutations, Enter-to-submit across stacked layers, haptics — lives in shared primitives and hooks so leaf code stays declarative. You will build this way too.

### The cva() recipe is the unit of a styled primitive

Define every styled primitive with a single `cva(BASE, { variants, compoundVariants, defaultVariants })` call. There is one source of truth per component: the base string carries the invariant layout/reset, `variants` carry the axes (variant, size, layout, roundness, disabled), `compoundVariants` carry cross-axis cases without conditional spaghetti, and `defaultVariants` carry the fallbacks. Type the props as the native element props intersected with `VariantProps`, and resolve classes with `cn()` so the caller's `className` resolves last and wins.

```tsx
const buttonVariants = cva(
  'relative flex gap-x-2 full-center group rounded-lg outline-none focus-visible:ring-0.4 cursor-pointer transition-all border border-transparent duration-100 overflow-hidden',
  {
    variants: {
      variant: {
        primary:
          'text-primary-foreground hover:bg-primary-hover active:bg-primary-active bg-primary focus-visible:bg-primary/70 border-transparent',
        // default, secondary, outline, ghost, destructive, success,
        // lightDestructive, emptyDestructive, link, pagination,
        // paginationActive, input ...
      },
      size: { sm: 'h-8 px-2 text-sm gap-x-1.5', lg: 'py-2 px-4 text-sm h-9', lgTall: 'py-2 px-4 text-sm h-10' },
      layout: { full: 'w-full', grow: 'flex-1', dialogAction: 'min-w-18 flex-1' },
      disabled: { true: 'opacity-50 pointer-events-none' },
      roundness: { default: 'rounded-lg', full: 'rounded-full' },
    },
    compoundVariants: [{ variant: 'link', size: 'sm', class: 'h-auto p-0 gap-x-1' }],
    defaultVariants: { variant: 'default', size: 'lg', layout: 'default', roundness: 'default' },
  },
);

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>;
```

The full button surface is wide on purpose, and you should match this density rather than ship three sizes and call it done:

| Axis | Values |
|------|--------|
| `variant` | `default`, `primary`, `secondary`, `outline`, `ghost`, `destructive`, `success`, `lightDestructive`, `emptyDestructive`, `link`, `pagination`, `paginationActive`, `input` |
| `size` | `equal`, `sm` (h-8), `xs` (h-9), `smWide`, `md` (h-10), `lg` (h-9), `lgTall` (h-10), `lgp` (h-11), `xl` (h-11), `2xl` (h-12), `link`, `iconSm` (size-8), `paginationPage` |
| `layout` | `default`, `full`, `grow`, `dialogAction` |
| `roundness` | `default` (rounded-lg), `full` (rounded-full) |
| defaults | `variant:'default'`, `size:'lg'`, `layout:'default'`, `roundness:'default'` |

Other primitives follow the identical shape. Input is `default/error/ghost` × sizes `md` (h-9) `lg` (h-10) `xl` (h-11) `2xl` (h-12.5) `3xl` (h-15), with `hover:border-primary focus-within:border-primary`. Checkbox base is `rounded-sm border-border-default data-[state=checked]:bg-primary focus-visible:ring-2 focus-visible:ring-primary/40` with sizes `default` (h-4 w-4) `lg` (h-5) `xl` (h-6).

### cn() is the only class composer

Always merge classes with `cn(...)`. Never template-string-concatenate Tailwind classes — concatenation produces double classes and unpredictable overrides, the classic AI tell. `clsx` handles conditional/array/object inputs; `tailwind-merge` dedupes conflicting utilities so the last one wins predictably. This is exactly why caller `className` goes last in the argument list.

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// usage:
className={cn(buttonVariants({ variant, size, layout, roundness }), className)}
```

### Stamp data-slot on every rendered element

Every component root and every sub-part gets a stable `data-slot="<name>"`: `data-slot="button"`, `data-slot="form-item"`, `data-slot="dialog-content"`, `data-slot="select-content"`. Boolean state becomes empty-string slots: `data-loading={loading ? '' : undefined}`, plus `data-error` / `data-invalid`. These give you stable, semantic selectors for cross-component styling, for portaled-overlay detection, and for tests — none of which couple to class names or DOM shape.

```tsx
<button data-slot="button" data-loading={loading ? '' : undefined} {...rest} />

// the dialog uses slots to detect open portaled popovers and suppress outside-click dismissal:
const PORTALED_POPOVER_SELECTOR = ['[data-slot="select-content"]', '[data-slot="popover-content"]'].join(', ');
```

### Props API: spread native props, accept icons as components

Accept `prefixIcon` / `suffixIcon` / `icon` as `Icon | React.ReactNode` and render them through a `renderIcon` helper that applies `DEFAULT_ICON_PROPS` and then merges caller `iconProps`. Destructure the props you handle, spread the rest onto the DOM node, and **wrap** caller handlers rather than replacing them — call `onPointerDown?.(e)` first, check `defaultPrevented`, then add behavior. This lets a caller pass a Phosphor icon component (not JSX) and still get consistent default weight and size, while the entire native element API stays intact.

```tsx
function renderIcon(icon: Icon | React.ReactNode, iconProps?: Partial<IconProps>) {
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === 'function' || typeof icon === 'object') {
    return React.createElement(icon as Icon, {
      ...DEFAULT_ICON_PROPS,
      ...iconProps,
      className: cn(DEFAULT_ICON_PROPS.className, iconProps?.className),
    });
  }
  return icon;
}
```

**Anti-pattern (AI-vibe smell):** `<button onClick={() => { doThing(); props.onClick?.(); }}>` discards the event and the native button surface. Spread `{...rest}`, accept icon components, and wrap — don't replace — handlers.

### Back interactive primitives with Radix or Base UI — never raw

Build every interactive primitive on a headless library and re-export it with the app's data-slots and tokens. You get accessibility and keyboard semantics for free and correct. The split is deliberate: Radix (`radix-ui`) backs checkbox, label, select, popover, context-menu, avatar, dialog, scroll-area, separator, progress, combobox; Base UI (`@base-ui/react/*`) backs newer components — tooltip, menu, tabs, accordion — for its richer positioner/viewport API (the tooltip's animated size morph needs it). vaul backs the Drawer; cmdk backs the command palette. Mixing across the system is fine; within one file, pick one.

```ts
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Select as SelectPrimitive } from 'radix-ui';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
```

**Anti-pattern (AI-vibe smell):** `<div onClick role="button">` and `<div onClick>` "checkboxes". You will lose focus management, keyboard activation, `aria-checked`, and roving tabindex. Never hand-roll a11y for a primitive a headless library already solves.

### Open dialogs imperatively through a typed Zustand store

Dialogs are call-sites, not JSX trees threaded through props. Maintain a single typed Zustand store: a `DialogId` union, a `DialogPayloads` map binding each id to its payload type, and `open<T>(id, payload)` / `close` / `getData<T>`. Expose ergonomic selector hooks rather than touching the store raw. The store also tracks stacked layers so nested overlays, a toast layer, and the top-most Enter handler stay coherent.

```ts
export type DialogId = 'commandPalette' | 'createVisit' | 'payment' | 'sendSms' | 'addPatient'; /* ... */

export interface DialogPayloads {
  sendSms: SendSmsDialogPayload;
  payment: PaymentDialogPayload;
  addPatient: undefined;
}

open: <T extends DialogId>(id: T, payload?: DialogPayloads[T]) => void;

// selector hooks — callers use these, never the raw store:
export const useSendSmsDialog = () => usePayloadDialog('sendSms');
// open('sendSms', payload) is fully type-checked against the payload map.
```

**Anti-pattern (AI-vibe smell):** threading `isXOpen` / `setXOpen` / `<XDialog open=… />` through five component layers. Register the id in the store and `open()` from the click handler.

### DialogWrapper recipe — describe, don't assemble

For 90% of dialogs use `<DialogWrapper>` and pass `title` / `icon` / `description` / `cancelLabel` / `confirmLabel` / `confirmVariant` / `onConfirm` / `footer`. For forms, nest `<DialogWrapperForm form onSubmit>` and set `confirmType="submit"`; the wrapper generates the form id and wires both the footer submit button and Enter to it. Domain dialogs compose the wrapper and become ~30 lines — a delete confirm just sets `icon=Trash`, `confirmVariant=destructive`. This guarantees identical header/footer/loading/close behavior, sticky header and footer, and sr-only descriptions for a11y across the whole app.

```tsx
<DialogWrapper
  open={open}
  onOpenChange={onOpenChange}
  title={t('...')}
  icon={FloppyDiskIcon}
  confirmType="submit"
  confirmLabel={t('common.save')}
  confirmDisabled={confirmDisabled}
>
  <DialogWrapperForm form={form} onSubmit={onSubmit}>
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('...')}</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </DialogWrapperForm>
</DialogWrapper>
```

**Anti-pattern (AI-vibe smell):** hand-assembling `<DialogHeader>` / `<DialogBody>` / `<DialogFooter>` with duplicated markup in every dialog. Behavior drifts per screen. Use the wrapper so it stays uniform.

### One DialogContent: Radix dialog on desktop, vaul Drawer on mobile

Render a single `<DialogContent>` that becomes a centered Radix dialog on desktop and a vaul bottom-sheet Drawer on mobile, switched by `useBreakpoint().isMobile`. Swap Title/Description to their Drawer equivalents but keep the same children. Never build separate `MobileXDialog` / `DesktopXDialog` components. The Drawer gets `noBodyStyles` because the app shell is `h-dvh` + `overflow-hidden`, and vaul's default scroll hack would otherwise hide the header.

```tsx
if (isMobile) {
  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent
        side="bottom"
        className={cn('max-h-[95svh] gap-3.5 p-0', className)}
        showDragHandle={showDragHandle}
      >
        {frozenChildren}
      </DrawerContent>
    </Drawer>
  );
}
// desktop: Radix DialogPrimitive.Content, centered via translate -50% -50%, max-h-[85svh]
```

### Forms: react-hook-form + a per-render Zod schema + zodResolver

Build the Zod schema **inside** `useMemo(() => createXSchema(t), [t])` so validation messages are translated and re-translate on a language switch. Pass `zodResolver(schema)` to `useAppForm` with `mode: 'onSubmit'`, `reValidateMode: 'onChange'`. Keep form state, submit, and optimistic logic in a `use*Dialog` / `use*Form` hook — never in the JSX. `useAppForm` wraps react-hook-form and defaults `shouldFocusError` to a touch-aware `canAutoFocus()`, so error focus is correct on both pointer and touch.

```ts
const formSchema = useMemo(() => createEditNameFormSchema(t), [t]);

const form = useAppForm<EditNameDialogFormSchema>({
  defaultValues: { name: options.currentName },
  resolver: zodResolver(formSchema),
  mode: 'onSubmit',
  reValidateMode: 'onChange',
});

const onSubmit = form.handleSubmit((values) => {
  /* optimistic mutate */
});
```

### The form context stack auto-derives ids, ARIA, and errors

Wrap each field in `<FormField control name render={({ field }) => ...}>`. Inside, use `<FormItem>` (provides a `useId`), `<FormLabel>` (auto `htmlFor` + `data-error` + the required `*`), `<FormControl>` (a Radix `Slot` that injects `id` / `aria-invalid` / `data-field-name` onto its child), and `<FormMessage />` (renders the i18n-resolved error). `useFormField()` derives `formItemId` / `formMessageId` / error / invalid from context. Never wire `htmlFor` / `id` / `aria-invalid` / `aria-describedby` by hand. `FormMessage` prefers a translation key embedded in `error.types.i18nKey`, then falls back to `error.message`.

```tsx
function FormControl(props) {
  const { error, formItemId, name } = useFormField();
  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      data-field-name={String(name)}
      data-invalid={!!error}
      {...props}
    />
  );
}

function FormLabel({ required, children, ...p }) {
  const { error, formItemId } = useFormField();
  return (
    <Label data-error={!!error} className="data-[error=true]:text-destructive" htmlFor={formItemId} {...p}>
      {children}
      {required && <span className="-ms-1 text-destructive">*</span>}
    </Label>
  );
}
```

**Anti-pattern (AI-vibe smell):** hardcoding English in `z.string().min(1, 'Name is required')` and manually wiring `aria-describedby`. Embed i18n keys, rebuild the schema with `t` per render, and let the context stack handle accessibility. A `FormErrorLocaleSync` re-triggers validation on language switch; a `FormErrorFocus` scrolls to and focuses the first invalid field on submit.

### Icon system: Phosphor, with per-context defaults

Use `@phosphor-icons/react` — it is the single icon source. Let the component defaults set weight and size; do not hand-set them at call sites unless you are overriding. Buttons default icons to `weight: 'duotone'` for a soft, premium two-tone look that reads as designed; icon-only buttons default to `weight: 'regular'`; the checkbox indicator uses `weight: 'bold'`. Every default carries `size-5 shrink-0` so icons never squish in flex rows.

```tsx
// Button default:
const DEFAULT_ICON_PROPS: IconProps = { weight: 'duotone', className: 'size-5 shrink-0' };
// IconButton default:
const DEFAULT_ICON_PROPS: IconProps = { weight: 'regular', className: 'size-5 shrink-0' };
// Checkbox indicator:
<Icon className={checkIconVariants({ size })} weight="bold" />
```

**Anti-pattern (AI-vibe smell):** inline `<svg>` with random `w-4 h-6` sizes and no shared weight. Pass the icon component, let `renderIcon` apply the default props.

### Tactile micro-interactions: haptics on press, asymmetric named easings

Generic builds slap one bouncy 300ms `ease-in-out` on everything; it reads as a template. Here every pressable primitive fires haptics, and every animation uses an intentional, asymmetric easing. Wire `hapticFromPointerEvent(e)` into `onPointerDown` of buttons, icon-buttons, checkboxes, and menu items — but only after calling the caller handler and checking `defaultPrevented` / disabled / loading.

```ts
const SPRING_TRANSITION = { type: 'spring', stiffness: 400, damping: 25, mass: 0.8 } as const;

onPointerDown={(e) => {
  onPointerDown?.(e);
  if (e.defaultPrevented || disabled || loading) return;
  hapticFromPointerEvent(e);
}}

// dialog content enter:
'data-[state=open]:animate-[dialog-content-enter_220ms_cubic-bezier(0.16,1,0.3,1)_both]'
```

Use the project's named motion constants — do not improvise durations:

| Surface | Enter | Exit | Notes |
|---------|-------|------|-------|
| Dialog overlay | 180ms `cubic-bezier(0.16,1,0.3,1)` | 130ms `cubic-bezier(0.4,0,1,1)` | `bg-black/40 backdrop-blur-[2px]` |
| Dialog content | 220ms `cubic-bezier(0.16,1,0.3,1)` | 150ms `cubic-bezier(0.4,0,1,1)` | `rounded-3xl`, `max-h-[85svh]` desktop / `95svh` mobile |
| Button spinner | spring `{ stiffness:400, damping:25, mass:0.8 }` | — | prefix-icon swap `{ duration:0.2, ease:'easeInOut' }` |
| Tooltip | `cubic-bezier(0.22,1,0.36,1)` 300ms | — | size morph `{ type:'spring', bounce:0, duration:0.25 }`; fade `{ duration:0.15, ease:'easeOut' }` |

Haptic tap durations are fixed: light 25ms, medium 40ms, selection 20ms, commit pattern `[30,35,35]`. Android uses `navigator.vibrate`; iOS uses a hidden switch-label trick. IconButton tooltips open after a 1000ms delay (and on a 1000ms touch long-press).

### Stacked Enter-to-submit via a priority registry

Do not put `onKeyDown` Enter handlers on individual forms. With multiple stacked dialogs and popovers, Enter must hit only the top-most actionable layer, exactly once. Register a submit handler with `useDialogSubmit({ open, onSubmit, isDisabled })`; the store keeps the top-priority open handler, and a single global key listener triggers it, guarded by `isEnterPressed`. `DialogWrapper` resolves `onEnterSubmit` automatically — `requestSubmit` on the generated form id, or `onConfirm`.

```ts
export function useDialogSubmit(props) {
  const id = useId();
  useLayoutEffect(() => {
    const { registerSubmit, unregisterSubmit } = useDialogsStore.getState();
    if (!props.open || !props.onSubmit) {
      unregisterSubmit(id);
      return;
    }
    priorityRef.current ??= props.priority ?? ++globalPriorityCounter;
    registerSubmit({ id, priority: priorityRef.current, onSubmit: props.onSubmit, isDisabled: props.isDisabled });
    return () => unregisterSubmit(id);
  }, [/* ... */]);
}
```

### Robust autofocus, frozen children, outside-popover guard

These invisible details separate premium dialogs from janky ones. On dialog open, run a double `requestAnimationFrame` autofocus to the first overlay text field (skip if a field is already focused), select-to-end, and `preventDefault` on the close auto-focus so focus lands without a scroll jump. Freeze children while closing with `useFrozenChildren` so the exit animation doesn't flash empty content. Block outside-interaction dismissal when a portaled popover or select is open, detected via `data-slot`.

```tsx
function useFrozenChildren(children, open) {
  const frozenRef = React.useRef(children);
  if (open) frozenRef.current = children;
  return open ? children : frozenRef.current;
}

const firstFrame = requestAnimationFrame(() => {
  const secondFrame = requestAnimationFrame(runAutoFocus);
  frameIds.push(secondFrame);
});
```

### Color tokens are semantic; spacing is logical (RTL-first)

Never write an arbitrary hex color or a purple/neon gradient. Use only semantic tokens so theming and dark mode stay coherent: `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-destructive`, `text-success`, `bg-background-base` / `-surface` / `-elevated`, `border-border-default` / `-subtle` / `-dark`, `text-text-primary` / `-secondary` / `-tertiary`. And never bake LTR-only spacing — the app is RTL-first. Use logical properties everywhere: `ps-` / `pe-` / `ms-` / `me-` / `start-` / `end-`. Resolve `dir` from `useDirection()`, and input direction via `useTextFieldState`.

**Anti-pattern (AI-vibe smell):** `pl-4 ml-2 text-left left-0 bg-[#6d28d9]`. It breaks in Arabic and breaks theming. Write `ps-4 ms-2 text-start start-0 bg-primary`.

### Rules

- Define each primitive with one `cva()` call; type props as `React.ComponentProps<'el'> & VariantProps<typeof xVariants>`.
- Compose classes only with `cn()`; put caller `className` last so it wins. Never concatenate Tailwind strings.
- Stamp `data-slot` on every rendered element; use `data-loading` / `data-error` / `data-invalid` boolean slots.
- Back every interactive primitive with Radix or Base UI; re-export with app tokens and slots. Never hand-roll a11y.
- Accept icons as Phosphor components (not JSX); render via `renderIcon` and let per-component defaults set weight and `size-5 shrink-0`.
- Wrap caller handlers (`onClick?.(e)` / `onPointerDown?.(e)`) first, then add behavior; check `defaultPrevented` / disabled / loading.
- Open dialogs imperatively through the typed Zustand store via selector hooks; never thread open-state and JSX through props.
- Build dialogs with `<DialogWrapper>` / `<DialogWrapperForm>`; compose thin domain wrappers for confirms.
- Render one `DialogContent` that becomes a vaul Drawer on mobile and a Radix dialog on desktop via `useBreakpoint`; never build separate mobile/desktop dialogs.
- Keep form state, submit, and optimistic logic in a `use*Dialog` hook; keep JSX declarative with `FormField` / `FormItem` / `FormControl` / `FormMessage`.
- Build Zod schemas per render with `createXSchema(t)`; never hardcode validation strings.
- Use `zodResolver`, `mode: 'onSubmit'`, `reValidateMode: 'onChange'`; let `FormControl` / `useFormField` derive ids and ARIA.
- Register Enter-to-submit via `useDialogSubmit` so the top stacked layer submits exactly once; never add per-form Enter handlers.
- Add `hapticFromPointerEvent` to pressable primitives after the caller handler and a `defaultPrevented` / disabled guard.
- Use the project's named springs and Béziers with asymmetric enter/exit; never apply one bouncy 300ms `ease-in-out` everywhere.
- Use semantic color tokens and logical properties (`ps-` / `pe-` / `ms-` / `me-` / `start-` / `end-`) only; never arbitrary hex or LTR-only spacing.

---

## 6. Data Layer: Caching, Optimistic Writes, and Persistence for Any Backend

The app feels instant because of one architectural commitment: **the cache is the source of truth the UI paints from**, reads keep it fresh, and writes are optimistic. The reference implementation makes reads realtime — every read is a Convex websocket subscription bridged into TanStack Query, so the cache self-corrects without polling — but **none of the optimistic engine in this section requires a realtime backend** (see *Optimistic UI without a realtime backend* at the end of the section). Reads default to `staleTime: Infinity` with a 7-day in-memory `gcTime` and a 30-day IndexedDB mirror, so navigating back to a screen paints from cache with zero spinner; on a realtime backend the socket silently fixes anything stale, and on a request/response backend a quiet background refetch does the same job. Optimism here is not a per-screen `setQueryData` sprinkle — it is a shared engine with snapshot/rollback, entity-aware cache fan-out, replay/dedupe, and end-to-end types generated off the backend. Build it as a primitive, not a feature.

The subsections that follow show the realtime (Convex) reference path, but the cache-discipline pieces — the optimistic write body, the snapshot/rollback engine, the cross-cache fan-out, optimistic ids, IndexedDB persistence, and the mutation contract — are **backend-agnostic and reused verbatim** no matter what sits behind them.

### Wire Convex into the QueryClient as a realtime cache

**(Realtime reference path.)** Do not fetch in `useEffect`. For a realtime backend, install it into the `QueryClient` so TanStack holds the data while a server-pushed watch updates the value — the reference installs Convex, setting its hash function and query function as query defaults, then connecting. (Request/response backend? You keep this same `QueryClient`, just with your own fetcher as `queryFn` and a finite `staleTime` — skip to *Optimistic UI without a realtime backend* below.)

```ts
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleQueryErrorToast }),
  defaultOptions: {
    queries: {
      gcTime: GC_TIME.DEFAULT,        // 7 days
      staleTime: Infinity,            // reads never auto-stale; websocket pushes corrections
      networkMode: 'offlineFirst',
      placeholderData: keepPreviousData,
      ...(convexQueryClient
        ? { queryKeyHashFn: convexQueryClient.hashFn(), queryFn: convexQueryClient.queryFn() }
        : {}),
    },
  },
});
if (convexQueryClient) {
  convexQueryClient.connect(queryClient);
}
```

Query keys are `['convexQuery', functionName, normalizedArgs]` — every optimistic helper, sync routine, and invalidation keys off that exact shape. Subscriptions are pruned when a query loses its last observer (`observerRemoved`) and re-armed on `observerAdded`, so idle screens never hold open sockets.

These are the cache timing constants. Treat them as the contract, not suggestions:

| Constant | Value | Meaning |
|---|---|---|
| `staleTime` | `Infinity` | Reads never auto-stale; corrections arrive over the socket |
| `GC_TIME.DEFAULT` | `1000*60*60*24*7` (7 days) | In-memory cache retention |
| `STALE_TIME.DEFAULT` | 5 min | Used for focus-refresh age gating |
| `STALE_TIME.SHORT` / `LONG` | 1 min / 15 min | Tighter / looser refresh windows |
| `STALE_TIME.HEALTH` / `STATIC` | 30 s / 30 min | Liveness checks / near-static data |
| `networkMode` | `'offlineFirst'` | Serve cache first, network second |
| `placeholderData` | `keepPreviousData` | No blank frame between key changes |

**Anti-pattern (AI-vibe smell):** `useEffect(() => { fetch(url).then(setData) }, [])` with a `loading` boolean and `setData`. That is a polled, manually-managed snapshot that goes stale the moment another tab edits the record. Reads must be subscriptions bridged into the cache so they are realtime and self-correcting.

### Define every read in a query factory — never inline

Define each entity's reads in a `queries` object built with `makeConvexQuery` / `makeConvexIdQuery`. Each entry is `(params?, enabled?) => { queryKey, queryFn, ... }` and also carries `.args(params)`. There is exactly one place that knows an entity's query key, so optimistics, sync, and invalidation can all find the same cache entry.

```ts
// queries.ts
import { makeConvexIdQuery, makeConvexQuery } from '@/lib/convex/query-options';

const patientListIds = { clinicId: 'clinics', familyId: 'families', primaryDentistId: 'dentists' } as const;

export const queries = {
  list: makeConvexQuery(convexApi.patients.list, { ids: patientListIds }),
  summary: makeConvexQuery(convexApi.patients.getSummary, { ids: { clinicId: 'clinics' } }),
  detail: makeConvexIdQuery(convexApi.patients.get, 'patientId', 'patients'),
};
```

`enabled=false` must resolve to the Convex `'skip'` sentinel, not a TanStack `enabled: false` flag — `'skip'` gates the query without creating a dead cache slot:

```ts
// query-options.ts — enabled=false => Convex 'skip'
const queryOptions = (params?, enabled = true) =>
  enabled ? convexQueryOptions(query, args(params)) : convexQueryOptions(query, 'skip');
```

Arg objects are key-sorted and undefined-stripped (`normalizeConvexQueryArgs`) so `{a,b}` and `{b,a}` hash to a single key. Export hooks, optimistics, queries, and types from a per-entity barrel `index.ts` so each slice is one import.

**Anti-pattern (AI-vibe smell):** calling `convexQuery(...)` or `useQuery({ queryKey: ['patient', id] })` inline in a component. The moment two screens spell the key differently, optimistic updates and invalidation silently miss the cache entry. Keys come from the factory, always.

### Normalize `isPending` on every read hook

With Convex `'skip'`, a disabled query never resolves, so TanStack reports `isPending: true` forever. Wrap every read hook and override `isPending` to `isEnabled && query.isPending`. A skipped/disabled query must report `isPending: false`.

```ts
useGetPatient: (patientId: string, options?: PatientsQueryOptions) => {
  const isEnabled = !!patientId && (options?.enabled ?? true);
  const query = useQuery({ ...patientQueries.detail(patientId, isEnabled) });
  return { ...query, isPending: isEnabled && query.isPending };
};
```

This single line is the difference between a polished loading state and a detail view that flashes a skeleton which never goes away while it waits on an id.

### The fixed optimistic write body — apply → await → replace → rollback

Every write hook has the same body. Memorize it; copy it; never improvise per screen.

1. `applyOptimistic...` patches the cache and returns a snapshot carrying `.rollback`.
2. `await` the Convex mutation.
3. On success, `replaceOptimistic...` / `syncToCache` swaps optimistic data for the server result — **replace, do not invalidate**.
4. On `catch`, call `snapshot.rollback()` and **rethrow**.

```ts
return useConvexMutationRequest({
  mutation: async ({ allergyId, body }) => {
    const optimistic = applyOptimisticAllergyUpdate(queryClient, allergyId, body);
    try {
      const data = await updateAllergy({ allergyId, ...body });
      replaceOptimisticAllergyUpdate(queryClient, optimistic, data);
      return data;
    } catch (error) {
      optimistic.rollback();
      throw error;
    }
  },
  ...options,
});
```

Replacing instead of invalidating means no refetch flash. Rethrowing after rollback lets the shared request engine drive `isError`/`onError` and the global error toast.

**Anti-pattern (AI-vibe smell):** `await mutate(); queryClient.invalidateQueries(...)`. The invalidation triggers a refetch, the cache empties, and the UI flashes a spinner over data the server already returned to you. Put the server result straight into the cache.

### The snapshot/rollback engine — per-key, LIFO, identity-guarded

Hand-written optimism is only safe with a real rollback engine. Record `{queryKey, previous, optimistic}` before each write; restore in reverse order; and restore **only if the live value is still `=== optimistic`**. The identity guard is what prevents a late rollback from clobbering data that a newer write or a websocket push already replaced.

```ts
export function setQueryDataWithOptimisticRollback(queryClient, rollbacks, queryKey, updater) {
  const previous = queryClient.getQueryData(queryKey);
  const optimistic = updater(previous);
  if (optimistic === previous) return;                 // no-op writes skipped
  rollbacks.push({ queryKey, previous, optimistic });
  queryClient.setQueryData(queryKey, optimistic);
}

export function createOptimisticCacheRollback(queryClient, rollbacks) {
  return () => {
    for (let i = rollbacks.length - 1; i >= 0; i -= 1) {
      const r = rollbacks[i];
      if (queryClient.getQueryData(r.queryKey) !== r.optimistic) continue; // identity guard
      queryClient.setQueryData(r.queryKey, r.previous);
    }
  };
}
```

Reverse-order restore unwinds nested patches correctly. No-op writes (where the updater returns the same reference) are skipped so they cannot pollute the rollback stack. This is the abstraction that makes overlapping mutations and racing socket pushes safe.

**Anti-pattern (AI-vibe smell):** optimistic update with no rollback, or a naive `setQueryData(key, old)` in `onError` that blindly overwrites whatever is there now — clobbering a fresher server value that landed in between.

### Fan a write out across every cache entry it touches

A real record appears in many places: the detail screen, several lists, a summary, and embedded inside invoices, visits, and dashboard rows. Editing a patient must update all of them instantly, with zero invalidations. On a write, patch the detail key AND iterate `getQueryCache().findAll({ predicate })` over every Convex query matching the relevant function name(s), upserting/removing/reordering the item while respecting that query's own args. For shared entities, patch the entity inside ALL Convex queries by deep-walking the cached values.

```ts
function patchPatientAcrossConvexQueries(queryClient, patch, rollbacks) {
  for (const query of queryClient.getQueryCache().findAll({
    predicate: (e) => isConvexQueryKey(e.queryKey),
  })) {
    setQueryDataWithOptionalOptimisticRollback(
      queryClient,
      query.queryKey,
      (previous) => syncPatientInCachedValue(previous, patch),
      rollbacks,
    );
  }
}

// list upsert respects args: include only if it matches filters, then re-sort + re-slice to the limit
const data = sortItems(mergedData).slice(0, getListLimit(args, previous.meta, mergedData.length));
```

The list upsert re-runs the list's own filter and sort so an inserted row lands in the correct position — not appended to the end — and re-slices to the page limit so the list does not grow past its size.

**Anti-pattern (AI-vibe smell):** optimistically updating only the one list the current screen is showing. The same patient is stale everywhere else until a refetch, and the user sees inconsistent data across tabs.

### Mint optimistic ids — and never write a filtered list you shouldn't

Create temp records with `createOptimisticId('optimistic-patient:')` (format `${prefix}${Date.now()}:${seq}`) and detect them with `isOptimisticId`. The prefixed id lets `replaceOptimistic...` swap the temp row for the real one with no flash. Critically, only insert an optimistic record into a list when `matchesListArgs` is true: first page, no server-only filter, and search/gender/family all match. Otherwise leave that list untouched.

```ts
id: createOptimisticId(OPTIMISTIC_PATIENT_ID_PREFIX) as PatientResponse['id'],
// ...
function matchesPatientListArgs(patient, args) {
  return (
    isFirstPageArgs(args) &&
    !args.filter &&
    args.activityFilter !== 'recently_visited' &&
    args.activityFilter !== 'idle' &&
    (!args.gender || args.gender === patient.gender) &&
    matchesPatientSearch(patient, args.search)
  );
}
```

Inserting a fresh row into a list filtered by a server-computed flag, or onto page 3, would show wrong or duplicated data the instant the server answers. Gating the insert keeps optimism truthful.

**Anti-pattern (AI-vibe smell):** appending the optimistic row to every list. When the server's paginated, filtered, sorted response arrives, the user sees duplicates and out-of-position rows.

### Absorb stale websocket pushes with a replay buffer

**(Realtime backends only — a request/response stack has no push race and skips this entirely.)** A websocket push can arrive carrying stale data milliseconds after your mutation resolved, briefly reverting the UI. After every mutation, remember the result in a short ring buffer and re-stamp it onto incoming pushes — but only when the incoming row is older (`skipIfTargetNewer`, comparing `updatedAt` as a number or parsed ISO string).

```ts
const wrapped = async (args) => {
  const result = await m(args);
  rememberMutationResultForConvexCacheReplay(result);
  convexQueryClient?.onUpdate();
  syncMutationResultToMatchingConvexCache(globalQueryClient, result);
  return result;
};
// on every convex query update, replay recent results — merge only when incoming is not newer
syncMutationResultToMatchingConvexCache(queryClient, replay.result, { skipIfTargetNewer: true });
```

The buffer is bounded: `RECENT_MUTATION_CACHE_REPLAY_WINDOW_MS = 5_000` and `MAX_RECENT_MUTATION_CACHE_REPLAYS = 25`. This eliminates the subtle one-frame flicker that screams "unpolished realtime app."

**Anti-pattern (AI-vibe smell):** ignoring the websocket-vs-mutation race entirely. The user's edit appears, then visibly reverts for a frame when the slightly-stale subscription frame lands.

### Persist the cache to IndexedDB for instant cold loads

Wrap the app in `PersistQueryClientProvider` with an idb-keyval async-storage persister so a cold load paints real data, not skeletons. Persist only successful queries, 30-day `maxAge`, a `buster`/key scoped per deployment and versioned by schema, throttle at 1000ms, and `removeOldestQuery` on quota.

```ts
const queryCachePersister = createAsyncStoragePersister({
  storage: indexedDbStorage,                            // idb-keyval get/set/del
  key: `app:tanstack-query:${cacheScope}:v${QUERY_CACHE_SCHEMA_VERSION}`,
  throttleTime: 1000,
  retry: removeOldestQuery,
});

export const queryPersistenceOptions = {
  persister: queryCachePersister,
  maxAge: 1000 * 60 * 60 * 24 * 30,                      // 30 days
  buster: `app-query-cache:${cacheScope}:v${QUERY_CACHE_SCHEMA_VERSION}`,
  dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' },
};
```

| Setting | Value | Why |
|---|---|---|
| Store | `createStore('app-query-cache','tanstack-query')` (idb-keyval) | Async IndexedDB, off the main thread |
| `cacheScope` | deployment URL with non-alphanumerics stripped | One env's cache never leaks into another |
| `QUERY_CACHE_SCHEMA_VERSION` | `3` (key `...:v3`) | Bumping wipes the store on shape changes |
| `maxAge` | 30 days | Long enough to survive real usage gaps |
| `throttleTime` | 1000 ms | Bounds write churn |
| `retry` | `removeOldestQuery` | Stay under quota instead of throwing |
| `shouldDehydrateQuery` | `status === 'success'` | Never rehydrate spinners or errors |

On rehydrate, `onSuccess` calls `resumePersistedQueryMutations` (`resumePausedMutations`) so writes queued while offline are replayed.

**Anti-pattern (AI-vibe smell):** no persistence, so every cold load shows skeletons; or one shared IndexedDB cache across deployments and schema versions, so a stale shape from another environment rehydrates and crashes the render.

### One mutation contract, one request engine

Type every write hook's options as `MutationCallbacks<TData, TVariables, TContext>` (async-aware `onSuccess`/`onError`/`onSettled`). Build hooks on `useConvexMutationRequest({ mutation, ...options })` — a thin state machine (`'idle' | 'pending' | 'error' | 'success'`) that fires lifecycle callbacks, exposes `isPending`/`isError`/`data` for buttons and inline errors, and supports per-call callbacks at `mutate(vars, callbacks)`.

```ts
export type MutationCallbacks<TData, TVariables, TContext = unknown> =
  AsyncRequestListenerOptions<TData, Error, TVariables, TContext>;

useCreatePatient: (options?: MutationCallbacks<CreatePatientResponse, CreatePatientVariables, void>) => {
  return useConvexMutationRequest({
    mutation: async (body) => {
      /* apply → await → replace */
    },
    ...options,
  });
};
```

A single contract means every screen consumes mutations identically, TypeScript catches mismatched variable shapes, and a caller can attach an extra `onSuccess` at the call site without rebuilding the hook.

### Derive every type from the generated Convex API

Never hand-write request/response interfaces. Derive responses from `FunctionReturnType<typeof api.x.get>` and requests from `UnbrandConvexIds<FunctionArgs<typeof api.x.create>>` — the unbrand strips branded `Id<'table'>` down to `string` for the UI. Rebrand only at the Convex boundary with `asConvexId(table, value)`.

```ts
export type AllergyResponse = FunctionReturnType<typeof api.allergies.get>;
export type CreateAllergyRequest = UnbrandConvexIds<FunctionArgs<typeof api.allergies.create>>;
export type UpdateAllergyRequest = Omit<UnbrandConvexIds<FunctionArgs<typeof api.allergies.update>>, 'allergyId'>;
// rebrand at the edge:
args: (id) => ({ [key]: asConvexId(tableName, id ?? '') });
```

A schema change becomes a compile error, not a runtime surprise. UI code deals in plain strings; ids are validated and branded only when crossing into Convex (`isLikelyConvexDocumentId` uses `/^[0-9a-hjkmnp-tv-z]{31,37}$/i`). No screen invents a DTO, and id mismatches cannot silently ship.

**Anti-pattern (AI-vibe smell):** hand-written `interface Patient { ... }` that drifts from the backend, plus branded `Id<'patients'>` types leaking into form state. Generate the types; keep the UI in strings.

### Refresh quietly on focus — and don't blank seeded data

Coming back to a tab should refresh quietly, not refetch everything. On focus/online/visibilitychange, throttle-invalidate only observed Convex queries older than `STALE_TIME.DEFAULT` (5 min); the throttle is `CONVEX_RESUME_REFRESH_THROTTLE_MS = 1000`. Seed the cache from bundled warmup payloads using the SAME query keys via `convexQueryOptions`, and guard early websocket frames so a brief `undefined` watch result never clears seeded data.

```ts
function shouldRefreshObservedConvexQuery(query) {
  if (!isSubscribableConvexQueryKey(query.queryKey)) return false;
  if (query.getObserversCount() === 0 || query.state.status !== 'success') return false;
  return Date.now() - query.state.dataUpdatedAt >= CONVEX_OBSERVED_REFRESH_AGE_MS; // 5min
}
// warmup guard: keep prev when the first subscription frame is undefined
queryClient.setQueryData(queryKey, (prev) => (value !== undefined ? value : prev));
```

Warmup hydration paints the most-used screens instantly on first load; the guard prevents the classic "seeded data blanks for one frame then reappears" glitch when the subscription first attaches.

**Anti-pattern (AI-vibe smell):** `staleTime: 0` plus refetch-on-every-focus. Returning to a tab triggers a full refetch storm and skeleton flashes over data you already have.

### Dedupe error toasts by display mode and signature

Realtime queries can error repeatedly; naive toasting buries the user. Route query errors through `QueryCache.onError`, respect `query.meta.errorDisplay` (`'toast' | 'inline' | 'silent'`), suppress known codes, and dedupe by `queryHash` + message. Clear the signature when the query next succeeds. Augment TanStack's `Register.queryMeta` so `meta.errorDisplay` is type-safe everywhere.

```ts
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: QueryMeta;
  }
}

function handleQueryErrorToast(error, query) {
  if ((query.meta?.errorDisplay ?? 'toast') !== 'toast') return;
  if (shouldSuppressErrorToast(getErrorCode(error))) return;
  const message = getErrorMessage(error);
  if (toastedQueryErrorSignatures.get(query.queryHash) === message) return; // dedupe
  toastedQueryErrorSignatures.set(query.queryHash, message);
  toastAppError(error);
}
```

A screen that wants inline errors sets `meta: { errorDisplay: 'inline' }` and the global toaster stays out of its way.

**Anti-pattern (AI-vibe smell):** `onError: (e) => toast(e.message)` on every query. A single flapping subscription fires the same toast a dozen times a second.

### Optimistic UI without a realtime backend (REST / GraphQL / any request-response API)

Optimistic UI is a **cache** technique, not a backend feature — you do not need Convex, websockets, or subscriptions to get the same instant-then-reconcile feel. If your backend is request/response (REST, GraphQL, gRPC, Supabase, Firebase, a Rails/Django/Node API), keep TanStack Query and drive the *exact same engine* through its native mutation lifecycle. The apply → await → replace → rollback body shown above maps one-to-one onto `onMutate` / `onError` / `onSuccess` / `onSettled`.

```ts
// The non-realtime optimistic write — TanStack Query's useMutation.
// Reuses the SAME rollback engine, fan-out, and optimistic ids defined above.
function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: UpdatePatientRequest) => api.patients.update(vars), // your fetcher (REST/GraphQL)

    onMutate: async (vars) => {
      // 1. Cancel in-flight refetches so they can't overwrite the optimistic value.
      await queryClient.cancelQueries({ queryKey: patientQueries.detail(vars.id).queryKey });
      // 2. Snapshot + patch every touched key — the same engine as the realtime path.
      const rollbacks = [];
      setQueryDataWithOptimisticRollback(
        queryClient, rollbacks,
        patientQueries.detail(vars.id).queryKey,
        (prev) => applyPatientPatch(prev, vars),
      );
      patchPatientAcrossQueries(queryClient, vars, rollbacks); // detail + every list + embedded copies
      return { rollbacks };
    },

    // 3a. On error: roll back LIFO with the identity guard, then let the error surface.
    onError: (_err, _vars, ctx) => createOptimisticCacheRollback(queryClient, ctx.rollbacks)(),

    // 3b. On success: write the server's returned object straight into the cache — REPLACE, don't refetch.
    onSuccess: (serverPatient) => syncPatientToCache(queryClient, serverPatient),

    // 4. OPTIONAL quiet reconcile. The cache is already correct, so this refetch is invisible
    //    (no spinner). Use it only when the server derives fields you can't compute locally.
    // onSettled: () => queryClient.invalidateQueries({ queryKey: patientQueries.list().queryKey }),
  });
}
```

Reads change in exactly one way: **freshness policy**. With no socket pushing corrections, do not blindly use `staleTime: Infinity`. Pick a finite `staleTime` per data class and let TanStack refetch in the background on focus/mount. The screen still paints instantly — from `placeholderData: keepPreviousData` and the IndexedDB mirror — and the background refetch swaps in fresh data with no spinner.

| Concern | Realtime backend (Convex reference) | Request/response backend (REST/GraphQL) |
|---|---|---|
| Read transport | Websocket subscription bridged into Query | `fetch`/GraphQL inside the factory's `queryFn` |
| Read freshness | `staleTime: Infinity`; socket pushes corrections | Finite `staleTime` per data class (e.g. 30s–15min); background refetch on focus/mount |
| After a write | `replace` cache with server result; socket reconciles | `replace` cache with server result; optional quiet `invalidateQueries` in `onSettled` |
| Disabled query | Backend `'skip'` sentinel + `isPending` override | TanStack `enabled: false` |
| Live updates from other users | Free, over the socket | Add SSE / a websocket / interval polling that calls `setQueryData` or `invalidateQueries` |
| Type source | `FunctionArgs` / `FunctionReturnType` + unbrand | OpenAPI / GraphQL codegen / shared `zod` schemas |
| **Reused verbatim** | **snapshot/rollback engine · cache fan-out · optimistic ids · IndexedDB persistence · mutation contract · query-factory keys** | ← identical on both |

Everything in that last row is identical regardless of backend. The only realtime-only pieces you skip are the websocket *install*, the `'skip'` sentinel (use `enabled: false`), and the *replay buffer* — there is no push race to absorb when there are no pushes.

> **Anti-pattern (AI-vibe smell):** "We're on REST, so we can't do optimistic UI — just `await fetch()`, then `invalidateQueries`, and show a spinner." Wrong on two counts. Optimistic UI lives in the cache, not the backend; and refetch-with-spinner is the exact flash this manifesto bans. `onMutate` + `onError` give you instant-then-reconcile over a plain endpoint. The only thing a realtime backend buys you is *free cross-client updates* — not the optimism itself.

### Rules

*Universal on every backend: the optimistic write body, snapshot/rollback, cache fan-out, replace-not-refetch, optimistic ids, IndexedDB persistence, and "never a spinner over warm data." The Convex-specific rules below — the `'skip'` sentinel, the websocket install, the replay buffer — have request/response equivalents in **Optimistic UI without a realtime backend** above.*

- Do install your realtime backend into the QueryClient (the reference: Convex `queryKeyHashFn`/`queryFn` defaults + `connect`) so reads are subscriptions, not fetches — or, on a request/response backend, set your own fetcher as `queryFn` with a finite `staleTime`. Either way the cache, not the component, is the source of truth.
- Do define all reads in a `queries` factory (`makeConvexQuery`/`makeConvexIdQuery`) and reuse the exact `queryKey` in optimistics, sync, and invalidation. Never call `convexQuery`/`useQuery` with an inline key in a component.
- Do set `staleTime: Infinity`, `gcTime` 7 days, `networkMode: 'offlineFirst'`, `placeholderData: keepPreviousData` as global query defaults.
- Do resolve `enabled=false` to the Convex `'skip'` sentinel, and override `isPending` to `isEnabled && query.isPending` on every read hook.
- Do follow the fixed write body in every hook: `applyOptimistic` → `await` mutation → replace with server data → `catch` + `rollback()` + rethrow. Replace, never invalidate, on success.
- Do snapshot per key before writing and restore in reverse (LIFO) with an identity guard (only if value `=== optimistic`); skip no-op writes.
- Do fan a write out to the detail key AND every matching list AND the entity embedded in related queries; re-run each list's filter/sort/slice.
- Do gate optimistic list insertion behind `matchesListArgs` (first page, no server-only filter, search/filters match); mint and later swap `createOptimisticId` rows.
- Do absorb stale pushes with the 5s / 25-entry mutation replay buffer and `skipIfTargetNewer` (`updatedAt` compare).
- Do persist only successful queries to IndexedDB, scope the key per deployment, version it with a buster, throttle 1000ms, and `removeOldestQuery` on quota.
- Do derive all DTOs from `FunctionReturnType` / `UnbrandConvexIds<FunctionArgs>`; keep UI in plain strings and rebrand ids only at the Convex boundary.
- Do refresh observed queries quietly on focus/online/visibility, throttled, only when older than 5 min; guard warmup-seeded data against the first `undefined` frame.
- Do route errors through `QueryCache.onError`, respect `errorDisplay` meta, and dedupe by `queryHash` + message.
- Never invalidate+refetch after a successful mutation when you can replace cache data — refetch causes a visible flash.
- Never blindly append an optimistic row to every list, hand-write DTOs, pass branded `Id` types around the UI, leave `isPending` raw on gated queries, rollback unconditionally, share one IndexedDB cache across deployments/schema versions, toast every error tick, or keep sockets open for zero-observer queries.

---

## 7. TanStack Router: Layout Splits, Auth Gating, Multi-Layer Warmup & Loading Choreography

Navigation must feel instant, not "well-spinnered". The router's job is not to decorate latency with skeletons — it is to make the destination already warm (code chunk + data + decoded assets) before the user clicks, so the page renders populated on first paint. You achieve this with a cache that is treated as the product (`defaultStaleTime: Infinity`), audience-scoped layout shells with cache-first guards, a four-layer warmup pipeline that yields to real traffic, and exactly one piece of navigation chrome: a global progress bar that only shows up when a load is genuinely slow. Do not paper over slow navigations; eliminate them.

### Configure the router to cache forever and never globally swallow errors

Create one router with an infinite stale time so any route you have visited or warmed never refetches on re-entry — back/forward and re-navigation are instant. Set `defaultPreloadStaleTime: 0` so hover-preloaded data is considered fresh and immediately usable. Disable the global catch boundary so each route owns its error UI instead of one app-wide boundary eating context, and route caught errors by class in `defaultOnCatch`: stale-build chunk errors auto-reload, permission errors redirect home, everything else toasts. Never set a global `pendingComponent` or `defaultViewTransition`.

```ts
export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultStructuralSharing: true,
  defaultStaleTime: Infinity,
  defaultPreloadStaleTime: 0,
  defaultViewTransition: false,
  disableGlobalCatchBoundary: true,
  defaultErrorComponent: RouteErrorFallback,
  defaultNotFoundComponent: NotFound,
  defaultOnCatch: (error) => {
    if (isRecoverableAssetLoadError(error)) {
      void recoverStaleBuild();
    } else if (isPermissionError(error)) {
      void router.navigate({ to: '/', replace: true });
    } else {
      toastAppError(i18n.t('errors.default'), { i18nKey: 'errors.default' });
    }
  }
});

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
```

### Code-split via the Vite plugin, not hand-rolled lazy()

Enable `autoCodeSplitting` and import page components synchronously at the top of each route file. The plugin splits each route's component and loader into its own chunk while the source still reads like a plain module — which is exactly what lets the code-warmup pipeline preload chunks by route id with `router.loadRouteChunk`. Never wrap route components in `React.lazy` by hand; you lose the route-id-driven preload and add boilerplate.

```ts
// vite.config.ts
tanstackRouter({ target: 'react', autoCodeSplitting: true }),

// route file — looks synchronous, ships as a split chunk
export const Route = createFileRoute('/_app/sales')({
  beforeLoad: async (options) => {
    await assertRoutePermission(options.context.queryClient, '/sales');
  },
  component: SalesPage,
  validateSearch: salesSearchSchema
});
```

Also set `build.target: 'esnext'`, enable `babel-plugin-react-compiler`, and run `VitePWA({ registerType: 'autoUpdate' })`.

### Split the shell into three pathless layout routes by audience

Do not build one mega-shell with conditionals. Split by who is looking: `_auth` (guest + setup screens, OAuth provider), `_app` (authenticated tenant shell with Sidebar + AppHeader), `_admin` (super-admin shell). Each layout route owns its own `beforeLoad` guard, its own warmup wiring, and sets `errorComponent: false` to defer errors up to the root. Audience scoping means guest pages never mount authenticated chrome, and each shell runs only the syncs/subscriptions it needs — `_app` runs the notifications live-subscription and user-preferences sync; `_auth` runs neither. Reuse the exact `Sidebar`/`AppHeader` components across shells via feature-flag props instead of duplicating layout.

```ts
export const Route = createFileRoute('/_app')({
  staleTime: STALE_TIME.DEFAULT,
  errorComponent: false,
  beforeLoad: async () => { await guardProtectedAppRoute(); },
  component: RouteComponent
});

// _admin reuses the same shell with overridden props
<Sidebar linkConfigs={ADMIN_LINK_CONFIGS} showGlobalSearch={false}
         showClinicSwitcher={false} showUserModeSwitch />
<AppHeader showNotifications={false} showSwitchClinic={false}
           userRoleOverride="superAdmin" />
```

### Guard cache-first in beforeLoad: synchronous when warm, network only when cold

A guard that always `await`s a network call makes warm re-navigation show a loading state and hangs offline users. Read the session from cache first; if a cached session exists, assert synchronously and return `void` so the router resolves the guard in the same tick. Fall through to a network fetch only when the cache is cold AND the browser is online; offline with a cold cache gets a deterministic redirect to `/sign-in`, never a hang. Centralize every route's `RouteType` (`public | guest | setup | superAdmin | protected`) plus its permission requirements in one config map and switch on it — keep guard logic out of individual route files. Throw `redirect({ ..., replace: true })` for every denial.

```ts
function guardConvexRoute(routePath: Route): void | Promise<void> {
  const routeType = getRouteType(routePath);
  const cachedSession = getConvexSessionPropertiesFromCache();
  switch (routeType) {
    case 'public':
    case 'guest':
      return;
    case 'setup': {
      if (cachedSession) { assertAuthenticated(cachedSession); return; }
      if (isBrowserOffline()) throw redirect({ to: '/sign-in', replace: true });
      return fetchConvexSessionProperties().then(assertAuthenticated);
    }
    case 'protected':
      return (async () => {
        const session = await getConvexRouteSession();
        assertAuthenticated(session);
        scheduleActiveOrganizationGuard(session);
      })();
  }
}

function assertAuthenticated(session) {
  if (!session.isAuthenticated) throw redirect({ to: '/sign-in', replace: true });
  if (!session.isEmailVerified)
    throw redirect({ to: '/verify-email', search: getVerifyEmailSearch(session), replace: true });
}
```

**Anti-pattern (AI-vibe smell):** `const session = await fetch(); if (!session) redirect()` on every navigation. Slow on warm re-entry, broken offline. Read the cache, assert synchronously, return void; only fetch on a cold cache while online.

### Validate search params through a shared parser factory

Never scatter inline `z.object({...})` per screen — normalization drifts and you re-type everything by hand. Build each route's `validateSearch` from a shared `createSearchValidator({...})` factory composed of reusable parsers: `optionalStringSearchParam`, `optionalEnumSearchParam`, `optionalUuidSearchParam`, `withDefaultSearchParam`. Each parser trims, strips empty strings to `undefined`, takes array-first, and throws on invalid values so bad params surface through the route error path instead of silently corrupting state. The derived `SearchValidatorResult<T>` infers required-vs-optional keys, so components read fully-typed search with zero per-screen Zod.

```ts
export const salesSearchSchema = createSearchValidator({
  tab: optionalEnumSearchParam(['all', ...INVOICE_LIST_STATUSES]),
  filters: optionalString,
  highlightId: optionalString,
  paymentId: optionalString
});

export const Route = createFileRoute('/_app/sales')({
  component: SalesPage,
  validateSearch: salesSearchSchema
});
```

### One global progress bar, gated behind 400ms, theme-tinted, RTL-aware

Render exactly one `<NavigationProgress router={router} />` at the app root. Subscribe to router state (`status === 'pending' || isLoading || isTransitioning`) and start NProgress only after a 400ms delay timer; always call `NProgress.done()` in cleanup. The delay gate is the whole trick: navigations that resolve from warm cache finish before the timer fires, so the bar never flashes on instant transitions — it appears only for genuinely slow loads. Tint it from the theme token via `color-mix`, not a hardcoded blue/neon, so it stays on-brand in light and dark; flip it for RTL so it grows from the inline-start edge in Arabic.

```tsx
const PROGRESS_DELAY_MS = 400;
NProgress.configure({ showSpinner: false, minimum: 0.15, trickleSpeed: 200 });

export function NavigationProgress(props) {
  const isNavigating = useRouterState({ router: props.router,
    select: (s) => s.status === 'pending' || s.isLoading || s.isTransitioning });
  useEffect(() => {
    if (!isNavigating) return;
    const t = setTimeout(() => NProgress.start(), PROGRESS_DELAY_MS);
    return () => { clearTimeout(t); NProgress.done(); };
  }, [isNavigating]);
  return null;
}
```

```css
#nprogress .bar {
  background: color-mix(in srgb, var(--primary) 50%, transparent);
  height: 2px; position: fixed; top: 0; left: 0; width: 100%; z-index: 1031;
}
[dir='rtl'] #nprogress .bar { scale: -1 1; }
```

**Anti-pattern (AI-vibe smell):** a hardcoded blue top-loader shown immediately on every navigation. It flashes on warm-cache hits and reads as jank, and goes off-theme in dark mode. Gate behind ~400ms and tint from `var(--primary)`.

### The four-layer warmup pipeline

Make the first click to any page instant by warming code, data, and assets during idle time — but every layer must yield to the user. Gate all warmup on `requestIdleCallback`, `navigator.connection` (skip on `saveData` or `effectiveType` in `{'2g','slow-2g'}`), document visibility, and router-idle state, and only start after `window 'load'`. Cancel stale runs with a `runId` generation counter on session change/logout.

#### Layer 1 — idle route CODE warmup

After login lands on a shell route, call `startRouteCodeWarmup(router)` once. Build a dedupe queue from current matches + a hand-ordered `ROUTE_WARMUP_PRIORITY_KEYS` list + all remaining routes, then drain it one chunk at a time via `router.loadRouteChunk(route)` inside `requestIdleCallback` (5s timeout, 1.5s `setTimeout` fallback). Pre-warming every lazy chunk during idle means the FIRST visit to a page is instant, not just repeat visits.

```ts
const ROUTE_WARMUP_PRIORITY_KEYS = ['/_app','/_auth','/_admin','/','/dashboard',
  '/patients','/patients/$patientId','/reservations','/sales','/stock', /* ... */];

export function startRouteCodeWarmup(router) {
  if (didStartRouteCodeWarmup || !isRouteWarmupAllowedByConnection()) return;
  didStartRouteCodeWarmup = true;
  startRouteAssetWarmup();
  const queue = buildRouteWarmupQueue(router);
  const warmNext = () => scheduleIdle(() => {
    if (shouldPauseRouteWarmup(router)) { schedulePausedRouteWarmup(warmNext); return; }
    const route = queue.shift();
    if (!route) { startAiAssistantCodeWarmup(router); return; }
    void Promise.resolve(router.loadRouteChunk(route)).catch(() => undefined).finally(warmNext);
  });
  scheduleAfterPageLoad(warmNext);
}
```

#### Layer 2 — idle DATA (query-cache) warmup

Warming the query cache is what makes a navigated-to page render WITH data on first paint instead of a skeleton. Per session key (`userId:orgId`), call `startRouteCacheWarmup(router, key)`. Prefetch the CURRENT route's queries first inside a 1s priority window — race the prefetch against a timeout so the rest of the queue is not blocked — then drain remaining paths one per idle tick. Track `warmupRunId` and bump it on session change/logout to cancel stale runs; retry failed attempts up to 4 times with a 2s backoff; reset everything in `resetRouteCacheWarmup()` on logout. The runId guard prevents a logged-out user's warmup from racing a new login.

```ts
if (activeSessionKey !== sessionKey) { activeSessionKey = sessionKey; warmupRunId += 1; }
const runId = warmupRunId;
const currentPathResult = await Promise.race([
  settleWarmupStage(prefetchDirectWarmupQueries([currentPath], { includeAuthWarmup: false })),
  waitForCurrentRoutePriorityWindow() // resolves null after 1000ms
]);
if (runId !== warmupRunId) return null; // cancelled by a newer run
// retry: if (attempt + 1 < MAX_WARMUP_ATTEMPTS) setTimeout(() => runWarmup(attempt + 1), 2000);
```

#### Layer 3 — hover/intent preload on Links, rows, and actions

Hover/focus is the earliest reliable signal of navigation intent. On every navigating Link use `preload="intent"` + `preloadDelay={80}` and additionally fire a query refetch for the destination on `onPointerEnter` (mouse only, debounced 80ms to match the router). For table rows, dashboard items, and row actions, wire `onMouseEnter` AND `onFocus` to `preloadRouteIntent(router, target)`, which preloads the route chunk AND refetches the exact queries the destination reads on mount (detail-registry specs first, list warmup specs as fallback), deduped per pathname within a 30s window. Wiring `onFocus` makes this keyboard-accessible, not mouse-only; the 30s window stops re-hovering a row from hammering the backend.

```tsx
<Link to={href} preload="intent" preloadDelay={NAVIGATION_LINK_PRELOAD_DELAY_MS} /* 80 */
  onPointerEnter={handleLinkPointerEnter} onPointerLeave={handleLinkPointerLeave} />

// table row action — both mouse and keyboard
<Item onMouseEnter={() => action.onIntent?.(props.row)}
      onFocus={() => action.onIntent?.(props.row)} />

// preloadRouteIntent: chunk + destination queries, deduped 30s
void Promise.resolve(router.preloadRoute(toNavigateOptions(target))).catch(() => undefined);
const detailSpecs = buildDetailWarmupQuerySpecsForPath(pathname);
if (detailSpecs.length > 0) { refetchWarmupQuerySpecs(detailSpecs); return; }
refetchWarmupQueriesForPath(pathname);
```

#### Layer 3b — idle/touch preload queue for hover-less devices

Hover is impossible on touch, so give mobile the same warm-destination benefit through a background queue. Let data sources (e.g. a table's visible rows) register destinations via `setIdleRoutePreloadTargets(sourceId, router, targets)`. A single global queue drains them one at a time, but ONLY while the network is quiet: require 2 consecutive quiet polls (`isFetching()===0 && isMutating()===0`, page visible), pause 250ms between preloads, and refresh each pathname at most once per 5 minutes. This strictly yields to real user traffic so it never delays an active fetch.

```ts
async function waitForQuietNetwork() {
  let quietCycles = 0;
  while (hasPendingEntries() && quietCycles < NETWORK_IDLE_QUIET_CYCLES /* 2 */) {
    quietCycles = isPageVisible() && !isNetworkBusy() ? quietCycles + 1 : 0;
    if (quietCycles < NETWORK_IDLE_QUIET_CYCLES) await sleep(NETWORK_IDLE_POLL_MS /* 1000 */);
  }
}
function isNetworkBusy() { return queryClient.isFetching() > 0 || queryClient.isMutating() > 0; }
```

#### Layer 4 — idle ASSET warmup from a build-emitted manifest

Decoding images and force-caching fonts during idle means later pages paint without layout-shift or font-swap flashes. Emit `app-assets-manifest.json` (and `version.json`) at build time via a Vite `generateBundle` plugin that lists every hashed image/style/font/audio asset with bytes + kind. At runtime, `startRouteAssetWarmup()` fetches that manifest after page load, sorts by kind priority (image > style > font > audio), and warms each one on idle: images via `new Image()` + `img.decode()`, everything else via `fetch(href, { cache: 'force-cache' })`. Driving it from the manifest keeps the list correct across builds automatically, and the same manifest's `buildHash` powers stale-build detection.

```ts
appVersionManifestPlugin(buildHash); // -> /version.json + /app-assets-manifest.json

async function warmImageAsset(href) {
  const image = new Image();
  image.decoding = 'async';
  image.src = href;
  await image.decode().catch(() => undefined);
}
async function warmFetchAsset(href) {
  await fetch(href, { cache: 'force-cache', credentials: 'same-origin' }).catch(() => undefined);
}
```

### Warmup timing constants

| Constant | Value | Layer |
|---|---|---|
| `PROGRESS_DELAY_MS` | 400 | NavigationProgress gate |
| `NAVIGATION_LINK_PRELOAD_DELAY_MS` | 80 | Link `preloadDelay` / hover debounce |
| `ROUTE_INTENT_REFRESH_WINDOW_MS` | 30_000 | Hover/intent refetch dedupe |
| `ROUTE_WARMUP_IDLE_TIMEOUT_MS` / `FALLBACK_DELAY_MS` / `PAUSE_DELAY_MS` | 5000 / 1500 / 1000 | Layer 1 code warmup idle |
| `CURRENT_ROUTE_PRIORITY_WINDOW_MS` | 1000 | Layer 2 current-route head start |
| `WARMUP_RETRY_DELAY_MS` / `MAX_WARMUP_ATTEMPTS` | 2000 / 4 | Layer 2 retries |
| `ACTIVE_CLINIC_WAIT_MS` / `POLL_MS` | 15000 / 200 | Layer 2 session-ready wait |
| `NETWORK_IDLE_POLL_MS` / `NETWORK_IDLE_QUIET_CYCLES` | 1000 / 2 | Layer 3b quiet-network gate |
| `BETWEEN_PRELOADS_PAUSE_MS` / `FETCH_SETTLE_TIMEOUT_MS` | 250 / 15000 | Layer 3b drain pacing |
| `IDLE_PRELOAD_REFRESH_WINDOW_MS` | 300_000 (5 min) | Layer 3b per-pathname window |
| `LAZY_MOUNT_PRELOAD_DELAY_MS` / `LAZY_MOUNT_IDLE_TIMEOUT_MS` | 150 / 1200 | LazyMount idle pre-warm |

**Anti-pattern (AI-vibe smell):** never prefetching anything, so every click waits on a chunk download plus a cold fetch, then masking it with a route skeleton. Run the four coordinated layers instead and let them yield to live traffic.

### Treat stale-build chunk 404s as a recoverable runtime event

After a deploy, an old tab requesting a now-deleted hashed chunk would white-screen. Treat that as recoverable, not fatal. Register global listeners for `vite:preloadError`, resource `error` on hashed `/assets/*.{js,css}` script/link tags, and `unhandledrejection` matching a dynamic-import-failure regex. On any match call `recoverStaleBuild()`: probe the service worker for an update, clear the router cache + Workbox caches, then apply the SW update — or reload with a `__app_update` cache-bust param. Strip that param on boot via `history.replaceState` so it never pollutes the URL or history. The SW (`registerType: 'autoUpdate'`) re-checks for updates hourly, on `visibilitychange`, and on `online`.

```ts
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  void recoverStaleBuild();
});
const dynamicImportFailurePattern =
  /Failed to fetch dynamically imported module|Loading chunk \S+ failed|Unable to preload CSS/i;

export async function recoverStaleBuild() {
  await probeServiceWorkerUpdate().catch(() => undefined);
  await clearRuntimeCachesBeforeReload();
  const apply = getApplyServiceWorkerUpdate();
  if (apply) { await apply(true); return; }
  window.location.replace(buildAppUpdateReloadUrl(window.location.href));
}

// boot order in main.tsx
function initApp() {
  mountApp();
  cleanupAppUpdateReloadSearchParam();
  registerAppServiceWorker();
}
```

Derive `buildHash = sha256(VITE_BUILD_HASH | GITHUB_SHA | VERCEL_GIT_COMMIT_SHA | Date.now()).slice(0,8)` and set `CURRENT_APP_VERSION = import.meta.env.VITE_BUILD_HASH || 'dev'`. Configure Workbox runtime caching to match: `/assets/*.{js,css}` CacheFirst (365d, 250 entries), fonts CacheFirst (30d), remote images StaleWhileRevalidate (30d, 300 entries).

### No route pendingComponent — use LazyMount and a minimal shell-hold

Because data and code are pre-warmed, a route-level spinner is dead weight that only ever flashes. Declare ZERO `pendingComponent`/`defaultPendingMs` across the route tree. For deferred non-route UI (dialogs, devtools, sign-out confirm), gate behind `<LazyMount when={isOpen}>`, which keeps the heavy chunk out of the initial bundle but pre-mounts it silently on idle (150ms delay + `requestIdleCallback`) so it opens instantly when triggered. For the one genuine auth-hold in `_app`, render a tiny pulsing bar — never a full skeleton.

```tsx
function AppRouteAccessPending() {
  return (
    <main className="flex h-dvh items-center justify-center overflow-hidden">
      <div className="h-1 w-32 animate-pulse rounded-full bg-muted" />
    </main>
  );
}

// deferred dialog: lazy chunk + idle pre-mount + Suspense
const LazyPaymentDialog = lazy(async () => ({ default: (await import('.../payment-dialog')).PaymentDialog }));
<LazyMount when={paymentDialog.isOpen}><LazyPaymentDialog paymentDialog={paymentDialog} /></LazyMount>
```

**Anti-pattern (AI-vibe smell):** slapping `pendingComponent: <Skeleton/>` (or a centered spinner) on every route. Declare zero pending components and pre-warm the destination so it renders populated on first paint.

### Compose overlays and the conditional Layout at the root

Keep global overlays and dialog managers at the `__root` route, outside the per-route shells, so they persist across navigations without remounting. Render subscription/connection overlays conditionally on whether the current matches include an `_app` route AND the resolved pathname is a `protected` RouteType, then `<Outlet/>`, then a conditional `<Layout/>` for dialog managers. Drive language/appearance sync from `resolvedLocation.pathname` (not the pending location) so you never flash the wrong theme during a pending navigation, and gate preference-dependent appearance behind `isAppRoute && isReady` so guest pages use default appearance.

```tsx
function RootShell() {
  const hasAppRouteMatch = useRouterState({ select: (s) => s.matches.some((m) => isAppRouteMatch(m.routeId)) });
  const isAppRoute = hasAppRouteMatch && getRouteType(currentPathname) === 'protected';
  return (
    <>
      {isAppRoute ? <SubscriptionAccessOverlay /> : null}
      <ConnectionCheckOverlay />
      <Outlet />
      {isAppRoute ? <Layout /> : null}
    </>
  );
}
export const Route = createRootRouteWithContext<RouterContext>()({ errorComponent: false, component: () => <RootShell /> });
```

### Fail CI when warmup lists drift from the route tree

Hand-curated priority/warmup string lists rot silently: rename or delete a route and a stale key just no-ops, quietly degrading the instant-navigation guarantee. Ship a check script (`find:unused-route-warmup`) that diffs every warmup reference (`ROUTE_WARMUP_PRIORITY_KEYS`, warmup-path enums) against the real route `fullPaths` and reports stale entries by kind, with a `--verbose` listing. Wire it into CI so invisible decay becomes a hard, reviewable failure.

```ts
// package.json
"find:unused-route-warmup": "bun run scripts/check/tools/find-unused-route-warmup.ts"

console.log(`Checked ${report.referenceCount} warmup references against ${report.validFullPathCount} routes.`);
console.log(`Stale warmup references: ${issues.length} across ${byKind.size} kind(s)`);
```

### Rules

- Do create the router with `defaultStaleTime: Infinity`, `defaultPreloadStaleTime: 0`, `defaultStructuralSharing: true`, `disableGlobalCatchBoundary: true`, and a class-routing `defaultOnCatch`; never set a global `pendingComponent` or `defaultViewTransition`.
- Do enable `autoCodeSplitting` and import page components synchronously in route files; never hand-roll `React.lazy` per route.
- Do split the shell into pathless `_auth` / `_app` / `_admin` layout routes, each with its own `beforeLoad` guard, its own warmup wiring, and `errorComponent: false`; reuse shared shell components via props, never duplicate layout.
- Do guard cache-first: assert synchronously off a cached session and return `void`; fetch only on a cold cache while online; redirect (with `replace: true`) when offline-cold or denied. Never make every guard an unconditional `await fetch()`.
- Do centralize `RouteType` + permission requirements in one config map; never inline guard logic per route file.
- Do validate search via a shared `createSearchValidator` + `optional*` parsers that trim, drop-empty, and throw; never scatter inline `z.object` per screen.
- Do render exactly one NProgress bar, gated behind a 400ms delay, tinted with `color-mix(in srgb, var(--primary) 50%, transparent)`, height 2px, RTL-flipped with `scale: -1 1`. Never show it immediately or hardcode a blue/neon hex.
- Do run all four warmup layers (code, data, assets, hover/idle intent) on `requestIdleCallback`, gated on `navigator.connection` (skip saveData/2g/slow-2g), document visibility, and router idle, after `window 'load'`; cancel stale runs with a `runId` counter.
- Do wire `onMouseEnter` AND `onFocus` for intent preload on links/rows/actions with a 30s per-pathname dedupe, plus an idle queue for touch that yields to live network traffic (2 quiet polls). Never preload on mouse only.
- Do catch `vite:preloadError` / dynamic-import failures / hashed-asset resource errors and call `recoverStaleBuild()` to reload to the new build; add a self-cleaning `__app_update` param and strip it on boot. Never let a chunk 404 white-screen.
- Do declare zero route pending components; use `<LazyMount>` for deferred dialogs and at most a 1px pulsing bar for a genuine auth-hold. Never put a route skeleton on a pre-warmed destination.
- Do keep overlays + the conditional `<Layout/>` at `__root`, gated on `isAppRoute`, syncing appearance off the resolved pathname so guest pages never inherit authenticated chrome or flash the wrong theme.
- Do ship a CI check (`find:unused-route-warmup`) that fails when curated warmup keys drift from the real route `fullPaths`.

---

## 8. Build + Runtime Performance Optimizations

Performance is not a pass you make at the end; it is a set of defaults baked into the build config, the server, the service worker, and every interaction handler. The principle: do the expensive work once (at build time, or during browser idle), make every asset a cache hit, and treat the network as something to hide behind prefetch — never something the user waits on. Below is the exact machinery. Recreate it faithfully; the numbers are load-bearing.

### Build target, minify, and chunking — let the tools do it

Ship for evergreen browsers and a PWA install target. Set `target: 'esnext'` so the bundler skips legacy transpilation and polyfills, use `esbuild` for minification (far faster than terser, comparable output), and raise `chunkSizeWarningLimit` to 2000 because chunks are double-precompressed downstream and the default warning would be pure noise. Do route-level splitting through the router plugin's `autoCodeSplitting`, and let the React Compiler handle memoization.

```ts
// vite.config.ts
build: {
  target: 'esnext',
  minify: 'esbuild',
  sourcemap: isPreviewBuild, // sourcemaps only in preview builds
  chunkSizeWarningLimit: 2000
},
plugins: [
  tanstackRouter({ target: 'react', autoCodeSplitting: true }),
  viteReact({ babel: { plugins: ['babel-plugin-react-compiler'] } }),
  // ...
]
```

**Anti-pattern (AI-vibe smell):** hand-authoring a `manualChunks` vendor-splitting map in `rollupOptions.output`. With route-based auto code-splitting you already get per-page chunks for free; a manual chunk map is maintenance debt that drifts out of sync with your routes. Never write one.

### React Compiler is the memoization strategy

`babel-plugin-react-compiler` auto-memoizes components and computed values, so reflexively wrapping everything in `useMemo`/`useCallback`/`memo` is redundant noise. Commit to the compiler fully: turn OFF the react-hooks lint rules it subsumes, because the compiler now owns dependency correctness and immutability.

```js
// eslint.config.js — compiler owns these, so they are disabled
'react-hooks/exhaustive-deps': 'off',
'react-hooks/preserve-manual-memoization': 'off',
'react-hooks/immutability': 'off',
'react-hooks/static-components': 'off',
// also off: refs, set-state-in-effect, incompatible-library, globals
```

Reach for manual memoization ONLY on a proven hot render path, and when you do, write an explicit prop comparator — the compiler can't beat a hand-tuned comparison on the single hottest component. The data table is the deliberate exception: it re-renders on every keystroke, sort, and hover, so its core is wrapped in `memo()` with a ~30-field referential comparator.

```tsx
// data-table-core.tsx — the one deliberate manual-memo hot path
function areDataTableCorePropsEqual<TData>(previous, next): boolean {
  return (
    previous.dataTable.table === next.dataTable.table &&
    previous.dataTable.tableRenderState === next.dataTable.tableRenderState &&
    previous.labels === next.labels &&
    /* ...~30 referential field comparisons... */
    previous.getRowId === next.getRowId
  );
}
export const DataTableCore = memo(
  DataTableCoreComponent,
  areDataTableCorePropsEqual
) as typeof DataTableCoreComponent;
```

This is surgical, not blanket. The reference codebase uses `useMemo`/`useCallback`/`memo` in the hundreds, but only where measured — not as decoration. If you can't name the render storm a `useMemo` prevents, delete it.

### Precompress twice: gzip + brotli at build, negotiate at the server

Compress every asset once, at build time, in both gzip and brotli — never per request. The server then content-negotiates: prefer `.br`, fall back to `.gz`, fall back to raw, always setting `Content-Encoding` and `Vary: Accept-Encoding`. This means zero server CPU per asset hit and best-possible brotli ratios even from a plain origin with no CDN in front.

```ts
// vite.config.ts
compression({ algorithms: ['gzip'] }),
compression({ algorithms: ['brotliCompress'], filename: '[path][base].br' }),
```

```ts
// server.ts — negotiate at request time
async function resolveEncodedVariant(filePath, acceptEncoding) {
  if (canUseBrotli(acceptEncoding)) {
    const brFile = Bun.file(`${filePath}.br`);
    if (await brFile.exists()) return { encoding: 'br', path: `${filePath}.br` };
  }
  if (canUseGzip(acceptEncoding)) {
    const gzipFile = Bun.file(`${filePath}.gz`);
    if (await gzipFile.exists()) return { encoding: 'gzip', path: `${filePath}.gz` };
  }
  return null;
}
if (options.encoding) {
  headers.set('Content-Encoding', options.encoding);
  headers.set('Vary', 'Accept-Encoding');
}
```

### Cache-Control by volatility

Content-hashed assets never change for a given URL, so cache them forever and let the browser skip revalidation entirely. The HTML shell, version manifest, and service worker MUST be `no-cache` — caching `index.html` is the classic bug that pins users to a stale build. Apply the identical policy in both the production Bun server and the Vite preview middleware so dev and prod behave the same.

| Path | Cache-Control |
|------|---------------|
| `/assets/*` (hashed) | `public, max-age=31536000, immutable` (1 year) |
| `/index.html` | `no-cache, no-store, must-revalidate` |
| `/version.json` | `no-cache, no-store, must-revalidate` |
| `/manifest.json` | `public, max-age=0, must-revalidate` |
| `/sw.js`, `/workbox-*` | `no-cache` |
| everything else | `public, max-age=600` (10 min) |

```ts
// server.ts
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const SHORT_CACHE_SECONDS = 60 * 10;
function getCacheControl(pathname: string): string {
  if (pathname === '/index.html') return 'no-cache, no-store, must-revalidate';
  if (pathname === '/version.json') return 'no-cache, no-store, must-revalidate';
  if (pathname === '/manifest.json') return 'public, max-age=0, must-revalidate';
  if (pathname === '/sw.js' || pathname.startsWith('/workbox-')) return 'no-cache';
  if (pathname.startsWith('/assets/')) return `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
  return `public, max-age=${SHORT_CACHE_SECONDS}`;
}
```

### Service-worker runtime caching, tiered by asset class

Configure VitePWA with `registerType: 'autoUpdate'` and `cleanupOutdatedCaches: true`, then split runtime caching into three tiers keyed on how each asset class changes. Immutable hashed code and fonts use `CacheFirst` — the URL changing IS the invalidation, so they never hit the network twice. Remote images that can change use `StaleWhileRevalidate` so the UI paints from cache instantly while refreshing in the background. Cap every tier with `maxEntries` and `maxAgeSeconds` to bound growth, and exclude `version.json` from precache so the update probe always hits the network.

| Tier | Pattern | Handler | maxEntries | maxAge |
|------|---------|---------|------------|--------|
| `app-assets-cache` | `/assets/*.{js,css}` | CacheFirst | 250 | 1 year |
| `font-cache` | `/assets/*.{woff2,ttf}` | CacheFirst | 40 | 30 days |
| `remote-image-cache` | S3 + flag-CDN image hosts | StaleWhileRevalidate | 300 | 30 days |

```ts
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: false,
  workbox: {
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // 8MB
    globIgnores: ['**/stats.html', '**/version.json'],
    navigateFallback: '/index.html',
    runtimeCaching: [
      { urlPattern: /\/assets\/.*\.(?:js|css)$/i, handler: 'CacheFirst',
        options: { cacheName: 'app-assets-cache',
          expiration: { maxEntries: 250, maxAgeSeconds: 60*60*24*365 },
          cacheableResponse: { statuses: [0, 200] } } },
      { urlPattern: /\/assets\/.*\.(?:woff2?|ttf)$/i, handler: 'CacheFirst',
        options: { cacheName: 'font-cache',
          expiration: { maxEntries: 40, maxAgeSeconds: 60*60*24*30 } } },
      { urlPattern: ({ request, url }) => request.destination === 'image' &&
          ['naap-s3.s3.eu-north-1.amazonaws.com','purecatamphetamine.github.io'].includes(url.hostname),
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'remote-image-cache',
          expiration: { maxEntries: 300, maxAgeSeconds: 60*60*24*30 } } }
    ]
  }
})
```

### Build-hash version manifest for safe live updates

Give every build a stable identity so the client can cheaply detect "a newer build exists" without diffing bundles. Derive an 8-char sha256 `buildHash` from the first available of `VITE_BUILD_HASH | GITHUB_SHA | VERCEL_GIT_COMMIT_SHA | Date.now()` — hashing the commit SHA keeps the same source producing the same hash (reproducible), with `Date.now()` only as a dev fallback. Emit two non-precached JSON files: `version.json` (the update probe, served no-cache) and `app-assets-manifest.json` (the warmup asset list). The service worker re-fetches `sw.js` with `no-store` hourly, on tab-visible, and on reconnect.

```ts
// vite.config.ts
const buildHashSource = env.VITE_BUILD_HASH || env.GITHUB_SHA ||
  env.VERCEL_GIT_COMMIT_SHA || Date.now().toString();
const buildHash = createHash('sha256').update(buildHashSource).digest('hex').slice(0, 8);
```

```ts
// app-version-manifest.ts — emit both JSON files in generateBundle
this.emitFile({ type: 'asset', fileName: 'version.json',
  source: JSON.stringify(createAppVersionManifest(buildHash, builtAt), null, 2) });
this.emitFile({ type: 'asset', fileName: 'app-assets-manifest.json',
  source: JSON.stringify(assetsManifest, null, 2) });

// pwa/register.ts — hourly / visibility / online update probe
const SERVICE_WORKER_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('online', handleOnline);
window.setInterval(runCheck, SERVICE_WORKER_UPDATE_INTERVAL_MS);
```

### Self-healing stale-build / chunk-load recovery

When a user has an old `index.html` open and you deploy, their cached chunk URLs 404. A generic app shows a blank screen or a dead lazy route. Treat a chunk-load failure as an upgrade signal instead: register global listeners for `vite:preloadError`, for `unhandledrejection` matching dynamic-import failure patterns, and for resource error events on hashed `/assets/*.{js,css}`. On any match, probe the SW for an update, clear the router cache plus all workbox caches, then apply the SW update (reload) or hard-reload with a cache-bypass query param — stripped from the URL after mount. A guard flag prevents reload loops.

```ts
// app-version.ts
const dynamicImportFailurePattern =
  /Failed to fetch dynamically imported module|Unable to preload CSS|Loading chunk \S+ failed|Failed to load module script/i;

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  void recoverStaleBuild();
});
window.addEventListener('unhandledrejection', (event) => {
  if (!isRecoverableAssetLoadError(event.reason)) return;
  event.preventDefault();
  void recoverStaleBuild();
});

async function clearRuntimeCachesBeforeReload() {
  await ignoreCacheResetError(clearRouterCache);         // router.clearCache + invalidate
  await ignoreCacheResetError(clearWorkboxCacheStorage); // caches.delete(all)
}
```

### Virtualize long lists with overscan + near-end prefetch

Never render thousands of DOM rows. Use `@tanstack/react-virtual`'s `useVirtualizer` with `overscan: 5` so only the visible window plus a small buffer exists in the DOM regardless of list length. Include a `+1` virtual loader row when `hasNextPage` so the spinner lives inside the virtualization model rather than as a layout-shifting sibling. Prefetch the next page before the user hits bottom — trigger `fetchNextPage` when the last virtual item is within 6 rows of the end OR remaining scroll is ≤ 160px. Position rows absolutely with `translateY(virtualItem.start)` inside a spacer sized to `getTotalSize()`.

```ts
// dialog-list-wrapper.tsx
const LOAD_MORE_SCROLL_THRESHOLD_PX = 160;
const LOAD_MORE_ROW_THRESHOLD = 6;
const virtualizer = useVirtualizer({
  count: props.items.length + (props.hasNextPage ? 1 : 0),
  getScrollElement: () => scrollElement,
  estimateSize: () => estimateSize, // default 56px
  overscan: 5, paddingStart: 8, paddingEnd: 8
});
function getVirtualRowStyle(v: VirtualItem): React.CSSProperties {
  return { height: `${v.size}px`, transform: `translateY(${v.start}px)` };
}
const isNearEnd = lastVirtualItemIndex >= itemCount - LOAD_MORE_ROW_THRESHOLD ||
  (remainingScrollPx !== undefined && remainingScrollPx <= LOAD_MORE_SCROLL_THRESHOLD_PX);
```

### Lazy mount: idle warm-mounting of off-screen heavy UI

Heavy dialogs and panels should not sit in the initial render path — but a cold `import()` on first click adds a visible delay. Split the difference: code-split the chunk with `React.lazy` + `import()`, then warm-mount it during browser idle so by the time the user clicks, it's already there. `LazyMount` mounts instantly when `when` is true; otherwise it pre-mounts after a 150ms `setTimeout` then `requestIdleCallback` (1200ms timeout). This is prefetch-over-spinner applied to component code.

```tsx
// lazy-mount.tsx
const LAZY_MOUNT_PRELOAD_DELAY_MS = 150;
const LAZY_MOUNT_IDLE_TIMEOUT_MS = 1200;
function scheduleIdleMount(callback: () => void) {
  const delayHandle = window.setTimeout(() => {
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(callback, { timeout: LAZY_MOUNT_IDLE_TIMEOUT_MS });
      return;
    }
    callback();
  }, LAZY_MOUNT_PRELOAD_DELAY_MS);
  /* returns cleanup that clears timeout + cancelIdleCallback */
}

// usage — lazy import the named export, idle warm-mount it
const LazySendSmsDialog = lazy(async () => {
  const { SendSmsDialog } = await import('@/components/dialogts/common/send-sms-dialog');
  return { default: SendSmsDialog };
});
<LazyMount when={isSendSmsDialogOpen}><LazySendSmsDialog /></LazyMount>
```

### Connection-aware idle warmup of route chunks + assets

Prefetching makes navigation instant — but only when it's free. After page load, on idle (`requestIdleCallback`, 2s timeout for chunks / 5s for assets), warm route chunks and decode-warm assets from `app-assets-manifest.json`. Gate ALL warmup on `navigator.connection`: skip entirely if `saveData` is set or `effectiveType` is `slow-2g`/`2g`, and pause when the document is hidden. Warm one asset at a time, prioritized image > style > font > audio, decoding images via `image.decode()` and fetching everything else with `cache: 'force-cache'`. This is the opposite of naive "prefetch everything always" — it never harms users on metered or poor networks.

```ts
// route-warmup-idle.ts
export function isRouteWarmupAllowedByConnection(): boolean {
  const connection = (navigator as any).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g';
}

// route-asset-warmup.ts — one-at-a-time idle decode warmup
const ASSET_WARMUP_KIND_PRIORITY = { image: 0, style: 1, font: 2, audio: 3 };
async function warmImageAsset(href: string) {
  const image = new Image();
  image.decoding = 'async';
  image.src = href;
  await image.decode().catch(() => undefined);
}
async function warmFetchAsset(href: string) {
  await fetch(href, { cache: 'force-cache', credentials: 'same-origin' }).catch(() => undefined);
}
```

### Hover/intent preload of route chunk + destination queries

By the time a user clicks a table row, both the code chunk and the destination's data should already be loading. Expose a `useRoutePreload()` callback wired to pointer-enter/hover on rows and links. On hover it calls `router.preloadRoute(target)` AND refetches the exact queries the destination reads on mount — checking a detail-warmup registry first, falling back to list-page warmup specs. The router dedupes the chunk preload itself, but query refetches must be throttled: once per concrete pathname per 30s, so sweeping the mouse across many rows doesn't hammer the backend. Null/undefined targets no-op.

```ts
// route-intent-preload.ts
const ROUTE_INTENT_REFRESH_WINDOW_MS = 30_000;
const lastIntentRefreshAtByPathname = new Map<string, number>();
export function preloadRouteIntent(router, target) {
  if (!target) return;
  const pathname = resolveRouteIntentPathname(router, target);
  if (!pathname) return;
  const lastRefreshAt = lastIntentRefreshAtByPathname.get(pathname);
  if (lastRefreshAt !== undefined && Date.now() - lastRefreshAt < ROUTE_INTENT_REFRESH_WINDOW_MS) return;
  lastIntentRefreshAtByPathname.set(pathname, Date.now());
  void Promise.resolve(router.preloadRoute(toNavigateOptions(target))).catch(() => undefined);
  const detailSpecs = buildDetailWarmupQuerySpecsForPath(pathname);
  if (detailSpecs.length > 0) { refetchWarmupQuerySpecs(detailSpecs); return; }
  refetchWarmupQueriesForPath(pathname);
}
```

### Persist the query cache to IndexedDB

Persisting reads means reopening the app paints from cache before any network call — instant cold-start. Persist the TanStack Query cache to IndexedDB via `createAsyncStoragePersister` over an `idb-keyval` store: `throttleTime: 1000` to avoid thrashing IDB on rapid churn, `retry: removeOldestQuery` for graceful quota pressure, `maxAge` 30 days, and dehydrate only successful queries. Namespace the storage key by deployment URL plus a manual schema version so environments don't bleed into each other, and set `buster` to the same — bump the version to invalidate all persisted cache when shapes change between releases. Resume paused mutations `onSuccess` for offline writes.

```ts
// query-persistence.ts
const QUERY_CACHE_SCHEMA_VERSION = 3;
const QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30d
const QUERY_CACHE_THROTTLE_TIME_MS = 1000;
const queryCacheStore = createStore('app-query-cache', 'tanstack-query');
const queryCachePersister = createAsyncStoragePersister({
  storage: indexedDbStorage,
  key: `app:tanstack-query:${cacheScope}:v${QUERY_CACHE_SCHEMA_VERSION}`,
  throttleTime: QUERY_CACHE_THROTTLE_TIME_MS,
  retry: removeOldestQuery
});
export const queryPersistenceOptions = {
  persister: queryCachePersister,
  maxAge: QUERY_CACHE_MAX_AGE,
  buster: `app-query-cache:${cacheScope}:v${QUERY_CACHE_SCHEMA_VERSION}`,
  dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' }
};
// wired via <PersistQueryClientProvider onSuccess={resumePersistedQueryMutations}>
```

### Prebundle the deps that need it, prod-safe devtools

Pre-bundle only the deps that actually benefit. Deep/barrel imports like `@phosphor-icons/react` and `zustand/react/shallow` fire hundreds of dev requests unbundled; `optimizeDeps.include` collapses them and speeds cold starts. Import the devtools' production build outside `DEV` so the dev-only tool stays off the prod path while still allowing an opt-in production panel. Skip HMR for generated files (e.g. Convex codegen) to avoid reload storms.

```ts
// vite.config.ts
optimizeDeps: {
  include: ['zustand/react/shallow', '@phosphor-icons/react']
},
```

```tsx
// root-providers.tsx — prod-safe devtools
const QueryDevtools = lazy(async () => {
  const { ReactQueryDevtools } = import.meta.env.DEV
    ? await import('@tanstack/react-query-devtools')
    : await import('@tanstack/react-query-devtools/production');
  return { default: ReactQueryDevtools };
});
```

### Sweep dead code; don't trust tree-shaking across barrels

Tree-shaking misses dead modules behind barrels, re-exports, and dynamic imports. Maintain a suite of bun scripts that statically walk the whole import/export graph and find (and auto-fix) unused exports across 12 categories — exports, utils, constants, schemas, stores, lib, types, hooks, routes, pages, dialogs, permissions — plus `fix:unused-exports`. The walker marks dynamic `import()` as full-module use and seeds forced entry points (`main.tsx`, `server.ts`, route files) so it never deletes a real entry. Run these in the check pipeline and enforce unused imports as a lint error. Smaller surface means a smaller, faster bundle and less to reason about.

```jsonc
// package.json scripts (12 categories total)
"find:unused-exports": "bun run scripts/check/tools/find-unused-exports.ts",
"fix:unused-exports":  "bun run scripts/check/tools/remove-unused-exports.ts",
"find:unused-hooks":   "bun run scripts/check/tools/find-unused-hooks.ts",
"find:unused-routes":  "bun run scripts/check/tools/find-unused-routes.ts",
```

```ts
// the walker seeds forced entry points so real entries are never swept
const forcedEntryImporters = [
  'src/main.tsx', 'server.ts',
  'src/routes/_app.tsx', 'src/routes/_admin.tsx', 'src/routes/_auth.tsx',
];
// eslint.config.js
'unused-imports/no-unused-imports': 'error'
```

### Set theme/lang/dir before first paint

Setting direction, theme color, and font size only after React mounts causes a flash of wrong theme and an RTL layout jump — visible CLS that a JS-framework-only approach can't avoid. Run a synchronous IIFE in `index.html`'s `<head>`, before the module bundle loads, that reads persisted user preferences from localStorage and sets `lang`, `dir` (rtl/ltr), the font-size dataset, `--primary` plus a WCAG-contrast-computed `--primary-foreground`, and localized meta/title. Validate the primary hex with a strict regex (`/^#[0-9a-fA-F]{6}$/`) and clamp to the default (`#2e6acd`) on failure. This is a measurable first-paint and CLS win generic SPAs skip entirely.

```html
<!-- index.html, synchronous before /src/main.tsx -->
<script>(() => {
  const language = resolveLanguage();
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.fontSize = resolveFontSize();
  const primaryColor = resolvePrimaryColor(); // hex-validated, default '#2e6acd'
  document.documentElement.style.setProperty('--primary', primaryColor);
  document.documentElement.style.setProperty('--primary-foreground', contrastForeground(primaryColor));
})();</script>
```

### Animate numbers through one wrapped, lint-enforced component

Animate changing numeric values — stats, counters, zoom — with `@number-flow/react`, which uses CSS/Web-Animations for GPU-friendly digit transitions instead of re-rendering on every tick. But route every usage through one local wrapper (`animated` defaults to true) so behavior is consistent app-wide and the library can be swapped or reconfigured in one place. Make the convention non-optional with `no-restricted-imports` banning the raw library everywhere except the wrapper.

```js
// eslint.config.js
'no-restricted-imports': ['error', { paths: [{
  name: '@number-flow/react',
  message: 'Use @/components/ui/number-flow so number animations stay consistent.'
}] }],
// with an override exempting only src/components/ui/number-flow.tsx
```

```tsx
// number-flow.tsx wrapper
const NumberFlow = forwardRef<NumberFlowElement, NumberFlowProps>(function NumberFlow(props, ref) {
  const { animated = true, ...rest } = props;
  return <ExternalNumberFlow ref={ref} animated={animated} {...rest} />;
});
```

### Rules

- Set `build.target: 'esnext'`, `minify: 'esbuild'`, `chunkSizeWarningLimit: 2000`; enable router `autoCodeSplitting`. Never hand-author `manualChunks`.
- Enable `babel-plugin-react-compiler` and turn OFF the react-hooks rules it owns (`exhaustive-deps`, `preserve-manual-memoization`, `immutability`, etc.). Add `memo`/`useMemo`/`useCallback` only on a measured hot path, with an explicit comparator.
- Precompress every asset as both `.gz` and `.br` at build time; negotiate `.br` > `.gz` > raw at the server with `Content-Encoding` + `Vary: Accept-Encoding`.
- Cache hashed `/assets/*` as `max-age=31536000, immutable`; serve `index.html`, `version.json`, `sw.js`, `workbox-*` as `no-cache`. Mirror the policy in the preview server.
- Tier the SW runtime cache: CacheFirst for hashed JS/CSS (250 entries, 1yr) and fonts (40, 30d); StaleWhileRevalidate for remote images (300, 30d). Set `maximumFileSizeToCacheInBytes` 8MB; exclude `version.json` from precache.
- Emit a sha256 `buildHash` `version.json` (no-cache) and probe for SW updates hourly + on `visibilitychange` + on `online`.
- Register `vite:preloadError` / `unhandledrejection` / resource-error listeners that clear router + workbox caches and reload to the latest build, guarded against reload loops.
- Virtualize long lists with `overscan: 5` and a `+1` loader row; prefetch the next page at 6 rows OR 160px from the end.
- Code-split heavy dialogs/panels with `lazy()` + `import()` and warm-mount during idle via `LazyMount` (150ms then `requestIdleCallback`, 1200ms timeout).
- Gate all warmup on `navigator.connection` (skip Save-Data + 2g/slow-2g), pause on hidden tabs, warm one asset at a time on idle.
- Preload route chunk + destination queries on hover, throttled per-pathname to 30s.
- Persist the query cache to IndexedDB (`throttleTime` 1000ms, `maxAge` 30d, deployment-scoped key, schema-version `buster`, success-only dehydrate); resume paused mutations on success.
- `optimizeDeps.include` the barrel/deep deps (`@phosphor-icons/react`, `zustand/react/shallow`); import devtools' `/production` build outside DEV.
- Run the `find:unused-*` sweep scripts in CI and set `unused-imports/no-unused-imports` to `error`.
- Set `lang`/`dir`/font-size/`--primary` + contrast foreground in a synchronous inline `<head>` script before React mounts.
- Animate numbers only through the `@number-flow/react` wrapper; ban the raw import with `no-restricted-imports`.

---

## 9. i18n (English-first, Arabic toggle), RTL-from-day-one, and Accessibility

Localization is not a feature you bolt on before launch — it is the substrate the entire UI sits on. Direction (LTR/RTL) and locale are first-class document state: synced onto `<html>` and `<body>` (`lang` + `dir`) and exposed through reactive hooks, never inferred ad-hoc inside JSX. Every spatial decision is expressed in logical terms (`start`/`end`, `ms`/`me`, `ps`/`pe`, `border-s`/`border-e`) so one class string renders correctly mirrored in Arabic with no second stylesheet — physical `left`/`right` survives only where the meaning is genuinely physical. Accessibility lives in the design-system primitives (Radix + Base UI), not reinvented per screen. You will make the wrong thing hard to write.

### Configure i18next once: single namespace, feature-scoped keys, typed off English

Do configure i18next exactly once with one `translation` namespace, feature-scoped top-level keys (~57 of them: `meta`, `common`, `signIn`, `patients`, `sales`, `settings`, `countries`, ...), and a resource type derived from the English JSON. The English file is the single source of truth — make missing keys a compile error, never a runtime `??`.

```ts
export const defaultNS = 'translation';

export const resources: Record<Locale, { translation: TranslationResource }> = {
  en: { translation: enTranslation },
  ar: { translation: arTranslation }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: FALLBACK_LOCALE,        // 'ar'
    supportedLngs: SUPPORTED_LANGUAGES,  // ['en','ar']
    defaultNS,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY, // 'clinic-manager:language'
      caches: ['localStorage'],
      convertDetectedLanguage: resolveLocale     // strips region: en-US -> en
    },
    interpolation: { escapeValue: false },
    load: 'currentOnly',
    returnNull: false,
    react: { useSuspense: false }
  });

// types: TranslationResource = typeof en  (en.json drives the type)
```

Supported locales are `['en','ar']`; `RTL_LANGUAGES = ['ar']`; `FALLBACK_LOCALE = 'ar'`. Never split into many namespaces and never type a screen's strings ad-hoc — one namespace, feature-scoped keys, typed off `en.json`.

### Sync direction + locale onto the document — centrally, on every change

Do write `lang` and `dir` onto BOTH `document.documentElement` and `document.body` on every language change, and update `title`/`meta`/`og:locale` at the same time. Subscribe to i18next's `languageChanged` once at the provider root. Putting `dir` on the document is what makes CSS logical properties and `[dir]`-scoped selectors work everywhere — do it centrally so no component ever reasons about direction except to read it.

```ts
export function syncDocumentLocale(language: string | undefined): void {
  if (typeof document === 'undefined') return;
  const locale = resolveLocale(language);
  const direction = getDirection(locale); // RTL_LANGUAGES.includes -> 'rtl' : 'ltr'

  for (const target of [document.documentElement, document.body]) {
    if (target) {
      target.lang = locale;
      target.dir = direction;
    }
  }
  document.title = i18n.t('meta.appTitle');
  setMetaContent('meta[property="og:locale"]', locale === 'ar' ? 'ar_EG' : 'en_US');
}

// root-provider.tsx wires it once:
useEffect(() => {
  syncDocumentLocale(runtimeI18n.language);
  runtimeI18n.on('languageChanged', syncDocumentLocale);
  return () => runtimeI18n.off('languageChanged', syncDocumentLocale);
}, [runtimeI18n]);
```

The `og:locale` mapping is `ar -> 'ar_EG'`, `en -> 'en_US'`. Never hardcode `dir="ltr"` on `<html>` or assume LTR — the document direction is dynamic.

### Read runtime direction through `useDirection()`, never `i18n.language === 'ar'`

Components that need the live direction (e.g. setting `dir={direction}` on a `<input type="tel">`) must read it through a reactive hook that reflects the actual document `dir`, falls back to `i18n.dir()`, and re-renders on BOTH `languageChanged` AND a `MutationObserver` on the `dir` attribute. This keeps it correct even if direction is toggled outside i18next.

```ts
export function useDirection(): TextDirection {
  const { i18n } = useTranslation();
  const fallback = () => i18n.dir() as TextDirection;
  const [direction, setDirection] = useState<TextDirection>(() =>
    resolveDirection(fallback)
  );
  useEffect(() => {
    const update = () => setDirection(resolveDirection(fallback));
    update();
    i18n.on('languageChanged', update);
    const observer = new MutationObserver(update);
    const opts = { attributes: true, attributeFilter: ['dir'] };
    observer.observe(document.documentElement, opts);
    if (document.body) observer.observe(document.body, opts);
    return () => { i18n.off('languageChanged', update); observer.disconnect(); };
  }, [i18n]);
  return direction;
}
```

Never branch on `i18n.language === 'ar'` inside a component — use `getDirection()` / `useDirection()` and CSS `[dir]` selectors.

### Per-direction font stacks swapped via `:root[dir]`

Arabic needs an Arabic-shaped face (Tajawal) for legibility and correct metrics; Latin needs Geist. Do define two CSS variables and swap them with the document `dir` attribute so the whole tree reflows fonts on a single attribute flip with zero JS. Never set `font-family` per component by language.

```css
:root {
  --app-font-family-rtl: 'Tajawal', 'Amiri', 'Geist', 'PT Serif', -apple-system, …, sans-serif;
  --app-font-family-ltr: 'Geist', 'PT Serif', 'Tajawal', 'Amiri', -apple-system, …, sans-serif;
}
:root[dir='rtl'] body, body[dir='rtl'] {
  font-family: var(--app-font-family-rtl);
  text-align: right;
}
:root[dir='ltr'] body, body[dir='ltr'] {
  font-family: var(--app-font-family-ltr);
  text-align: left;
}
:root[dir='rtl'] [dir='auto'] { text-align: right; }
:root[dir='ltr'] [dir='auto'] { text-align: left; }
```

Ship Tajawal at weights 400/500/700, `font-display: block`, `.woff2` for the app (and a `.woff` registered separately for PDFs — see below). `arabic-reshaper` may sit in `package.json`, but you do not import it in `src`: shaping is delegated to the Tajawal font and the renderer.

### Logical Tailwind utilities everywhere; physical left/right only when physical

Do express every mirrorable spacing and positioning decision with logical utilities: `ms-`/`me-`/`ps-`/`pe-`, `start-`/`end-`, `border-s`/`border-e`, `rounded-s`/`rounded-e`, `text-start`/`text-end`, and `rtl:flex-row-reverse`. One class string then renders correctly in both directions — there is no RTL override sheet. Reserve `left-`/`right-` for genuinely physical things: a centering `left-1/2`, a left-pointing scroll-hint arrow.

```tsx
// phone input country button uses logical border:
<button className="flex h-full shrink-0 ... gap-1 border-e border-border-default bg-background-surface px-3" />

// tel input uses logical padding-start + live dir:
<input type="tel" inputMode="numeric" dir={direction}
  className="h-full flex-1 bg-transparent ps-3 text-sm ..." />

// Kbd group reverses chord order in RTL:
<kbd className="inline-flex items-center gap-1 ltr:flex-row rtl:flex-row-reverse" />

// drawer keeps logical borders even on physical sides:
left:  'inset-y-0 left-0 h-full w-3/4 border-e sm:max-w-sm',
right: 'inset-y-0 right-0 h-full w-3/4 border-s sm:max-w-sm'
```

This is measurable. In a faithful build the logical utilities dominate and physical ones are rare and meaningful:

| Utility | Usage count | Utility | Usage count |
|---|---|---|---|
| `ms-` | 644 | `border-s` | 66 |
| `me-` | 105 | `border-e` | 39 |
| `ps-` | 91 | `rounded-s` | 34 |
| `pe-` | 47 | `start-` / `end-` | 33 / 43 |
| `rtl:` variants | 27 | `ltr:` variants | 9 |

Never sprinkle `ml-`/`mr-`/`pl-`/`pr-`/`left`/`right`/`text-left`/`text-right` for mirrorable layout — they silently break Arabic and force a second RTL stylesheet.

**Anti-pattern (AI-vibe smell):** the generic build scatters `ml-2`, `mr-4`, `pl-3`, `text-left`, `left-2` everywhere and never notices Arabic is broken because it only ever renders LTR. The correct build has `ms-` used 644 times and `left-[n]` in components down in single digits, only for truly physical cases.

### Mirror directional icons with `rtl:rotate-180`

Carets, arrows, and chevrons that point along the reading axis must flip in RTL. Do it with one token on the icon's className — same icon component for both directions, no separate RTL icon import.

```tsx
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

const NAV_ICON = { className: 'size-5 md:size-6 text-text-tertiary rtl:rotate-180' };

// steps-dialog chevron:
<CaretIcon className="rtl:rotate-180" />
```

Never leave a "next" caret pointing the wrong way in Arabic, and never import a separate RTL-specific icon.

### Locale-aware dates: Arabic month names, Latin digits, cached formatters

Clinical UIs need unambiguous digits — Eastern-Arabic numerals are error-prone for staff reading dosages and dates. Do format through `Intl.DateTimeFormat` keyed on a normalized locale tag (`ar -> ar-SA`, `en -> en-US`), force `numberingSystem: 'latn'` for Arabic so digits stay Latin while month names localize, and cache formatter instances in a bounded `Map` (max 64, cleared when full) so you never re-instantiate an expensive object per render.

```ts
const LOCALE_TAG_BY_LANGUAGE: Record<string,string> = { ar: 'ar-SA', en: 'en-US' };

export function withLatinNumeralsIfArabic(locale: string) {
  return isArabicLocale(locale) ? { numberingSystem: 'latn' } : {};
}

function getDateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const cacheKey = `${locale}|${JSON.stringify(options)}`;
  const cached = formatterCache.get(cacheKey);
  if (cached) return cached;
  if (formatterCache.size >= MAX_FORMATTER_CACHE_SIZE) formatterCache.clear();
  const f = new Intl.DateTimeFormat(locale, options);
  formatterCache.set(cacheKey, f);
  return f;
}

export function formatDate(locale: string, input: DateInput): string {
  return getDateTimeFormatter(toLocaleTag(locale), {
    year: 'numeric', month: 'short', day: 'numeric',
    ...withLatinNumeralsIfArabic(locale)
  }).format(getValidDate(input)!);
}
```

Apply the same discipline to currency: symbol `₪`, locale `en-IL`, `minimumFractionDigits`/`maximumFractionDigits = 2`, with compact form via `Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })` — and cache those formatters too. Never show Eastern-Arabic numerals for clinical dates or amounts, and never instantiate `Intl.DateTimeFormat`/`NumberFormat` per render.

### Pluralization and interpolation belong in the locale data, never in JS

Arabic has different plural categories and RTL join semantics. Do use i18next `_one`/`_other` plural keys and `{{count}}`/`{{name}}` interpolation, and assemble human-readable durations from translated fragments joined by a translated join token. Never concatenate translated words in JS.

```ts
// en.json
"multipleTeeth_one": "{{count}} tooth",
"multipleTeeth_other": "{{count}} teeth",
"removeFromPlacement": "Remove from {{placement}}"

// usage
if (hours > 0) parts.push(t('common.humanReadableDuration.hours', { count: hours }));
if (minutes > 0) parts.push(t('common.humanReadableDuration.minutes', { count: minutes }));
return parts.join(t('common.humanReadableDuration.join'));
```

**Anti-pattern (AI-vibe smell):** the generic build writes `${count} teeth` or `2 h 30 m` in JS. That has no plural categories and no RTL-aware join — it breaks Arabic grammar. Keep grammar in the locale file.

### Carry RTL into generated PDFs

`@react-pdf` has no logical properties, so RTL must be computed. Do derive a `PdfDirectionTokens` object from `isRtl` and build the entire StyleSheet from those tokens: rows become `row-reverse`, `textAlign` becomes start/end-aware, physical paddings and borders flip. Register the Tajawal font (`.woff`) so Arabic renders glyphs instead of tofu.

```ts
export function getPdfDirectionTokens(isRtl: boolean): PdfDirectionTokens {
  return {
    dir: isRtl ? 'rtl' : 'ltr',
    startAlign: isRtl ? 'right' : 'left',
    endAlign: isRtl ? 'left' : 'right',
    flexStart: isRtl ? 'flex-end' : 'flex-start',
    flexEnd: isRtl ? 'flex-start' : 'flex-end',
    rowDirection: isRtl ? 'row-reverse' : 'row'
  };
}

// styles built from tokens:
header: { flexDirection: rowDirection, ... },
infoColumnBorder: isRtl
  ? { borderRightWidth: 1, borderRightColor: PDF_COLORS.border, paddingRight: 16 }
  : { borderLeftWidth: 1, borderLeftColor: PDF_COLORS.border, paddingLeft: 16 },

// font registered once:
Font.register({ family: 'Tajawal', fonts: [
  { src: '/fonts/Tajawal-Regular.woff', fontWeight: 400 }, …
]});
```

Never render a clinical invoice or prescription LTR-only, and never omit the Arabic font.

### Accessible primitives from Radix + Base UI, with translated a11y copy

Do build interactive UI on `radix-ui` (the unified package, ~13 imports) and `@base-ui/react` primitives (tooltip, tabs, menu, accordion; slider via `@radix-ui/react-slider`). They give you correct roles, focus trapping, escape handling, and ARIA wiring for free. Feed them translated accessibility strings from the translation file — the `drawerAccessibility.*` keys exist precisely so screen-reader labels are localized, not English-only.

```ts
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Tooltip } from '@base-ui/react/tooltip';

// en.json carries the a11y copy:
"drawerAccessibility": {
  "popoverTitle": "Options",
  "popoverDescription": "Additional options and actions",
  "selectTitle": "Select option",
  "searchDescription": "Search and filter results"
}
```

Build the same discipline into custom inputs: the phone input is custom (Radix Popover + `@tanstack/react-virtual` list, dir-aware `tel` field, country labels via `t(\`countries.${code}\`)`) rather than `react-phone-number-input`, and the date picker is a custom `Intl`-localized component rather than `react-day-picker`. Never ship native `<div onClick>` tooltips/menus with no roles, and never ship English-only ARIA labels.

### One uniform, quiet focus-visible ring system

Do give every interactive variant component (Button, IconButton) `outline-none focus-visible:ring-0.4` in its CVA base string, plus a per-variant ring color tinted to the variant. A uniform, subtle (0.4 width) ring gives keyboard users a clear-but-quiet indicator that matches the design language — not the default browser outline and not a loud 2px neon glow.

```ts
const buttonVariants = cva(
  'relative flex gap-x-2 full-center group rounded-lg outline-none focus-visible:ring-0.4 cursor-pointer transition-all border border-transparent duration-100 overflow-hidden',
  { variants: { variant: {
    default: 'bg-background-base hover:bg-background-surface ... focus-visible:ring-border-default/50',
    destructive: 'text-white bg-destructive ... focus-visible:ring-destructive/50',
    success: 'text-success ... focus-visible:ring-success/20'
  }}}
);
```

### Global keyboard shortcuts with platform-aware `Kbd` hints

Power users expect Ctrl/⌘ shortcuts. Do register them with `@tanstack/react-hotkeys` `useHotkey`, gated by `{ enabled, preventDefault, ignoreInputs }` so they never fire while typing or on the wrong route. Display hints with a `<Kbd keyId="mod" />` component that resolves to ⌘ on Mac and Ctrl elsewhere via a cached `getIsMac()`, and reverse the chord order in RTL with the `KbdGroup`.

```ts
useHotkey({ key: '/', ctrl: true }, () => store.toggle('keyboardShortcuts'),
  { enabled: areGlobalShortcutsEnabled, preventDefault: true, ignoreInputs: true });

const MAC_KEY_MAP = { mod: '⌘', shift: '⇧', enter: '↵', escape: 'Esc', alt: '⌥' };
const DEFAULT_KEY_MAP = { mod: 'Ctrl', shift: 'Shift', enter: '↵', escape: 'Esc', meta: 'Win' };
function getKeyDisplay(keyId: string) {
  const map = getIsMac() ? MAC_KEY_MAP : DEFAULT_KEY_MAP;
  return map[keyId.toLowerCase()] ?? (keyId.length === 1 ? keyId.toUpperCase() : keyId);
}

// hint UI:
<KbdGroup>
  <Kbd keyId="mod" variant="outline" size="sm" />
  <Kbd keyId="/" variant="outline" size="sm" />
</KbdGroup>
```

Never render keyboard glyphs as plain `'Cmd'+'K'` text without platform detection.

### Respect reduced motion in JS for JS-driven animation

The expensive, attention-grabbing animations (the AI voice orb sphere, live voice surface, canvas effects) are JS-driven, so a CSS `prefers-reduced-motion` block alone will not stop them. Do read `useReducedMotion()` from `motion/react` and branch to a static, no-loop variant. CSS keyframe utilities can stay simple because the heavy motion is JS.

```tsx
const reducedMotion = useReducedMotion();
const shouldReduceMotion = reducedMotion === true;
// voice orb: render a static sphere (no animation loop) when reduced
<VoiceOrbGlow reducedMotion={shouldReduceMotion} />
```

There is no global `prefers-reduced-motion` CSS block doing the heavy lifting — the branch happens in JS where the loop lives.

### Direction-aware placeholders for LTR-forced fields inside RTL

Email and password content is Latin and reads LTR, but inside an Arabic layout the placeholder should still align to the reading edge. Do mark these fields `dir="ltr"` for their content, then realign the placeholder per document direction in CSS. Use `unicode-bidi: isolate` utilities for truncation that must respect a fixed direction.

```css
html[dir='rtl'] input[type='email'][dir='ltr']::placeholder,
html[dir='rtl'] input[type='password'][dir='ltr']::placeholder {
  direction: rtl;
  text-align: right;
}
html[dir='ltr'] input[type='email'][dir='ltr']::placeholder,
html[dir='ltr'] input[type='password'][dir='ltr']::placeholder {
  direction: ltr;
  text-align: left;
}
/* bidi isolation utilities */
.truncate-ltr { direction: ltr; unicode-bidi: isolate; }
.truncate-rtl { direction: rtl; unicode-bidi: isolate; }
```

### Rules

- Configure i18next once: one `translation` namespace, feature-scoped keys, `TranslationResource = typeof en`, `fallbackLng`/`supportedLngs`/`load:'currentOnly'`/`useSuspense:false`.
- Sync `lang` + `dir` to `document.documentElement` AND `document.body` on every `languageChanged`, centrally at the provider root, plus `title`/`meta`/`og:locale`.
- Read runtime direction via `useDirection()` (observes the `dir` attribute + `languageChanged`); never `i18n.language === 'ar'` in components.
- Use logical Tailwind utilities (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`border-s`/`border-e`/`rounded-s`/`rounded-e`/`text-start`/`text-end`) for everything mirrorable.
- Reserve `left-`/`right-` for genuinely physical positioning only; never use `ml-`/`mr-`/`pl-`/`pr-`/`text-left`/`text-right` for layout.
- Mirror directional carets/arrows with `rtl:rotate-180`; reverse inline/chord groups with `rtl:flex-row-reverse`.
- Swap font stacks via `:root[dir='rtl']`/`:root[dir='ltr']` (Tajawal for Arabic, Geist for Latin); never set `font-family` per component by language.
- Force `numberingSystem:'latn'` for Arabic dates/times; cache `Intl` formatters in a bounded `Map`; never instantiate them per render.
- Keep plurals/durations in the locale data with `_one`/`_other` keys, `{{interpolation}}`, and a translated join token; never concatenate translated words in JS.
- Derive `PdfDirectionTokens` from `isRtl` and register the Tajawal font so generated PDFs render RTL; never ship LTR-only PDFs.
- Build interactive UI on Radix/Base UI primitives; feed them translated a11y labels (`drawerAccessibility.*`); never English-only ARIA.
- Give every interactive variant `outline-none focus-visible:ring-0.4` with a variant-tinted ring color; never the default outline or a loud neon ring.
- Provide keyboard shortcuts via `useHotkey` gated by `{ enabled, preventDefault, ignoreInputs }`, with platform-aware `Kbd` glyphs (`mod -> ⌘/Ctrl`).
- Branch JS/canvas animation on `useReducedMotion()` to a static variant; never rely on a CSS media query alone to stop a JS loop.
- Mark LTR-forced fields (email/password) `dir="ltr"` and realign their placeholders per document direction; use `unicode-bidi: isolate` for direction-fixed truncation.

---

## 10. Tooling & Discipline: The Quality-Preservation Machine

Quality here is not a vibe you hope survives the next merge — it is mechanically enforced by a fleet of custom checkers that codify the house style so it cannot drift. Any rule worth following is worth a script that fails CI, and any auto-fix worth running must verify itself. A generic AI frontend ships dead code, `any`, hardcoded strings, and LTR-only classes because nothing stops it; you will build a machine that makes those literally un-mergeable. Three pillars carry it: a strict TypeScript baseline plus one parallel mega-gate, a small set of opinionated local lint rules, and an aggressive dead-code sweeper family that guarantees no orphan symbol ever rots in the tree.

### The single pre-merge gate

Do build one aggregate command that runs everything. It always runs the backend type-sync first, then fans eslint/prettier (chunked per worker), tsc, and ~24 custom structure/dead-code checkers across CPU cores via `Promise.all`, exiting non-zero if any task group fails. Run it constantly; it is cheap because lint is chunked across workers.

```ts
// package.json
"tsc": "bun run sync:convex && tsc --noEmit --pretty",
"check": "bun run sync:convex && bun run scripts/check/index.ts",

// scripts/check/index.ts
const isCheck = (process.argv[2] ?? 'check') !== 'fix';
const coreCount = cpus().length;
const workerCount = Math.min(Math.max(Math.floor(coreCount / 3), 2), 6);
const results = await Promise.all(allTasks.map(runTask));
if (allFailed.length > 0) process.exit(1);
```

The worker count is `Math.min(Math.max(Math.floor(cores / 3), 2), 6)` — between 2 and 6 eslint/prettier chunks — which keeps a large repo's lint to a couple of seconds. The 27 task groups are: eslint, prettier, tsc, structure, dialog-structure, i18n (parity + unused), empty-folders, single-file-component-folders, the full `unused-{assets,components,exports,utils,constants,schemas,stores,lib,types,hooks,route-warmup,dialogs,permissions,pages,routes}` family, component-placement, barrel-exports, file-size-complexity, and class-name-composition.

Every checker takes a mode. `check` is read-only (eslint without `--fix`, prettier `--check`); `fix` repairs the tree (eslint `--fix`, prettier `--write`). The same tool gates CI and repairs locally, so the fix and the rule can never diverge. Noisy heuristics run `--report-only` so they surface signal without blocking merges.

```ts
// define-tasks.ts
export function buildEslintTasks(chunks, isCheck) {
  return chunks.map((chunk, index) => ({
    cmd: [execPath, ESLINT_BIN, '--cache', '--cache-strategy', 'content',
      '--cache-location', join(ESLINT_CACHE_DIR, `.eslintcache.${index}`),
      '--no-warn-ignored',
      ...(isCheck ? [] : ['--fix']), ...chunk],
    group: 'eslint'
  }));
}
const buildReportTask = (isCheck, label, script, showOutputAlways = false) =>
  buildSingleBunTask(isCheck, label, script, { args: ['--report-only'], showOutputAlways });
```

eslint is content-cached per worker at `node_modules/.cache/eslint/.eslintcache.<n>` so repeat runs stay near-instant.

### TypeScript baseline: the compiler is your first dead-code checker

Compile in strict mode and let the compiler do work. `noUnusedLocals` + `noUnusedParameters` mean tsc itself flags dead locals; `verbatimModuleSyntax` pairs with the type-imports lint rule so type-only imports erase correctly. Import every src module through the `@/*` alias and consume generated backend types through `@convex-be/*`.

```ts
// tsconfig.json compilerOptions
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"verbatimModuleSyntax": true,
"allowImportingTsExtensions": true,
"moduleResolution": "bundler",
"target": "ES2022",
"paths": { "@/*": ["./src/*"], "@convex-be/*": ["./convex-dist/convex/*"] }
```

`bun run tsc` (`tsc --noEmit`) is part of the gate. A failing typecheck is a failing merge.

### Core ESLint policy

Make the type contract explicit and the module graph uniform. Named exports only is not aesthetic — it is what makes the dead-code graph analysis reliable.

```ts
// eslint.config.js
'@typescript-eslint/no-explicit-any': 'error',
'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
'@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
'import/no-default-export': 'error', // except routes, configs, .d.ts
'unused-imports/no-unused-imports': 'error',
'padding-line-between-statements': ['error', { blankLine: 'always', prev: '*', next: 'return' }],
'no-restricted-imports': ['error', { paths: [{ name: '@number-flow/react',
  message: 'Use @/components/ui/number-flow so number animations stay consistent.' }] }],
'no-console': ['warn', { allow: ['warn', 'error'] }]
```

Do route every shared dependency through one wrapper (here `@number-flow/react` → `@/components/ui/number-flow`) so animation behavior stays consistent app-wide. A blank line before every `return` is mandatory. `console.log` is forbidden; only `warn`/`error` survive.

### Custom local lint rules

These encode the conventions no off-the-shelf rule covers. Recreate the spirit of each, wire them through your flat config, and make the auto-fixable ones fixable.

**Single `props` object, never destructured.** Components take `props: XProps` and read `props.patient`. This keeps prop provenance greppable, plays well with the React Compiler's memoization, and forces a named `XProps` interface per component.

```js
// no-destructured-props.js
if (firstParam.type === 'ObjectPattern') {
  context.report({ node: firstParam,
    message: `Component "${name}" should not destructure props in the function signature. Use "props: ${name}Props" instead.` });
}
```

**Hook-variable naming.** Name the variable holding a custom hook's result after the hook minus `use`: `const patientDialog = usePatientDialog()`. A curated SKIP set exempts React/TanStack/library hooks, any call with arguments (selector pattern), and names ending in `Store`.

```js
// hook-variable-naming.js
if (SKIP_HOOKS.has(hookName)) return;
if (node.init.arguments.length > 0) return;      // selector/param pattern (zustand)
if (hookName.endsWith('Store')) return;          // stores return selected values
const expected = hookName.slice(3)[0].toLowerCase() + hookName.slice(4);
if (actual !== expected) context.report({ node: node.id,
  message: `Hook variable should be named "${expected}" (from ${hookName}), but found "${actual}".` });
```

**RTL logical Tailwind only — auto-fixable.** Never use direction-specific classes. The rule fires only inside `className`/`class` attributes or `cn`/`clsx`/`cva`/`twMerge`/`twJoin` calls, and rewrites the literal to its logical equivalent. Also strip `text-start` — alignment is inherited from document `dir`.

```js
// no-ltr-tailwind.js
const LTR_TO_LOGICAL = { pl:'ps', pr:'pe', ml:'ms', mr:'me', 'text-right':'text-end',
  'border-l':'border-s', 'border-r':'border-e', 'rounded-tl':'rounded-ss',
  'rounded-tr':'rounded-se', 'rounded-bl':'rounded-es', 'rounded-br':'rounded-ee',
  'float-left':'float-start', 'scroll-pl':'scroll-ps' /* … */ };
context.report({ node,
  message: `Use logical property "${logicalClass}" instead of LTR-specific "${ltrClass}" for RTL support.`,
  fix(fixer) { /* replaces in node.raw */ } });
```

| LTR class | Logical replacement |
|-----------|---------------------|
| `pl-*` / `pr-*` | `ps-*` / `pe-*` |
| `ml-*` / `mr-*` | `ms-*` / `me-*` |
| `text-right` | `text-end` |
| `border-l` / `border-r` | `border-s` / `border-e` |
| `rounded-tl` / `rounded-tr` | `rounded-ss` / `rounded-se` |
| `rounded-bl` / `rounded-br` | `rounded-es` / `rounded-ee` |
| `float-left` / `float-right` | `float-start` / `float-end` |
| `scroll-pl` / `scroll-pr` | `scroll-ps` / `scroll-pe` |

**Permission constants only.** Never pass a string literal, template literal, or array of literals to `hasPermission`/`hasAnyPermission`/`hasAllPermissions`. Import and pass `PERMISSIONS.X`. Permission strings are a security surface; centralizing them makes the unused-permissions sweep possible and prevents typo-silent authorization holes.

```js
// no-hardcoded-permissions.js
const PERMISSION_FUNCTIONS = new Set(['hasPermission','hasAnyPermission','hasAllPermissions']);
if (arg.type === 'Literal' && typeof arg.value === 'string')
  context.report({ node: arg,
    message: `Use PERMISSIONS constant instead of hardcoded string "${arg.value}". Import PERMISSIONS from "@/constants/core/permissions".` });
```

**No placeholder comments — auto-fixable.** Placeholder comments are the fingerprint of vibe-coded, half-finished work. Ban them; whitelist JSDoc (`/** */`) and directive comments (`@ts-`, `eslint-disable`, `@param`). Auto-fix removes the line.

```js
// no-placeholder-comments.js
const PLACEHOLDER_PATTERNS = [/^\.\.\./, /^todo\b/i, /^fixme\b/i, /^hack\b/i,
  /^xxx\b/i, /placeholder/i, /implementation here/i, /stub/i, /add .* here/i, /rest of/i];
```

A practical note from the reference config: `hook-variable-naming`, `no-hardcoded-permissions`, and `no-ltr-tailwind` are enforced as `error`; `no-destructured-props`, `no-placeholder-comments`, and `no-destructured-hook-return` exist and are wired but currently set `off`. Ship the rules, decide your severities deliberately — the value is that the convention is codified and one switch away from blocking.

#### Anti-pattern (AI-vibe smell)

Generic AI writes `function PatientCard({ patient, onSelect })`, names hook results randomly (`const [a, b] = usePatientDialog()`), sprinkles `pl-4 mr-2 text-right rounded-l-lg`, hardcodes `hasPermission('patient:edit')`, and leaves `// TODO: wire this up`. Each of those is a specific, auto-flagged violation here. The correct shape:

```tsx
// Correct
interface PatientCardProps { patient: Patient; }
function PatientCard(props: PatientCardProps) {
  const patientDialog = usePatientDialog();
  const canEdit = hasPermission(PERMISSIONS.PATIENT_EDIT);

  return (
    <div className={cn('ps-4 me-2 text-end rounded-s-lg', canEdit && 'cursor-pointer')}>
      {props.patient.name}
    </div>
  );
}
```

### className composition and size budgets

Compose classes with `cn(...)`, passing static strings, variables, and conditionals as separate arguments. Never template-interpolate or concatenate inside `className` — it defeats tailwind-merge dedup and breaks the Tailwind IntelliSense regex. A TS-AST checker enforces this.

```ts
// class-name-composition.ts → reports 'template literal interpolation in className'
// file-size-complexity.ts
const thresholds = [
  { name:'routes',         pattern:/^src\/routes\//,          maxLines:90,  maxComplexity:15 },
  { name:'ui-components',  pattern:/^src\/components\/ui\//,   maxLines:450, maxComplexity:65 },
  { name:'app-components', pattern:/^src\/components\//,       maxLines:550, maxComplexity:75 },
  { name:'hooks',          pattern:/^src\/hooks\//,            maxLines:650, maxComplexity:90 },
  { name:'lib',            pattern:/^src\/lib\//,              maxLines:550, maxComplexity:80 },
  { name:'utils',          pattern:/^src\/utils\//,            maxLines:650, maxComplexity:90 },
];
```

| Area | Max lines | Max cyclomatic complexity |
|------|-----------|---------------------------|
| routes | 90 | 15 |
| ui-components | 450 | 65 |
| app-components | 550 | 75 |
| hooks | 650 | 90 |
| convex-data | 450 | 70 |
| lib | 550 | 80 |
| utils | 650 | 90 |
| default | 600 | 85 |

The tight 90-line route budget is intentional: routes are thin, logic lives in components and hooks.

### Structure enforcers

A structure checker keeps the module topology consistent — which is exactly what makes the dead-code graph analysis reliable. Require kebab-case filenames, a barrel `index.ts` in any component/hook folder with ≥2 files, ban deep imports past the folder index, ban manual route splitting (the router owns it), and warn on numeric arbitrary Tailwind values when a token exists.

```ts
// enforce-structure.ts
const deepImportPattern = /from\s+['"]@\/(components|hooks)\/(pages|common|core)\/([^'"]+)['"]/g;
if (/lazyRouteComponent/.test(content) || /lazy\s*\(/.test(content))
  report('automatic-route-code-splitting', file,
    'Route components should be statically attached; TanStack Router autoCodeSplitting owns route splitting');
```

### The dead-code sweeper family

Orphan exports are the slow rot of a codebase. Build a graph-based reachability scanner, not a grep. `find:unused-exports` parses every code file (comment-stripped), builds the import/export graph including named/namespace/wildcard re-exports and dynamic imports, marks reachability from forced entry roots plus ALWAYS_USED files, and reports any export never imported. Supports `--json`, `--path=`, `--kinds=`, `--limit=`. Force-mark app roots so they are never flagged.

```ts
// find-unused-exports.ts — entry roots that seed reachability
const forcedEntryImporters = [join(repoRoot,'src/main.tsx'),
  join(repoRoot,'server.ts'), join(repoRoot,'src/routes/_app.tsx'),
  join(repoRoot,'src/utils/core/route-intent-warmup.ts'), /* route-data-warmup, _admin, _auth, *.config.* */]
  .filter((f) => codeFileSet.has(f));
for (const importer of forcedEntryImporters) applyImportUsage(importer, false);
```

**The auto-remover verifies itself.** An auto-fixer that can introduce a build break is worse than no fixer. `fix:unused-exports` uses the real TypeScript compiler API to find unused exports, surgically strips them (de-exporting one binding in a multi-declaration statement, removing whole standalone decls), runs `eslint --fix` to clean orphaned imports, then counts tsc errors before and after — and rolls back every file from in-memory backups if the count regressed.

```ts
// remove-unused-exports.ts
const baselineErrors = countTscErrors('baseline');
/* re-apply edits */
const afterErrors = countTscErrors('after changes');
if (afterErrors > baselineErrors)
  rollback(`tsc reported ${afterErrors - baselineErrors} new error(s) after our changes.`);
// rollback() restores every file from the `backups` Map and process.exit(1)
```

**One engine, many scoped wrappers.** Each `find:unused-*` for a folder is a one-liner that delegates to a shared scoped runner, calling the export scanner with `--path=/<folder>/` and filtering to value kinds (function/const/let/var) by default, types only with `--include-types`. The config map is `satisfies Record<string, ScopedFindConfig>` so scopes stay type-checked, and each scope is independently runnable so you can clean one area at a time.

```ts
// unused-utils.ts
import { runScopedUnusedScript } from './shared/scoped-unused-scripts';
await runScopedUnusedScript('utils');

// shared/scoped-unused-scripts.ts
const SCOPES = { utils:{scopeLabel:'utils',pathFilter:'utils'},
  constants:{…}, schemas:{…}, stores:{…}, lib:{…}, types:{…}
} as const satisfies Record<string, ScopedFindConfig>;
```

**Hooks: dead functions and dead return properties too.** A hook can be "used" while half its returned API is dead weight. The hooks checker, beyond unused exports, flags module-level helpers referenced ≤1 time (via the TS LanguageService `findReferences`) under `--local-functions`, and under `--return-properties` flags keys a `useX()` hook returns that no consumer ever reads — tracing `useX().prop`, destructures, and `ReturnType<typeof useX>` consumers.

```ts
// find-unused-hooks.ts — return-property usage probed across all files
new RegExp(`\\b${hookName}\\(\\)(?:\\?\\.|\\.)${propertyName}\\b`),
new RegExp(`\\{[^}]*\\b${propertyName}\\b[^}]*\\}\\s*=\\s*${hookName}\\(\\)`)
// + roots from `const x = useX()` and `ReturnType<typeof useX>` consumers
```

**Dialogs: reachability from real usage roots.** Dialogs are lazy-loaded and registered indirectly, so grep misses them. Build the full module dependency graph, treat every file outside the dialog folders as a usage root, BFS-mark reachable files, and report dialogs never reached — handling `import.meta.glob` and dynamic `import()`, and conservatively skipping non-literal dynamic imports.

```ts
// find-unused-dialogs.ts
const usageRoots = codeFiles.filter(isUsageRoot).sort();   // everything not inside dialogts/
while (stack.length > 0) { const cur = stack.pop();
  reachable.add(cur);
  for (const dep of graph.get(cur) ?? []) if (!reachable.has(dep)) stack.push(dep); }
const candidates = dialogFiles.filter((f) => !reachable.has(f));
```

**Permissions, routes, route-warmup.** `find:unused-permissions` imports the real `PERMISSIONS` object, scans all src for `PERMISSIONS.KEY` and `'resource:action'` literals (mapping values back to keys), and lists unused constants. `unused-routes` cross-checks route files against the generated route tree; `unused-route-warmup` flags warmup hints pointing at routes that no longer exist. These are exactly the indirections that bit-rot silently.

```ts
// find-unused-permissions.ts
const PERMISSION_PROPERTY_REGEX = /\bPERMISSIONS\.([A-Z][A-Z0-9_]*)\b/g;
const PERMISSION_STRING_REGEX = /['"]([a-z][a-z0-9_]*:[a-z][a-z0-9_]*)['"]/g;
process.exit(unused.length > 0 ? 1 : 0);
```

### i18n parity

English-first with an Arabic toggle only works if the two key sets never drift. Flatten `en.json` and `ar.json`, strip plural suffixes (`_zero|one|two|few|many|other`), and fail if either locale lacks a key the other has. A sibling checker prunes orphan translation keys.

```ts
// enforce-i18n.ts
const arBaseKeys = new Set([...flattenKeys(arJson)].map(stripPluralSuffix));
const enBaseKeys = new Set([...flattenKeys(enJson)].map(stripPluralSuffix));
for (const key of enBaseKeys) if (!arBaseKeys.has(key)) missingInAr.push(key);
```

A new EN string cannot ship without its AR counterpart being noticed.

### Backend type-sync: the client cannot lie about the server

Every dev/build/tsc/check first runs `sync:convex`. It copies the sibling backend's Convex tree into a local source dir, applies a few FE-only patches, then emits `.d.ts` declarations into `convex-dist/`, consumed through the `@convex-be/*` alias. The contract is generated from the actual backend, so client types can never misrepresent the server — and a backend schema change surfaces as a FE tsc error immediately.

```ts
// package.json
"sync:convex": "bun run scripts/sync-convex-from-be.ts",
"emit:convex-types": "bunx tsc -p tsconfig.convex-emit.json && bun run scripts/copy-convex-generated-to-dist.ts",
// tsconfig.json
"paths": { "@convex-be/*": ["./convex-dist/convex/*"] }
```

Never hand-copy or re-declare backend types. Never skip `sync:convex` before a typecheck.

### Editor: make correctness automatic on save

Push the gate down to the keystroke so it rarely fails on style. Format on save with Prettier, run `source.fixAll.eslint: always`, sort imports react → react-dom → third-party → `@/`+relative (trivago), and run a custom Prettier plugin that strips blank lines between adjacent JSX elements to enforce tight, scannable JSX.

```js
// .vscode/settings.json
"editor.formatOnSave": true,
"editor.codeActionsOnSave": { "source.fixAll.eslint": "always" },
"eslint.useFlatConfig": true,
"updateImportsOnFileMove.enabled": "always",
// prettier.config.js  (tabWidth 2, printWidth 80, singleQuote true,
//                       jsxSingleQuote false, trailingComma 'none', arrowParens 'always', semi true)
importOrder: ['^react$','^react-dom$','<THIRD_PARTY_MODULES>',
  '^(?:@/(?:assets|components|constants|hooks|pages|routes|stores|utils)(?:/.*|$)|\\.\\.?/.*)$'],
plugins: ['@trivago/prettier-plugin-sort-imports',
  './scripts/tooling/prettier-custom-rules/index.js']
```

Mark the generated route tree readonly and exclude it from search/watch so it never pollutes results or triggers churn.

### Rules

- Run the aggregate `check` gate (and rely on tsc) before considering work mergeable; treat any failing task group as a hard blocker. Never bypass the gate.
- Compile `strict: true` with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`; import src via `@/*`.
- Type everything: a named `XProps` interface per component, `import type` for type-only imports, never `any` (it is an error).
- Accept props as one `props: XProps` object; never destructure in the signature.
- Name custom-hook results after the hook minus `use` (`const sendSmsDialog = useSendSmsDialog()`).
- Use logical Tailwind classes (`ps`/`pe`/`ms`/`me`/`text-end`/`border-s`/`rounded-ss`); let document `dir` drive alignment. Never write `pl-`/`pr-`/`ml-`/`mr-`/`text-right`/`border-l`/`rounded-l`.
- Reference permissions only via `PERMISSIONS.X`; never hardcode permission strings or template literals in `has*Permission` calls.
- Compose classes with `cn(...)` passing static strings, variables, and conditionals as separate args; never interpolate or concatenate inside `className`.
- Export named symbols (no default exports outside routes/configs/`.d.ts`); import from folder barrels, never deep paths.
- Keep routes ≤90 lines and respect every per-area line/complexity budget; never create god-files.
- Never add manual `lazy()`/`lazyRouteComponent` in route files — the router owns code splitting.
- Never leave dead code: orphan exports, unused hooks, unreferenced routes/dialogs/permissions/schemas/stores all fail dedicated checkers. Run `fix:unused-*` to prune, then re-run check.
- Never write `TODO`/`FIXME`/`HACK`/`// ...`/stub/`implementation here` comments in committed code.
- Never write arbitrary numeric Tailwind values (`mt-[13px]`) when a design token exists.
- Regenerate backend types with `sync:convex` and consume them via `@convex-be/*`; never hand-declare or skip the sync before typecheck.
- Keep `en.json` and `ar.json` key-parity intact for every user-facing string; never add a string in only one locale.
- Never `console.log` — only `warn`/`error` are allowed.
- Any auto-fixer that edits the tree must verify itself (tsc baseline + rollback on regression); never run a destructive fix that can break the build unverified.

---

## 11. The Agent Operating Protocol

This is the contract. Everything above this section describes WHAT the reference app is; this section tells you HOW to build it without regressing the quality bar. You are not assembling a working app — you are reproducing a *disciplined* one, where the folder layout is the mental model, the tokens are the only source of color, optimism is an architectural primitive, and RTL is the substrate. Build in the order below. Do not skip ahead to features because the scaffolding "works": a feature built before the tokens, primitives, and data engine exist is a feature you will rewrite.

### Build in this order — foundations before features

Do not write a single page until the layers beneath it exist. Each layer is a hard dependency of the next.

1. **Tokens + theme first.** Before any component, stand up the two-tier color system: every concrete value as a semantic CSS variable in one `:root` block (`colors.css`), then mapped to a Tailwind utility via `@theme inline` (`theme.css`). Define the neutral ramp (`--background-base` → `surface` → `elevated` → `muted`), the three text rungs (`--text-primary` `#0a0a0a`, `--text-secondary` `#525252`, `--text-tertiary` `#737373`), the single primary family (`--primary` `#2e6acd`, `-hover`, `-active`, `-light`), the matched state pairs (`success`/`warning`/`error` + `-bg` + `/30` border), and `chart-1..5` blue tints. Pin `colorScheme` light at boot and remove the `dark` class. Define `--app-font-family-ltr` (Geist-first) and `--app-font-family-rtl` (Tajawal-first), applied via `:root[dir='ltr'] body` / `:root[dir='rtl'] body`. **No component may reference a raw hex or a palette name (`bg-gray-100`) — ever.**

2. **Motion budget + utilities second.** Establish the two motion vocabularies as shared constants before any animated component exists: named springs (`{stiffness:400, damping:25, mass:0.8}` for the button spinner; damping 25–38 elsewhere) and tiered tweens (100ms instant, 150–220ms enter, 130–150ms exit, exits always faster than enters). Standardize the easings: `cubic-bezier(0.16,1,0.3,1)` for enters, `cubic-bezier(0.4,0,1,1)` for exits. Wire reduced-motion at every layer (`@media (prefers-reduced-motion: reduce)`, `useReducedMotion()` branches, NumberFlow `useCanAnimate()`).

3. **Primitives + the `cn` + CVA convention third.** Build the design-system leaf components on headless libraries (Radix for checkbox/label/select/popover/context-menu/avatar/dialog; Base UI for tooltip/menu/tabs/accordion). Every one is a `cva()` recipe over semantic tokens, props typed `React.ComponentProps<'el'> & VariantProps<typeof xVariants>`, classes resolved via `cn(xVariants({...}), className)` with caller `className` last, each root stamped `data-slot`. Build the dialog system (typed Zustand store + single `DialogWrapper`) and the `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` stack before any form screen.

4. **Data engine fourth.** Stand up the cache + optimistic engine: the query-options factory, the rollback engine (`setQueryDataWithOptimisticRollback`, `createOptimisticCacheRollback`), the cross-cache fan-out, and the persistence config (7-day `gcTime`, 30-day IndexedDB mirror). On a realtime backend, bridge it in (the reference: `ConvexQueryClient` with `queryKeyHashFn`/`queryFn`/`connect` + `makeConvexQuery`/`makeConvexIdQuery` + `staleTime: Infinity`). On a request/response backend, it is plain TanStack Query with your fetcher as `queryFn` (finite `staleTime`) and the optimistic lifecycle in `onMutate`/`onError`/`onSuccess` — the rollback engine, fan-out, factories, and persistence are identical (see §6, *Optimistic UI without a realtime backend*). Establish the `lib/data/<entity>/` quintet template (`queries.ts`, `hooks.ts`, `optimistics.ts`, `types.ts`, `index.ts`) as a copyable skeleton.

5. **Router shell fifth.** Configure the router (`defaultStaleTime: Infinity`, `defaultPreloadStaleTime: 0`, `defaultStructuralSharing: true`, no `pendingComponent`, no `defaultViewTransition`). Split into `_auth` / `_app` / `_admin` layout routes, each with its own cached-first `beforeLoad` guard. Wire the single `<NavigationProgress>` with the 400ms suppression delay and the four-layer warmup pipeline. Enable `autoCodeSplitting` and stale-build recovery.

6. **Features last** — and only by cloning the established slice + page templates. A new entity is a copy of the quintet; a new page mirrors the route tree under `_app`/`_auth`/`_admin`. If a feature wants to invent a new pattern, the pattern is wrong or the foundation is missing.

### Definition of Done — every component and feature must pass ALL of these

Do not mark anything complete until you can check every box. A green render is not Done.

- [ ] **Tokens only.** Zero raw hex, zero `bg-gray-*`/`text-gray-*`/arbitrary palette names. Surfaces from the neutral ramp, text from the three rungs, state colors only for state as matched pairs.
- [ ] **CVA + tokens.** Every styled element is a single `cva()` recipe; props are `React.ComponentProps<'el'> & VariantProps<...>`; classes merged with `cn(...)`, caller `className` last.
- [ ] **`data-slot` stamped** on the root and every meaningful sub-part; boolean state slots (`data-loading`, `data-error`, `data-invalid`) used for stateful styling.
- [ ] **Headless-backed.** Any interactive primitive wraps Radix/Base UI — never a hand-rolled `<div onClick>` button or raw checkbox.
- [ ] **Optimistic + rollback.** Every write hook follows the four-step body: `applyOptimistic…` (returns snapshot with `.rollback`) → `await` mutation → `replaceOptimistic…`/`syncToCache` on success → `snapshot.rollback()` + rethrow on catch. Fan-out patches the detail key AND every matching list AND the same entity embedded in related queries. No `invalidateQueries`-then-spinner.
- [ ] **Typed off the API.** Request/response types derived from the backend contract (Convex `FunctionArgs`/`FunctionReturnType` + `UnbrandConvexIds`, **or** OpenAPI/GraphQL codegen / shared `zod` schemas). No hand-written DTO interfaces. No `any`.
- [ ] **Reads through the factory.** Query options built with the query-options factory (`makeConvexQuery`/`makeConvexIdQuery`, or your fetcher equivalent); disabled queries report `isPending: false`, never a permanent spinner. No inline `convexQuery(...)` or `useQuery({ queryKey: [...] })` in components.
- [ ] **RTL + logical properties.** Only `ms-/me-/ps-/pe-/start-/end-/border-s/e/rounded-s/e/text-end`. No `pl/pr/ml/mr/text-right/border-l/r/rounded-l/r`. Reading-axis carets carry `rtl:rotate-180`; physical `left-/right-` only for genuinely physical positioning. No per-component language font logic — direction read via `useDirection()`.
- [ ] **A11y.** Real `focus-visible:ring-0.4` rings; keyboard + ARIA inherited from the headless primitive; `Kbd` hints platform-aware; reduced-motion honored where motion is JS-driven.
- [ ] **Motion within budget.** Springs only where something physically moves; tweens 100–220ms with the named easings; exits faster than enters; no `framer-motion`, no `{bounce:0.5}`, no 300ms blanket ease-in-out, no counters animating from 0 on mount (gate with `hasMounted`).
- [ ] **No dead code.** No orphan exports, hooks, routes, dialogs, permissions, schemas, stores, or assets. Named exports only (`default` reserved for lazy boundaries). Props as `props: XProps` (never destructured in the signature); hook result variables named after the hook minus `use`.
- [ ] **Permissions typed.** `hasPermission`/`hasAnyPermission`/`hasAllPermissions` receive `PERMISSIONS.X` constants — never string/template/array literals.
- [ ] **Gate is green.** `bun run check` and `bun run tsc` pass: eslint (incl. the 6 custom local rules), prettier, tsc, and all `find:unused-*` checkers exit 0.

### Guardrails — ask these BEFORE you write the line

These are stop-and-think gates. If you cannot answer, you are about to write AI-vibe code.

- **Before you write any color:** "Is there a semantic token for this?" If you typed `#`, a `bg-gray-`, or a gradient, stop — map a token in `colors.css` + `theme.css` and consume the Tailwind class. State color? Use the matched `text-<state>` + `bg-<state>-bg` + `border-<state>/30` pair, never decoratively.
- **Before you write any animation:** "Does something physically move?" Yes → a named over-damped spring (damping 25–38). No (fade/scale/color/hover) → a CSS tween, 100–220ms, named easing, exit faster than enter. Did you reach for `framer-motion` or a 300ms ease-in-out or a bounce spring? Stop — that is the generic default. Is reduced-motion handled?
- **Before you build any interactive element:** "Does Radix or Base UI already solve the focus/keyboard/ARIA?" If yes, wrap it — do not hand-roll. Did you stamp `data-slot`? Is it a `cva()` recipe? Are props `React.ComponentProps<'el'> & VariantProps`?
- **Before you fetch any data:** "Is there a `queries` entry and an entity slice for this?" Never `convexQuery(...)` inline, never `fetch`/`axios` in `useEffect`, never a manual loading boolean. Use the factory; reads are cache-first — websocket subscriptions on a realtime backend, cached fetches with a finite `staleTime` otherwise.
- **Before you write any mutation:** "Where is the snapshot, the fan-out, and the rollback?" If your plan is "mutate then `invalidateQueries`", stop — that is the spinner-flash anti-pattern. Snapshot every touched key, patch detail + lists + embedded entities, restore LIFO with the identity guard on throw.
- **Before you add any spacing/positioning class:** "Will this mirror in Arabic?" If you typed `pl-`, `mr-`, `text-right`, `border-l`, or `rounded-l`, stop — use the logical equivalent. Is this caret on the reading axis? Add `rtl:rotate-180`.
- **Before you add a route:** "Which audience layout owns this — `_auth`, `_app`, or `_admin`?" Is the guard cached-first (sync when warm, network only on cold+online)? Did you add a `pendingComponent`? Remove it — warm the destination instead.
- **Before you destructure props or name a variable:** "Is this `props: XProps`?" Never destructure in the signature. "Is this hook result named after the hook minus `use`?" `const patientDialog = usePatientDialog()`.

### House Rules — keep this block in context at all times

```
ARCHITECTURE
- Scope folders: common/ (reusable primitives), core/ (app-shell/infra), pages/ (mirror _app/_auth/_admin route tree). Never a 4th scope.
- Entity slice: lib/data/<entity>/ (lib/convex/data/ on Convex) = queries.ts + hooks.ts + optimistics.ts + types.ts + index.ts. Barrels ONLY at the slice boundary.
- Imports: @/ across src; ./ only within the same slice; @convex-be/* for generated backend. Never deep-import node_modules.
- Files kebab-case. Named exports only; default ONLY at lazy boundaries (re-map to {default: X}).

TYPES & DATA
- Types derived from backend contract: Convex FunctionArgs / FunctionReturnType + UnbrandConvexIds, OR OpenAPI/GraphQL codegen / shared zod. No hand-written DTOs. no-explicit-any is an ERROR.
- Reads: queries object via makeConvexQuery / makeConvexIdQuery (declare branded id args, e.g. {clinicId:'clinics'}). Never inline convexQuery(...). Disabled query => isPending:false.
- Writes (4 steps): applyOptimistic→snapshot(.rollback) | await mutation | replaceOptimistic/syncToCache | catch→snapshot.rollback()+rethrow.
- Fan-out: patch detail key + every matching list (respect its args/sort/filter/pagination) + same entity embedded in related queries. NO invalidate-then-spinner.
- Cache-first reads: realtime backend => staleTime:Infinity + websocket subscriptions; request/response => finite staleTime + quiet background refetch. gcTime 7d, IndexedDB mirror 30d. Optimistic writes (onMutate snapshot -> replace -> rollback) on EVERY backend; never refetch-with-spinner after a write.

COLOR & TYPE
- Two-tier: hex once as CSS var in colors.css → mapped via @theme inline in theme.css → consume Tailwind class only.
- Surfaces: bg-background-base/surface/elevated/muted. Text: text-text-primary/secondary/tertiary ONLY.
- Primary family only: primary / -hover / -active / -light / secondary. No gradients, no 2nd accent.
- State pairs only: text-<state> + bg-<state>-bg + border-<state>/30. Charts: chart-1..5. Light-only; dark removed at boot.

COMPONENTS
- cva(BASE,{variants,compoundVariants,defaultVariants}); props = React.ComponentProps<'el'> & VariantProps<typeof xVariants>.
- cn(...) from @/utils/common/cn ALWAYS; caller className LAST. Never string-concat classes.
- data-slot on root + sub-parts; boolean slots data-loading/error/invalid.
- Interactive = Radix / Base UI wrapper. Never hand-rolled <div onClick>/raw checkbox.
- Dialogs: typed Zustand store (DialogId union + DialogPayloads map + open<T>/close/getData<T>) + single DialogWrapper. Forms: RHF + per-render Zod (i18n messages) via Form/FormField/FormItem/FormControl/FormMessage.
- icons: prefixIcon/suffixIcon as Icon|ReactNode via renderIcon(DEFAULT_ICON_PROPS + caller iconProps). Wrap caller onClick/onPointerDown, don't replace.

MOTION
- Lib: motion/react (NOT framer-motion). Two vocabularies only.
- Springs (physical move only): button spinner {type:'spring',stiffness:400,damping:25,mass:0.8} animating width 0→auto; damping 25–38 elsewhere.
- Tweens: 100ms instant, 150–220ms enter, 130–150ms exit (exit < enter). Enter easing cubic-bezier(0.16,1,0.3,1), exit cubic-bezier(0.4,0,1,1).
- Dialog: overlay opacity 180/130ms; content scale 0.96→1 in 220ms / →0.985 out 150ms. Hover/focus = CSS transition-* duration-100, NOT motion lib. focus-visible:ring-0.4.
- Haptics in onPointerDown (touch/pen, button 0, not disabled/loading). Counters gate with hasMounted + tabular-nums. Reduced-motion at every layer.

ROUTER
- defaultStaleTime:Infinity, defaultPreloadStaleTime:0, defaultStructuralSharing:true, disableGlobalCatchBoundary:true. NO pendingComponent, NO defaultViewTransition.
- Layouts: _auth / _app / _admin, each own beforeLoad (cached-first, sync when warm, network only cold+online), errorComponent:false (defer to root).
- RouteType map: public|guest|setup|superAdmin|protected. redirect({to,replace:true}) for denials.
- validateSearch via createSearchValidator + parsers (optionalString/Enum/Uuid, withDefault); strip '' to undefined, throw on invalid.
- ONE <NavigationProgress>: start NProgress only after 400ms delay; color-mix from --primary; 2px; RTL scale:-1 1; showSpinner:false.
- autoCodeSplitting:true (no hand React.lazy for routes). Auto-reload on vite:preloadError / dynamic-import failure.

BUILD/PERF
- vite: target esnext, minify esbuild, chunkSizeWarningLimit 2000. NO manualChunks. babel-plugin-react-compiler ON; manual react-hooks lint rules OFF; memo/useMemo only on proven hot paths w/ explicit comparator.
- gzip + brotli (.br) at build; server negotiates .br→.gz→raw + Vary:Accept-Encoding.
- Cache-Control: hashed /assets/* immutable 1yr; index.html/version.json/sw.js no-cache; manifest max-age=0; else 10min. Same in Bun server AND vite preview.
- VitePWA autoUpdate + cleanupOutdatedCaches; CacheFirst assets(1yr)/fonts(30d), SWR remote images(30d). buildHash 8-char sha256; emit version.json + app-assets-manifest.json (non-precached). SW re-fetches sw.js hourly/on-visible/on-online.

I18N / RTL / A11Y
- i18next: one 'translation' namespace, feature-scoped keys, typed off English JSON. No per-screen literals.
- On languageChanged: write lang+dir to documentElement AND body + title/meta/og:locale. Read dir via useDirection() (live dir + MutationObserver), never i18n.language==='ar'.
- Fonts: --app-font-family-rtl (Tajawal) / -ltr (Geist) via :root[dir]. Latin numerals in Arabic dates. RTL into PDFs.
- Logical Tailwind ONLY: ms/me/ps/pe/start/end/border-s/e/rounded-s/e/text-end. Carets rtl:rotate-180; Kbd groups rtl:flex-row-reverse. Physical left/right only when truly physical.

DISCIPLINE (un-mergeable if violated)
- Single gate: bun run check + bun run tsc (runs sync:convex first, fans eslint/prettier/tsc + ~24 checkers via Promise.all). Custom rules: props NOT destructured; hook-var = hook name minus 'use'; logical Tailwind only; PERMISSIONS.X not literals; no placeholder comments; named exports only.
- hasPermission/hasAnyPermission/hasAllPermissions take PERMISSIONS.X — never string/template/array literals.
- Dead code fails CI: find:unused-* (exports/hooks/routes/dialogs/permissions/schemas/stores/assets). Auto-remover snapshots tsc before/after, rolls back on new error.
```

Treat this protocol as non-negotiable. When in doubt, prefer the disciplined-but-slower path: a token over a hex, a wrapped primitive over a `<div>`, an optimistic fan-out over an `invalidateQueries`, a logical property over a physical one. The reference app feels hand-architected because every one of these choices was made the same way every time — your job is to make them the same way too.

---

## Closing Word

Restraint is not the absence of design — restraint **is** the design. A calm, near-monochrome, dense, instantly-responsive interface earns trust precisely because every element is the result of a decision. Build the system once — the tokens, the primitives, the caching engine, the RTL and a11y substrate — and every feature after it inherits the quality for free. Hold the line on the checklists, make the wrong thing un-mergeable, and the result will read as crafted, not generated.

<sub>Generated 2026-06-15 from analysis of a production reference frontend. Adapt the named tools to your stack; keep the principles intact.</sub>
