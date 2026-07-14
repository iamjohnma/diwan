# Diwan M1 Core Entities (Cases, Parties, CaseTypes, CaseParties) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend half of M1 (PRD.md §9 / IMPLEMENTATION_PLAN.md §2) — Cases, CaseTypes, Parties, and CaseParties, plus the two cross-cutting utilities everything downstream needs (audit logging, Arabic search normalization) — as thin function-surface handlers over a tested model layer, on top of the already-built and verified Phase 0 foundation (schema, auth/tenant/RBAC ladder, RBAC seed).

**Architecture:** Convex backend, Backend Manifesto §2's four-zone split (`convex/<entity>.ts` thin surface → `convex/model/<domain>/` fat model → `convex/lib/` shared primitives → `convex/internal/` server-only). Every handler is built from the Phase 0 ladder (`firmQuery`/`firmMutation`/`activeFirmQuery`/`activeFirmMutation`) and gates on `PERMISSIONS.*` via `requireFirmPermission`/`requireLawyerScopedAccess`/`requireAccessibleCase`. TDD throughout via `convex-test` against the real schema.

**Tech Stack:** Convex `^1.42.1`, `@convex-dev/auth` `^0.0.94`, `convex-helpers` `^0.1.120`, TypeScript (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Bun `1.3.6`, `vitest` + `convex-test` + `@edge-runtime/vm` for testing, `@diwan/shared` workspace package for enums/RBAC constants.

## Global Constraints

- `ctx.db.get`/`.patch`/`.replace`/`.delete` all take the table name as an explicit first argument in this Convex version — `ctx.db.get('cases', caseId)`, never `ctx.db.get(caseId)`. (Verified against the installed `convex@1.42.1`; the older single-arg form referenced in some docs is stale.)
- Every table-scoped read/write is index-backed — never `.collect()` then `.filter()`; list/search queries return a **bounded** result via `.paginate(args.paginationOpts)`, never an unbounded `.collect()`.
- Every client-callable function declares `v.*` arg validators and a `returns:` validator matching the handler's return type. No `v.any()` anywhere, including in the audit log's `before`/`after` snapshots — those are `v.optional(v.string())` (JSON-stringified), per the decision already made in `convex/schema.ts`.
- Every authenticated, tenant-scoped handler is built from `authedQuery`/`authedMutation`/`activeFirmQuery`/`activeFirmMutation`/`firmQuery`/`firmMutation` (`convex/functions.ts`) — never a bare `query`/`mutation`. Permission gate (`requireFirmPermission`, `requireLawyerScopedAccess`, or `requireAccessibleCase`) is the handler's first statement after loading any referenced documents it needs for the check.
- Reference `PERMISSIONS.*` constants from `@diwan/shared` only — never a string literal permission.
- Domain errors are `throw new AppError(ERROR_CODES.X)` — never a raw `throw new Error(...)` for a condition a client should branch on. Add a code to `convex/lib/errors.ts`'s `ERROR_CODES` before ever throwing it.
- Soft-delete is `deletedAt: v.optional(v.number())`, filtered via an index — never a hard `ctx.db.delete` on a case/party/document row. A case's `status: 'archived'` is a **business lifecycle state**, distinct from `deletedAt` — an archived case must remain fully visible in search/list (per M1's DoD), it is not the same thing as soft-deleted.
- Every `convex-test` suite: real `schema` + `modules` via `convexTest(schema, modules)`; mock identity with `t.withIdentity(...)`; **always** exercise a constrained (non-owner) role, not just the Owner wildcard; assert domain failures by `error.code` via the `expectRejectedWithCode` helper (Task 1), never by message string; verify cascades/side-effects with a `t.run` DB snapshot, not just the return value.
- Arabic search normalization (IMPLEMENTATION_PLAN.md §2, verbatim): NFKD decompose → strip diacritics/tatweel → unify Alef variants (أ إ آ ٱ → ا) → unify hamza-on-carrier (ؤ/ئ → و/ي) → fold teh-marbuta (ة → ه) → strip bare hamza (ء) → lowercase → collapse whitespace → exclude phone/date-shaped tokens from fuzzy matching. Pair with a match-highlighter mapping normalized-string match positions back onto the *original* string.
- `nationalId` is the only party-dedup mechanism (PRD's no-OTP decision) — two parties with the same `nationalId` must always resolve to one record; two parties with the same name but different `nationalId` must never merge.
- Run `bun run check` (root `tsc --noEmit`) and `bun run test` (root `vitest run`) after every task; both must be green before moving to the next task.

---

### Task 1: Vitest + convex-test harness

**Files:**
- Create: `vitest.config.ts`
- Create: `convex/testHelpers.ts`
- Create: `convex/testHelpers.test.ts`
- Modify: `package.json` (add `@edge-runtime/vm` dev dependency — via `bun add -d`, not hand-edited)

**Interfaces:**
- Consumes: `convex/schema.ts` (default export), `convex/_generated/api` (`api`, `internal`), `convex/lib/errors.ts` (`AppError`, `ERROR_CODES`, `ErrorCode`), `@diwan/shared` (`SYSTEM_ROLES`, `SystemRole`).
- Produces (used by every later task's tests):
  - `makeTest(): TestConvex<typeof schema>`
  - `createAuthedUser(t, fields: {name: string; email: string}): Promise<{userId: Id<'users'>; authed: TestConvex<typeof schema>}>`
  - `bootstrapFirm(t): Promise<{owner: {userId: Id<'users'>; authed: TestConvex<typeof schema>}; firmId: Id<'firms'>}>`
  - `addFirmMember(t, firmId: Id<'firms'>, roleName: SystemRole, fields: {name: string; email: string}): Promise<{userId: Id<'users'>; authed: TestConvex<typeof schema>}>`
  - `expectRejectedWithCode(promise: Promise<unknown>, code: ErrorCode): Promise<void>`

- [ ] **Step 1: Install the edge-runtime VM dependency**

Run: `bun add -d @edge-runtime/vm`
Expected: adds `@edge-runtime/vm` to `package.json` `devDependencies` and installs cleanly.

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
  },
});
```

- [ ] **Step 3: Write the failing smoke test**

```ts
// convex/testHelpers.test.ts
/// <reference types="vite/client" />
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { ERROR_CODES } from './lib/errors.ts';
import { api } from './_generated/api';

describe('testHelpers', () => {
  test('bootstrapFirm creates an active Owner with the wildcard permission', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);

    const members = await t.run(async (ctx) =>
      ctx.db
        .query('firmMembers')
        .withIndex('by_firm', (q) => q.eq('firmId', firmId))
        .collect(),
    );
    expect(members).toHaveLength(1);
    expect(members[0]?.userId).toBe(owner.userId);
    expect(members[0]?.status).toBe('active');
  });

  test('addFirmMember creates a constrained-role member on the same firm', async () => {
    const t = makeTest();
    const { firmId } = await bootstrapFirm(t);
    const secretary = await addFirmMember(t, firmId, 'secretary', {
      name: 'Front Desk',
      email: 'secretary@example.com',
    });

    const member = await t.run(async (ctx) =>
      ctx.db
        .query('firmMembers')
        .withIndex('by_firm_user', (q) => q.eq('firmId', firmId).eq('userId', secretary.userId))
        .unique(),
    );
    expect(member?.status).toBe('active');
  });

  test('expectRejectedWithCode passes through the AppError code', async () => {
    const t = makeTest();
    // Calling an activeFirm-scoped query with no authenticated identity at
    // all must fail UNAUTHENTICATED, before it ever gets to firm resolution.
    await expectRejectedWithCode(
      t.query(api.testHelpers.exampleAuthedQuery, {}),
      ERROR_CODES.UNAUTHENTICATED,
    );
  });
});
```

This last test references `api.testHelpers.exampleAuthedQuery`, which does not exist yet — that's the point (Step 3 must fail).

- [ ] **Step 4: Run the test to verify it fails**

Run: `bunx vitest run convex/testHelpers.test.ts`
Expected: FAIL — `Cannot find module './testHelpers.ts'` (file doesn't exist) or, once the file exists but is empty, a TypeScript error that `testHelpers` has no export `exampleAuthedQuery`.

- [ ] **Step 5: Write `convex/testHelpers.ts`**

```ts
// convex/testHelpers.ts
import { convexTest } from 'convex-test';
import { expect } from 'vitest';
import { ConvexError } from 'convex/values';
import { v } from 'convex/values';
import schema from './schema.ts';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { activeFirmQuery } from './functions.ts';
import { type ErrorCode } from './lib/errors.ts';
import { SYSTEM_ROLES, type SystemRole } from '@diwan/shared';

const modules = import.meta.glob('./**/*.ts');

export function makeTest() {
  return convexTest(schema, modules);
}

type Test = ReturnType<typeof makeTest>;

export async function createAuthedUser(t: Test, fields: { name: string; email: string }) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert('users', { name: fields.name, email: fields.email }),
  );
  const authed = t.withIdentity({ subject: userId, tokenIdentifier: `test|${userId}` });
  return { userId, authed };
}

export async function bootstrapFirm(t: Test) {
  const owner = await createAuthedUser(t, { name: 'Firm Owner', email: 'owner@example.com' });
  const { firmId } = await t.mutation(internal.internal.provisioning.createFirmWithOwner, {
    firmName: 'Alpha Firm',
    firmSlug: `alpha-firm-${owner.userId}`,
    ownerUserId: owner.userId,
    seatLimit: 10,
  });
  return { owner, firmId };
}

export async function addFirmMember(
  t: Test,
  firmId: Id<'firms'>,
  roleName: SystemRole,
  fields: { name: string; email: string },
) {
  const member = await createAuthedUser(t, fields);
  await t.run(async (ctx) => {
    const role = await ctx.db
      .query('roles')
      .withIndex('by_name', (q) => q.eq('name', roleName))
      .unique();
    if (!role) {
      throw new Error(`Role "${roleName}" is not seeded — bootstrapFirm must run first`);
    }
    const now = Date.now();
    await ctx.db.insert('firmMembers', {
      firmId,
      userId: member.userId,
      roleId: role._id,
      status: 'active',
      invitedAt: now,
      joinedAt: now,
    });
    await ctx.db.patch('users', member.userId, { activeFirmId: firmId });
  });
  return member;
}

export async function expectRejectedWithCode(
  promise: Promise<unknown>,
  code: ErrorCode,
): Promise<void> {
  let thrown: unknown;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ConvexError);
  expect((thrown as ConvexError<{ code: ErrorCode }>).data.code).toBe(code);
}

// Exists only so Step 3's harness smoke test has a real activeFirmQuery-built
// function to call — exercises the ladder itself, not a feature.
export const exampleAuthedQuery = activeFirmQuery({
  args: {},
  returns: v.object({ firmId: v.string() }),
  handler: async (ctx) => ({ firmId: ctx.firmId }),
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bunx convex dev --once && bunx vitest run convex/testHelpers.test.ts`
Expected: PASS — all 3 tests green. (`convex dev --once` first because `exampleAuthedQuery` is a new function that needs to reach `_generated/api.d.ts` before the test file typechecks against it.)

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts convex/testHelpers.ts convex/testHelpers.test.ts package.json bun.lock
git commit -m "test: add convex-test harness (bootstrapFirm, addFirmMember, expectRejectedWithCode)"
```

---

### Task 2: Arabic search-text normalization utility

**Files:**
- Create: `convex/lib/search/normalizeSearchText.ts`
- Create: `convex/lib/search/normalizeSearchText.test.ts`

**Interfaces:**
- Consumes: nothing (pure, self-contained utility — no DB, no ctx).
- Produces (used by Task 5 Parties and Task 6 Cases for their `searchText` fields and by the future Search module):
  - `normalizeSearchText(input: string): string`
  - `normalizeSearchTextWithMap(input: string): { normalized: string; originalIndexOf: number[] }`
  - `highlightMatches(original: string, matchedNormalizedRanges: ReadonlyArray<{start: number; end: number}>): Array<{text: string; matched: boolean}>`

- [ ] **Step 1: Write the failing tests**

```ts
// convex/lib/search/normalizeSearchText.test.ts
import { describe, expect, test } from 'vitest';
import { normalizeSearchText, highlightMatches } from './normalizeSearchText.ts';

describe('normalizeSearchText', () => {
  test('strips Arabic diacritics and tatweel', () => {
    // "مُحَمَّد" with fatha/damma/shadda marks, plus a tatweel-stretched "أحـــمد"
    expect(normalizeSearchText('مُحَمَّد')).toBe('محمد');
    expect(normalizeSearchText('أحـــمد')).toBe('احمد');
  });

  test('unifies Alef variants to bare Alef', () => {
    expect(normalizeSearchText('أحمد')).toBe('احمد');
    expect(normalizeSearchText('إبراهيم')).toBe('ابراهيم');
    expect(normalizeSearchText('آدم')).toBe('ادم');
    expect(normalizeSearchText('ٱحمد')).toBe('احمد');
  });

  test('unifies hamza-on-carrier to the bare carrier letter', () => {
    expect(normalizeSearchText('مؤمن')).toBe('مومن');
    expect(normalizeSearchText('سئل')).toBe('سيل');
  });

  test('folds teh-marbuta to heh', () => {
    expect(normalizeSearchText('فاطمة')).toBe('فاطمه');
  });

  test('strips bare hamza', () => {
    expect(normalizeSearchText('مسؤولء')).not.toContain('ء');
  });

  test('lowercases Latin characters', () => {
    expect(normalizeSearchText('Rani SHWAIKI')).toBe('rani shwaiki');
  });

  test('collapses repeated whitespace and trims', () => {
    expect(normalizeSearchText('  رني    شويكي  ')).toBe('رني شويكي');
  });

  test('drops phone/date-shaped tokens from the normalized text', () => {
    expect(normalizeSearchText('رني 0599123456')).toBe('رني');
    expect(normalizeSearchText('حسن 2026-07-10')).toBe('حسن');
    expect(normalizeSearchText('كريم')).toBe('كريم');
  });

  test('two names differing only by hamza/alef/teh-marbuta variants normalize identically', () => {
    expect(normalizeSearchText('أحمد فاطمة')).toBe(normalizeSearchText('احمد فاطمه'));
  });
});

describe('highlightMatches', () => {
  test('returns the whole original string unmatched when there are no ranges', () => {
    expect(highlightMatches('احمد', [])).toEqual([{ text: 'احمد', matched: false }]);
  });

  test('maps a normalized-space match range back onto the original string', () => {
    // normalizeSearchText('أحمد') === 'احمد' (أ -> ا, same length, 1:1 map)
    // matching normalized[0..4] should map back to the full original string
    const segments = highlightMatches('أحمد', [{ start: 0, end: 4 }]);
    expect(segments).toEqual([{ text: 'أحمد', matched: true }]);
  });

  test('produces unmatched-matched-unmatched segments around a partial match', () => {
    // 'رني شويكي' normalizes 1:1 (no substitutions needed) so byte offsets
    // in normalized space equal offsets in original space here.
    const original = 'رني شويكي';
    const normalized = normalizeSearchText(original);
    const matchStart = normalized.indexOf('شويكي');
    const segments = highlightMatches(original, [
      { start: matchStart, end: matchStart + 'شويكي'.length },
    ]);
    expect(segments).toEqual([
      { text: 'رني ', matched: false },
      { text: 'شويكي', matched: true },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run convex/lib/search/normalizeSearchText.test.ts`
Expected: FAIL — `Cannot find module './normalizeSearchText.ts'`.

- [ ] **Step 3: Write the implementation**

```ts
// convex/lib/search/normalizeSearchText.ts

const ARABIC_DIACRITICS_AND_TATWEEL = /[ً-ٟـ]/;
const ALEF_VARIANTS = new Set(['أ', 'إ', 'آ', 'ٱ']); // أ إ آ ٱ
const HAMZA_CARRIER_MAP: Record<string, string> = {
  'ؤ': 'و', // ؤ -> و
  'ئ': 'ي', // ئ -> ي
};
const TEH_MARBUTA = 'ة'; // ة
const HEH = 'ه'; // ه
const BARE_HAMZA = 'ء'; // ء
const ALEF = 'ا'; // ا
const PHONE_OR_DATE_TOKEN = /^[\d\-/.:+()]{3,}$/;

interface CharEntry {
  char: string;
  originalIndex: number;
}

/**
 * Decomposes the input via NFKD one code point at a time (not the whole
 * string at once) so each output character can be traced back to the exact
 * UTF-16 offset in the original string it came from — a whole-string
 * normalize() call loses that mapping.
 */
function nfkdWithMap(input: string): CharEntry[] {
  const entries: CharEntry[] = [];
  let originalIndex = 0;
  for (const codePoint of input) {
    const decomposed = codePoint.normalize('NFKD');
    for (const outChar of decomposed) {
      entries.push({ char: outChar, originalIndex });
    }
    originalIndex += codePoint.length; // handles surrogate pairs correctly
  }
  return entries;
}

function substituteAndFilter(entries: CharEntry[]): CharEntry[] {
  const result: CharEntry[] = [];
  for (const entry of entries) {
    const { char, originalIndex } = entry;
    if (ARABIC_DIACRITICS_AND_TATWEEL.test(char)) continue; // strip
    if (char === BARE_HAMZA) continue; // strip
    if (ALEF_VARIANTS.has(char)) {
      result.push({ char: ALEF, originalIndex });
      continue;
    }
    const hamzaTarget = HAMZA_CARRIER_MAP[char];
    if (hamzaTarget) {
      result.push({ char: hamzaTarget, originalIndex });
      continue;
    }
    if (char === TEH_MARBUTA) {
      result.push({ char: HEH, originalIndex });
      continue;
    }
    result.push({ char: char.toLowerCase(), originalIndex });
  }
  return result;
}

function collapseWhitespace(entries: CharEntry[]): CharEntry[] {
  const result: CharEntry[] = [];
  let lastWasSpace = true; // trims leading whitespace for free
  for (const entry of entries) {
    const isSpace = /\s/.test(entry.char);
    if (isSpace) {
      if (!lastWasSpace) result.push({ char: ' ', originalIndex: entry.originalIndex });
      lastWasSpace = true;
    } else {
      result.push(entry);
      lastWasSpace = false;
    }
  }
  while (result.length > 0 && result[result.length - 1]?.char === ' ') result.pop();
  return result;
}

function dropNumericTokens(entries: CharEntry[]): CharEntry[] {
  const tokens: CharEntry[][] = [];
  let current: CharEntry[] = [];
  for (const entry of entries) {
    if (entry.char === ' ') {
      if (current.length > 0) tokens.push(current);
      current = [];
    } else {
      current.push(entry);
    }
  }
  if (current.length > 0) tokens.push(current);

  const kept: CharEntry[] = [];
  for (const token of tokens) {
    const tokenText = token.map((e) => e.char).join('');
    if (PHONE_OR_DATE_TOKEN.test(tokenText)) continue;
    if (kept.length > 0) kept.push({ char: ' ', originalIndex: token[0]?.originalIndex ?? 0 });
    kept.push(...token);
  }
  return kept;
}

export interface NormalizedSearchText {
  normalized: string;
  /** originalIndexOf[i] is the UTF-16 offset in the original string that normalized[i] came from. */
  originalIndexOf: number[];
}

export function normalizeSearchTextWithMap(input: string): NormalizedSearchText {
  const pipeline = dropNumericTokens(
    collapseWhitespace(substituteAndFilter(nfkdWithMap(input))),
  );
  return {
    normalized: pipeline.map((e) => e.char).join(''),
    originalIndexOf: pipeline.map((e) => e.originalIndex),
  };
}

export function normalizeSearchText(input: string): string {
  return normalizeSearchTextWithMap(input).normalized;
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export function highlightMatches(
  original: string,
  matchedNormalizedRanges: ReadonlyArray<{ start: number; end: number }>,
): HighlightSegment[] {
  if (matchedNormalizedRanges.length === 0) {
    return [{ text: original, matched: false }];
  }
  const { originalIndexOf } = normalizeSearchTextWithMap(original);

  const originalRanges: Array<{ start: number; end: number }> = [];
  for (const range of matchedNormalizedRanges) {
    const startIdx = originalIndexOf[range.start];
    const lastCharIdx = originalIndexOf[range.end - 1];
    if (startIdx === undefined || lastCharIdx === undefined) continue;
    originalRanges.push({ start: startIdx, end: lastCharIdx + 1 });
  }
  originalRanges.sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of originalRanges) {
    const start = Math.max(range.start, cursor);
    if (start > cursor) segments.push({ text: original.slice(cursor, start), matched: false });
    if (range.end > start) {
      segments.push({ text: original.slice(start, range.end), matched: true });
      cursor = range.end;
    }
  }
  if (cursor < original.length) segments.push({ text: original.slice(cursor), matched: false });
  return segments;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bunx vitest run convex/lib/search/normalizeSearchText.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/search/normalizeSearchText.ts convex/lib/search/normalizeSearchText.test.ts
git commit -m "feat: add Arabic search-text normalization + match highlighting"
```

---

### Task 3: Audit log model

**Files:**
- Create: `convex/model/audit/recordAuditEvent.ts`
- Create: `convex/model/audit/recordAuditEvent.test.ts`

**Interfaces:**
- Consumes: `convex/_generated/dataModel` (`Id`), `convex/_generated/server` (`MutationCtx`).
- Produces (called by every mutating handler in Tasks 4-7):
  - `recordAuditEvent(ctx: WriteCtx, args: { firmId: Id<'firms'>; actorId: Id<'users'>; entityType: string; entityId: string; action: string; before?: unknown; after?: unknown }): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// convex/model/audit/recordAuditEvent.test.ts
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm } from '../../testHelpers.ts';
import { recordAuditEvent } from './recordAuditEvent.ts';

describe('recordAuditEvent', () => {
  test('inserts an auditLog row with JSON-stringified before/after snapshots', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);

    await t.run(async (ctx) => {
      await recordAuditEvent(ctx, {
        firmId,
        actorId: owner.userId,
        entityType: 'cases',
        entityId: 'fake-case-id',
        action: 'create',
        before: undefined,
        after: { status: 'intake' },
      });
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query('auditLog')
        .withIndex('by_firm', (q) => q.eq('firmId', firmId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityType).toBe('cases');
    expect(rows[0]?.action).toBe('create');
    expect(rows[0]?.before).toBeUndefined();
    expect(JSON.parse(rows[0]?.after ?? '{}')).toEqual({ status: 'intake' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bunx vitest run convex/model/audit/recordAuditEvent.test.ts`
Expected: FAIL — `Cannot find module './recordAuditEvent.ts'`.

- [ ] **Step 3: Write the implementation**

```ts
// convex/model/audit/recordAuditEvent.ts
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';

type WriteCtx = Pick<MutationCtx, 'db'>;

export interface RecordAuditEventArgs {
  firmId: Id<'firms'>;
  actorId: Id<'users'>;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

export async function recordAuditEvent(ctx: WriteCtx, args: RecordAuditEventArgs): Promise<void> {
  await ctx.db.insert('auditLog', {
    firmId: args.firmId,
    actorId: args.actorId,
    entityType: args.entityType,
    entityId: args.entityId,
    action: args.action,
    before: args.before === undefined ? undefined : JSON.stringify(args.before),
    after: args.after === undefined ? undefined : JSON.stringify(args.after),
    createdAt: Date.now(),
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bunx vitest run convex/model/audit/recordAuditEvent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/model/audit/recordAuditEvent.ts convex/model/audit/recordAuditEvent.test.ts
git commit -m "feat: add recordAuditEvent model helper"
```

---

### Task 4: CaseTypes model + function surface

**Files:**
- Modify: `convex/schema.ts` (add a `by_firm_deleted` index to `caseTypes` — it only has `by_firm`/`by_firm_key` today, and `list` needs to filter out soft-deleted rows via an index, not `.filter()`)
- Create: `convex/model/caseTypes/caseTypes.ts`
- Create: `convex/caseTypes.ts`
- Create: `convex/caseTypes.test.ts`

**Interfaces:**
- Consumes: `firmQuery`/`firmMutation`/`requireFirmPermission` (`convex/functions.ts`), `PERMISSIONS` (`@diwan/shared`), `recordAuditEvent` (Task 3), `AppError`/`ERROR_CODES` (`convex/lib/errors.ts`).
- Produces (consumed by Task 6 Cases, for `caseTypeId` validation on case creation):
  - `createCaseType(ctx: WriteCtx, firmId: Id<'firms'>, fields: {key, label, requiredPartyRoles, requiredDocumentChecklist}): Promise<Id<'caseTypes'>>`
  - `requireCaseType(ctx: ReadCtx, firmId: Id<'firms'>, caseTypeId: Id<'caseTypes'>): Promise<Doc<'caseTypes'>>`
  - Public API: `api.caseTypes.create`, `api.caseTypes.list`

- [ ] **Step 1: Write the failing tests**

```ts
// convex/caseTypes.test.ts
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

describe('caseTypes', () => {
  test('Owner can create a case type', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);

    const caseTypeId = await owner.authed.mutation(api.caseTypes.create, {
      key: 'civil-claim',
      label: 'Civil Claim',
      requiredPartyRoles: ['plaintiff', 'defendant'],
      requiredDocumentChecklist: ['pleading'],
    });
    expect(caseTypeId).toBeDefined();
  });

  test('a Lawyer (no settings.manage permission) cannot create a case type', async () => {
    const t = makeTest();
    const { firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', {
      name: 'Lina Lawyer',
      email: 'lina@example.com',
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.caseTypes.create, {
        key: 'civil-claim',
        label: 'Civil Claim',
        requiredPartyRoles: ['plaintiff'],
        requiredDocumentChecklist: [],
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('list returns only this firm\'s non-deleted case types', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    await owner.authed.mutation(api.caseTypes.create, {
      key: 'civil-claim',
      label: 'Civil Claim',
      requiredPartyRoles: ['plaintiff', 'defendant'],
      requiredDocumentChecklist: [],
    });

    const result = await owner.authed.query(api.caseTypes.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.key).toBe('civil-claim');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run convex/caseTypes.test.ts`
Expected: FAIL — `Cannot find module './_generated/api'` export `caseTypes`, or module-not-found on the model file.

- [ ] **Step 3: Add the missing soft-delete index, then write the model layer**

`caseTypes` only has `by_firm`/`by_firm_key` today (Phase 0) — no index that includes `deletedAt`, so `list` has nothing to range-scan on for "active only". Add one first, matching the `by_firm_deleted_created` pattern already used on `cases`/`parties`:

```ts
// convex/schema.ts — caseTypes table, add this index alongside the existing
// .index('by_firm', ['firmId']) and .index('by_firm_key', ['firmId', 'key'])
    .index('by_firm_deleted', ['firmId', 'deletedAt'])
```

```ts
// convex/model/caseTypes/caseTypes.ts
import type { Id, Doc } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import type { PartyRole } from '@diwan/shared';
import type { DocumentKind } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

export interface CreateCaseTypeFields {
  key: string;
  label: string;
  requiredPartyRoles: PartyRole[];
  requiredDocumentChecklist: DocumentKind[];
}

export async function createCaseType(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  fields: CreateCaseTypeFields,
): Promise<Id<'caseTypes'>> {
  return await ctx.db.insert('caseTypes', {
    firmId,
    key: fields.key,
    label: fields.label,
    requiredPartyRoles: fields.requiredPartyRoles,
    requiredDocumentChecklist: fields.requiredDocumentChecklist,
    createdAt: Date.now(),
  });
}

export async function requireCaseType(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  caseTypeId: Id<'caseTypes'>,
): Promise<Doc<'caseTypes'>> {
  const caseType = await ctx.db.get('caseTypes', caseTypeId);
  if (!caseType || caseType.firmId !== firmId || caseType.deletedAt !== undefined) {
    throw new AppError(ERROR_CODES.CASE_TYPE_NOT_FOUND);
  }
  return caseType;
}
```

This references `ERROR_CODES.CASE_TYPE_NOT_FOUND`, which does not exist yet — add it in this same step:

```ts
// convex/lib/errors.ts — add to the ERROR_CODES object (alongside CASE_NOT_FOUND)
  CASE_TYPE_NOT_FOUND: 'CASE_TYPE_NOT_FOUND',
```

- [ ] **Step 4: Write the function surface**

```ts
// convex/caseTypes.ts
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { createCaseType } from './model/caseTypes/caseTypes.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { PERMISSIONS, PARTY_ROLES, DOCUMENT_KINDS } from '@diwan/shared';
import { literalUnion } from './lib/validators.ts';

const caseTypeSummaryValidator = v.object({
  _id: v.id('caseTypes'),
  key: v.string(),
  label: v.string(),
  requiredPartyRoles: v.array(literalUnion(PARTY_ROLES)),
  requiredDocumentChecklist: v.array(literalUnion(DOCUMENT_KINDS)),
});

export const create = firmMutation({
  args: {
    key: v.string(),
    label: v.string(),
    requiredPartyRoles: v.array(literalUnion(PARTY_ROLES)),
    requiredDocumentChecklist: v.array(literalUnion(DOCUMENT_KINDS)),
  },
  returns: v.id('caseTypes'),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.SETTINGS_MANAGE);
    const caseTypeId = await createCaseType(ctx, ctx.firmId, args);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'caseTypes',
      entityId: caseTypeId,
      action: 'create',
      after: args,
    });
    return caseTypeId;
  },
});

export const list = firmQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(caseTypeSummaryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query('caseTypes')
      .withIndex('by_firm_deleted', (q) => q.eq('firmId', ctx.firmId).eq('deletedAt', undefined))
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((row) => ({
        _id: row._id,
        key: row.key,
        label: row.label,
        requiredPartyRoles: row.requiredPartyRoles,
        requiredDocumentChecklist: row.requiredDocumentChecklist,
      })),
    };
  },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bunx convex dev --once && bunx vitest run convex/caseTypes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/model/caseTypes/ convex/caseTypes.ts convex/caseTypes.test.ts convex/lib/errors.ts
git commit -m "feat: add caseTypes create/list"
```

---

### Task 5: Parties model + function surface (dedup, CRUD, search)

**Files:**
- Create: `convex/model/parties/parties.ts`
- Create: `convex/parties.ts`
- Create: `convex/parties.test.ts`

**Interfaces:**
- Consumes: `firmQuery`/`firmMutation`/`requireFirmPermission`, `PERMISSIONS`, `recordAuditEvent` (Task 3), `normalizeSearchText` (Task 2), `AppError`/`ERROR_CODES`.
- Produces (consumed by Task 7 CaseParties, for linking a party to a case):
  - `findOrCreateParty(ctx: WriteCtx, firmId: Id<'firms'>, fields: PartyFields): Promise<{partyId: Id<'parties'>; created: boolean}>`
  - `requireAccessibleParty(ctx: ReadCtx, firmId: Id<'firms'>, partyId: Id<'parties'>): Promise<Doc<'parties'>>`
  - Public API: `api.parties.create`, `api.parties.update`, `api.parties.get`, `api.parties.list`, `api.parties.search`

- [ ] **Step 1: Write the failing tests for creation + dedup**

```ts
// convex/parties.test.ts
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

describe('parties', () => {
  test('creating a party with a new nationalId inserts a new row', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);

    const partyId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900123456',
      fullName: 'Ahmad Khalil',
    });
    const party = await owner.authed.query(api.parties.get, { partyId });
    expect(party?.fullName).toBe('Ahmad Khalil');
  });

  test('creating a second party with the SAME nationalId resolves to the same record, not a duplicate', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);

    const firstId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900123456',
      fullName: 'Ahmad Khalil',
    });
    const secondId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900123456',
      fullName: 'Ahmad K. Khalil', // slightly different spelling on second intake
    });

    expect(secondId).toBe(firstId);
    const all = await t.run(async (ctx) => ctx.db.query('parties').collect());
    expect(all).toHaveLength(1);
  });

  test('two parties with the same full name but DIFFERENT nationalId never merge', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);

    const firstId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900111111',
      fullName: 'Ahmad Khalil',
    });
    const secondId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900222222',
      fullName: 'Ahmad Khalil',
    });

    expect(secondId).not.toBe(firstId);
    const all = await t.run(async (ctx) => ctx.db.query('parties').collect());
    expect(all).toHaveLength(2);
  });

  test('a Paralegal (no parties.write) cannot create a party', async () => {
    const t = makeTest();
    const { firmId } = await bootstrapFirm(t);
    const paralegal = await addFirmMember(t, firmId, 'paralegal', {
      name: 'Pat Paralegal',
      email: 'pat@example.com',
    });

    await expectRejectedWithCode(
      paralegal.authed.mutation(api.parties.create, {
        nationalId: '900333333',
        fullName: 'New Party',
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('search finds a party by a fuzzy Arabic name match (hamza/alef variant)', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    await owner.authed.mutation(api.parties.create, {
      nationalId: '900444444',
      fullName: 'أحمد فاطمة',
    });

    const result = await owner.authed.query(api.parties.search, {
      queryText: 'احمد فاطمه', // normalized-equivalent spelling, no hamza/teh-marbuta
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.fullName).toBe('أحمد فاطمة');
  });

  test('archiving (soft-deleting) a party excludes it from list but keeps the row', async () => {
    const t = makeTest();
    const { owner } = await bootstrapFirm(t);
    const partyId = await owner.authed.mutation(api.parties.create, {
      nationalId: '900555555',
      fullName: 'Removed Party',
    });

    await owner.authed.mutation(api.parties.remove, { partyId });

    const listed = await owner.authed.query(api.parties.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(listed.page.find((p) => p._id === partyId)).toBeUndefined();

    const stillThere = await t.run(async (ctx) => ctx.db.get('parties', partyId));
    expect(stillThere).not.toBeNull();
    expect(stillThere?.deletedAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run convex/parties.test.ts`
Expected: FAIL — `Cannot find module` for the not-yet-created files.

- [ ] **Step 3: Write the model layer**

```ts
// convex/model/parties/parties.ts
import type { Id, Doc } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText.ts';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

export interface PartyFields {
  nationalId: string;
  fullName: string;
  fatherName?: string;
  dob?: number;
  phone?: string;
  address?: string;
}

function computeSearchText(fields: PartyFields): string {
  // Deliberately excludes phone/dob/address — only name-like fields feed
  // fuzzy search (PLAN §2: "excluding numeric/date-shaped tokens").
  return normalizeSearchText([fields.fullName, fields.fatherName ?? ''].join(' ').trim());
}

/**
 * nationalId is the ONLY dedup key (PRD's no-OTP decision). If a party with
 * this nationalId already exists in the firm, returns it unchanged — it does
 * NOT patch in the new fields, so a slightly-different spelling on a second
 * intake never silently overwrites the canonical record. Two records can
 * never end up with the same nationalId, so there is nothing to merge later.
 */
export async function findOrCreateParty(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  fields: PartyFields,
): Promise<{ partyId: Id<'parties'>; created: boolean }> {
  const existing = await ctx.db
    .query('parties')
    .withIndex('by_firm_national_id', (q) => q.eq('firmId', firmId).eq('nationalId', fields.nationalId))
    .unique();
  if (existing) {
    return { partyId: existing._id, created: false };
  }

  const now = Date.now();
  const partyId = await ctx.db.insert('parties', {
    firmId,
    nationalId: fields.nationalId,
    fullName: fields.fullName,
    fatherName: fields.fatherName,
    dob: fields.dob,
    phone: fields.phone,
    address: fields.address,
    searchText: computeSearchText(fields),
    createdAt: now,
    updatedAt: now,
  });
  return { partyId, created: true };
}

export async function updateParty(
  ctx: WriteCtx,
  party: Doc<'parties'>,
  fields: Partial<Omit<PartyFields, 'nationalId'>>,
): Promise<void> {
  const merged: PartyFields = {
    nationalId: party.nationalId,
    fullName: fields.fullName ?? party.fullName,
    fatherName: fields.fatherName ?? party.fatherName,
    dob: fields.dob ?? party.dob,
    phone: fields.phone ?? party.phone,
    address: fields.address ?? party.address,
  };
  await ctx.db.patch('parties', party._id, {
    ...fields,
    searchText: computeSearchText(merged),
    updatedAt: Date.now(),
  });
}

export async function requireAccessibleParty(
  ctx: ReadCtx,
  firmId: Id<'firms'>,
  partyId: Id<'parties'>,
): Promise<Doc<'parties'>> {
  const party = await ctx.db.get('parties', partyId);
  if (!party || party.firmId !== firmId || party.deletedAt !== undefined) {
    throw new AppError(ERROR_CODES.PARTY_NOT_FOUND);
  }
  return party;
}

export async function softDeleteParty(ctx: WriteCtx, partyId: Id<'parties'>): Promise<void> {
  await ctx.db.patch('parties', partyId, { deletedAt: Date.now(), updatedAt: Date.now() });
}
```

- [ ] **Step 4: Write the function surface**

```ts
// convex/parties.ts
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import {
  findOrCreateParty,
  updateParty,
  requireAccessibleParty,
  softDeleteParty,
} from './model/parties/parties.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { normalizeSearchText } from './lib/search/normalizeSearchText.ts';
import { PERMISSIONS } from '@diwan/shared';

const partyDetailValidator = v.object({
  _id: v.id('parties'),
  nationalId: v.string(),
  fullName: v.string(),
  fatherName: v.optional(v.string()),
  dob: v.optional(v.number()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
});

function toDetail(party: {
  _id: import('./_generated/dataModel').Id<'parties'>;
  nationalId: string;
  fullName: string;
  fatherName?: string;
  dob?: number;
  phone?: string;
  address?: string;
}) {
  return {
    _id: party._id,
    nationalId: party.nationalId,
    fullName: party.fullName,
    fatherName: party.fatherName,
    dob: party.dob,
    phone: party.phone,
    address: party.address,
  };
}

const partyArgs = {
  nationalId: v.string(),
  fullName: v.string(),
  fatherName: v.optional(v.string()),
  dob: v.optional(v.number()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
};

export const create = firmMutation({
  args: partyArgs,
  returns: v.id('parties'),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_WRITE);
    const { partyId, created } = await findOrCreateParty(ctx, ctx.firmId, args);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'parties',
      entityId: partyId,
      action: created ? 'create' : 'dedupe_resolved_to_existing',
      after: args,
    });
    return partyId;
  },
});

export const update = firmMutation({
  args: {
    partyId: v.id('parties'),
    fullName: v.optional(v.string()),
    fatherName: v.optional(v.string()),
    dob: v.optional(v.number()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_WRITE);
    const { partyId, ...fields } = args;
    const party = await requireAccessibleParty(ctx, ctx.firmId, partyId);
    const before = toDetail(party);
    await updateParty(ctx, party, fields);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'parties',
      entityId: partyId,
      action: 'update',
      before,
      after: fields,
    });
    return null;
  },
});

export const remove = firmMutation({
  args: { partyId: v.id('parties') },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_DELETE);
    const party = await requireAccessibleParty(ctx, ctx.firmId, args.partyId);
    await softDeleteParty(ctx, party._id);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'parties',
      entityId: party._id,
      action: 'archive',
    });
    return null;
  },
});

export const get = firmQuery({
  args: { partyId: v.id('parties') },
  returns: v.union(partyDetailValidator, v.null()),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_READ);
    const party = await requireAccessibleParty(ctx, ctx.firmId, args.partyId);
    return toDetail(party);
  },
});

export const list = firmQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(partyDetailValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_READ);
    const result = await ctx.db
      .query('parties')
      .withIndex('by_firm_deleted_created', (q) => q.eq('firmId', ctx.firmId).eq('deletedAt', undefined))
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toDetail) };
  },
});

export const search = firmQuery({
  args: { queryText: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(partyDetailValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.PARTIES_READ);
    const normalized = normalizeSearchText(args.queryText);
    const result = await ctx.db
      .query('parties')
      .withSearchIndex('search_text', (q) =>
        q.search('searchText', normalized).eq('firmId', ctx.firmId).eq('deletedAt', undefined),
      )
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toDetail) };
  },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bunx convex dev --once && bunx vitest run convex/parties.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add convex/model/parties/ convex/parties.ts convex/parties.test.ts
git commit -m "feat: add parties create/update/remove/get/list/search with nationalId dedup"
```

---

### Task 6: Cases model + function surface

**Files:**
- Create: `convex/model/cases/cases.ts`
- Create: `convex/cases.ts`
- Create: `convex/cases.test.ts`

**Interfaces:**
- Consumes: `firmQuery`/`firmMutation`/`requireFirmPermission`, `requireAccessibleCase`/`requireLawyerScopedAccess` (`convex/model/authz/owned.ts`, built in Phase 0), `requireCaseType` (Task 4), `normalizeSearchText` (Task 2), `recordAuditEvent` (Task 3), `PERMISSIONS`, `CASE_STATUSES`.
- Produces (consumed by Task 7 CaseParties):
  - `requireCanAssignLawyer(ctx, primaryLawyerId): void`
  - Public API: `api.cases.create`, `api.cases.get`, `api.cases.list`, `api.cases.search`, `api.cases.updateStatus`, `api.cases.remove`

- [ ] **Step 1: Write the failing tests**

```ts
// convex/cases.test.ts
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import { ERROR_CODES } from './lib/errors.ts';

async function seedCaseType(t: Awaited<ReturnType<typeof makeTest>>, owner: { authed: any }) {
  return owner.authed.mutation(api.caseTypes.create, {
    key: 'civil-claim',
    label: 'Civil Claim',
    requiredPartyRoles: ['plaintiff', 'defendant'],
    requiredDocumentChecklist: [],
  });
}

describe('cases', () => {
  test('a Lawyer can create a case assigned to themselves', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });

    const caseId = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-0001',
      caseTypeId,
      primaryLawyerId: lawyer.userId,
      status: 'intake',
    });
    const created = await lawyer.authed.query(api.cases.get, { caseId });
    expect(created?.status).toBe('intake');
  });

  test('a Lawyer CANNOT create a case assigned to a different lawyer', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyerA = await addFirmMember(t, firmId, 'lawyer', { name: 'A', email: 'a@example.com' });
    const lawyerB = await addFirmMember(t, firmId, 'lawyer', { name: 'B', email: 'b@example.com' });

    await expectRejectedWithCode(
      lawyerA.authed.mutation(api.cases.create, {
        internalNumber: 'C-0002',
        caseTypeId,
        primaryLawyerId: lawyerB.userId,
        status: 'intake',
      }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('a Secretary CAN create a case assigned to any lawyer (intake)', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const secretary = await addFirmMember(t, firmId, 'secretary', { name: 'Sam', email: 'sam@example.com' });

    const caseId = await secretary.authed.mutation(api.cases.create, {
      internalNumber: 'C-0003',
      caseTypeId,
      primaryLawyerId: lawyer.userId,
      status: 'intake',
    });
    expect(caseId).toBeDefined();
  });

  test('an Associate cannot read a case they are not assigned to', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });

    const caseId = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-0004',
      caseTypeId,
      primaryLawyerId: lawyer.userId,
      status: 'intake',
    });

    await expectRejectedWithCode(
      associate.authed.query(api.cases.get, { caseId }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('an Associate cannot close a case, even their own', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });

    const caseId = await associate.authed.mutation(api.cases.create, {
      internalNumber: 'C-0005',
      caseTypeId,
      primaryLawyerId: associate.userId,
      status: 'intake',
    });

    await expectRejectedWithCode(
      associate.authed.mutation(api.cases.updateStatus, { caseId, status: 'closed' }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('status transitions follow the lifecycle order — cannot skip from intake straight to closed', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });

    const caseId = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-0006',
      caseTypeId,
      primaryLawyerId: lawyer.userId,
      status: 'intake',
    });

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.cases.updateStatus, { caseId, status: 'closed' }),
      ERROR_CODES.INVALID_STATUS_TRANSITION,
    );
  });

  test('archiving a case keeps it fully visible in search and list, not soft-deleted', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const caseTypeId = await seedCaseType(t, owner);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });

    const caseId = await lawyer.authed.mutation(api.cases.create, {
      internalNumber: 'C-0007',
      caseTypeId,
      primaryLawyerId: lawyer.userId,
      status: 'intake',
    });
    // Walk the full legal transition chain to 'closed', then to 'archived'.
    for (const status of ['filed', 'in_hearings', 'verdict', 'execution', 'closed', 'archived'] as const) {
      await lawyer.authed.mutation(api.cases.updateStatus, { caseId, status });
    }

    const listed = await lawyer.authed.query(api.cases.list, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    const found = listed.page.find((c) => c._id === caseId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('archived');

    const stored = await t.run(async (ctx) => ctx.db.get('cases', caseId));
    expect(stored?.deletedAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run convex/cases.test.ts`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Write the model layer**

```ts
// convex/model/cases/cases.ts
import type { Id, Doc } from '../../_generated/dataModel';
import type { QueryCtx, MutationCtx } from '../../_generated/server';
import { AppError, ERROR_CODES } from '../../lib/errors.ts';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText.ts';
import { RBAC, PERMISSIONS, type CaseStatus, type PermissionString } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

interface ScopedCtx {
  userId: Id<'users'>;
  permissions: ReadonlySet<PermissionString>;
}

/**
 * Linear lifecycle, matching IMPLEMENTATION_PLAN.md §2's
 * "Intake→Filed→InHearings→Verdict→Execution→Closed→Archived" exactly.
 * Not a graph — each status has exactly one legal next status. Revisit if a
 * pilot firm needs postponement/reopen transitions that skip backwards.
 */
const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus | null> = {
  intake: 'filed',
  filed: 'in_hearings',
  in_hearings: 'verdict',
  verdict: 'execution',
  execution: 'closed',
  closed: 'archived',
  archived: null,
};

export function requireValidStatusTransition(from: CaseStatus, to: CaseStatus): void {
  if (CASE_STATUS_TRANSITIONS[from] !== to) {
    throw new AppError(ERROR_CODES.INVALID_STATUS_TRANSITION);
  }
}

/** Creation has no existing resource to scope against — a Lawyer/Associate
 * may only assign themselves as primaryLawyerId; Secretary/Owner (holding
 * the firm-wide write permission) may assign any lawyer, for intake. */
export function requireCanAssignLawyer(ctx: ScopedCtx, primaryLawyerId: Id<'users'>): void {
  if (ctx.permissions.has(RBAC.OWNER_WILDCARD as PermissionString)) return;
  if (ctx.permissions.has(PERMISSIONS.CASES_WRITE_ALL)) return;
  if (ctx.userId === primaryLawyerId && ctx.permissions.has(PERMISSIONS.CASES_WRITE_OWN)) return;
  throw new AppError(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
}

export interface CreateCaseFields {
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseTypeId: Id<'caseTypes'>;
  claimAmount?: number;
  primaryLawyerId: Id<'users'>;
  status: CaseStatus;
}

export async function createCase(ctx: WriteCtx, firmId: Id<'firms'>, fields: CreateCaseFields): Promise<Id<'cases'>> {
  const now = Date.now();
  return await ctx.db.insert('cases', {
    firmId,
    internalNumber: fields.internalNumber,
    courtNumber: fields.courtNumber,
    courtName: fields.courtName,
    caseTypeId: fields.caseTypeId,
    claimAmount: fields.claimAmount,
    primaryLawyerId: fields.primaryLawyerId,
    status: fields.status,
    searchText: normalizeSearchText(fields.internalNumber),
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateCaseStatus(ctx: WriteCtx, caseDoc: Doc<'cases'>, nextStatus: CaseStatus): Promise<void> {
  requireValidStatusTransition(caseDoc.status, nextStatus);
  await ctx.db.patch('cases', caseDoc._id, { status: nextStatus, updatedAt: Date.now() });
}

export async function softDeleteCase(ctx: WriteCtx, caseId: Id<'cases'>): Promise<void> {
  await ctx.db.patch('cases', caseId, { deletedAt: Date.now(), updatedAt: Date.now() });
}
```

This references `ERROR_CODES.INVALID_STATUS_TRANSITION`, which does not exist yet — add it now:

```ts
// convex/lib/errors.ts — add to the ERROR_CODES object (alongside CASE_NOT_FOUND)
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
```

`requireCanAssignLawyer` needs `CASES_CLOSE` gating on `updateStatus` too when `nextStatus === 'closed'`, handled in the function surface (Step 4) rather than the model, since it's a permission decision, not a business rule — keeping `updateCaseStatus` itself permission-agnostic (it's already been authorized by the time the handler calls it) matches the ladder pattern used throughout.

- [ ] **Step 4: Write the function surface**

```ts
// convex/cases.ts
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { firmQuery, firmMutation, requireFirmPermission } from './functions.ts';
import { requireAccessibleCase, requireLawyerScopedAccess } from './model/authz/owned.ts';
import { requireCaseType } from './model/caseTypes/caseTypes.ts';
import {
  createCase,
  updateCaseStatus,
  softDeleteCase,
  requireCanAssignLawyer,
} from './model/cases/cases.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { normalizeSearchText } from './lib/search/normalizeSearchText.ts';
import { literalUnion } from './lib/validators.ts';
import { PERMISSIONS, CASE_STATUSES } from '@diwan/shared';

const statusValidator = literalUnion(CASE_STATUSES);

const caseDetailValidator = v.object({
  _id: v.id('cases'),
  internalNumber: v.string(),
  courtNumber: v.optional(v.string()),
  courtName: v.optional(v.string()),
  caseTypeId: v.id('caseTypes'),
  claimAmount: v.optional(v.number()),
  primaryLawyerId: v.id('users'),
  status: statusValidator,
});

function toDetail(caseDoc: {
  _id: import('./_generated/dataModel').Id<'cases'>;
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseTypeId: import('./_generated/dataModel').Id<'caseTypes'>;
  claimAmount?: number;
  primaryLawyerId: import('./_generated/dataModel').Id<'users'>;
  status: (typeof CASE_STATUSES)[number];
}) {
  return {
    _id: caseDoc._id,
    internalNumber: caseDoc.internalNumber,
    courtNumber: caseDoc.courtNumber,
    courtName: caseDoc.courtName,
    caseTypeId: caseDoc.caseTypeId,
    claimAmount: caseDoc.claimAmount,
    primaryLawyerId: caseDoc.primaryLawyerId,
    status: caseDoc.status,
  };
}

export const create = firmMutation({
  args: {
    internalNumber: v.string(),
    courtNumber: v.optional(v.string()),
    courtName: v.optional(v.string()),
    caseTypeId: v.id('caseTypes'),
    claimAmount: v.optional(v.number()),
    primaryLawyerId: v.id('users'),
    status: statusValidator,
  },
  returns: v.id('cases'),
  handler: async (ctx, args) => {
    requireCanAssignLawyer(ctx, args.primaryLawyerId);
    await requireCaseType(ctx, ctx.firmId, args.caseTypeId);
    const caseId = await createCase(ctx, ctx.firmId, args);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'cases',
      entityId: caseId,
      action: 'create',
      after: args,
    });
    return caseId;
  },
});

export const get = firmQuery({
  args: { caseId: v.id('cases') },
  returns: v.union(caseDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    return toDetail(caseDoc);
  },
});

export const updateStatus = firmMutation({
  args: { caseId: v.id('cases'), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    const requiredPermission = args.status === 'closed' ? PERMISSIONS.CASES_CLOSE : undefined;
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      requiredPermission ?? PERMISSIONS.CASES_WRITE_OWN,
      requiredPermission ?? PERMISSIONS.CASES_WRITE_ALL,
    );
    const before = toDetail(caseDoc);
    await updateCaseStatus(ctx, caseDoc, args.status);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'cases',
      entityId: caseDoc._id,
      action: 'updateStatus',
      before,
      after: { status: args.status },
    });
    return null;
  },
});

export const remove = firmMutation({
  args: { caseId: v.id('cases') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(ctx, caseDoc.primaryLawyerId, PERMISSIONS.CASES_DELETE, PERMISSIONS.CASES_DELETE);
    await softDeleteCase(ctx, caseDoc._id);
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'cases',
      entityId: caseDoc._id,
      action: 'delete',
    });
    return null;
  },
});

export const list = firmQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(caseDetailValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.CASES_READ_ALL);
    const result = await ctx.db
      .query('cases')
      .withIndex('by_firm_deleted_created', (q) => q.eq('firmId', ctx.firmId).eq('deletedAt', undefined))
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toDetail) };
  },
});

export const search = firmQuery({
  args: { queryText: v.string(), paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(caseDetailValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    requireFirmPermission(ctx, PERMISSIONS.CASES_READ_ALL);
    const normalized = normalizeSearchText(args.queryText);
    const result = await ctx.db
      .query('cases')
      .withSearchIndex('search_text', (q) =>
        q.search('searchText', normalized).eq('firmId', ctx.firmId).eq('deletedAt', undefined),
      )
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toDetail) };
  },
});
```

Note: `list`/`search` gate on `CASES_READ_ALL` — a firm-wide read. A Lawyer/Associate only holding `CASES_READ_OWN` will correctly be denied here; their "my cases" view is a separate, later query (out of scope for this plan — flag it as a follow-up when M1's frontend plan is written, since the DoD for *this* plan only requires `get`/`updateStatus`/`remove` to respect own-vs-all, which they do via `requireAccessibleCase`/`requireLawyerScopedAccess`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bunx convex dev --once && bunx vitest run convex/cases.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 6: Commit**

```bash
git add convex/model/cases/ convex/cases.ts convex/cases.test.ts convex/lib/errors.ts
git commit -m "feat: add cases create/get/updateStatus/remove/list/search with lawyer scoping"
```

---

### Task 7: CaseParties (case ↔ party join)

**Files:**
- Create: `convex/model/caseParties/caseParties.ts`
- Create: `convex/caseParties.ts`
- Create: `convex/caseParties.test.ts`

**Interfaces:**
- Consumes: `firmMutation`/`firmQuery`/`requireFirmPermission`, `requireAccessibleCase` (Phase 0), `requireAccessibleParty` (Task 5), `recordAuditEvent` (Task 3), `PERMISSIONS`, `PARTY_ROLES`.
- Produces: Public API: `api.caseParties.add`, `api.caseParties.listForCase`, `api.caseParties.listForParty` — the cross-link that makes both the case-file's Parties tab and a party's cross-case profile page possible (IMPLEMENTATION_PLAN.md §2's "Cases and Clients are two views onto the same caseParties join data, cross-linked both directions").

- [ ] **Step 1: Write the failing tests**

```ts
// convex/caseParties.test.ts
import { describe, expect, test } from 'vitest';
import { makeTest, bootstrapFirm, addFirmMember, expectRejectedWithCode } from './testHelpers.ts';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ERROR_CODES } from './lib/errors.ts';

async function setupCaseAndParty(t: Awaited<ReturnType<typeof makeTest>>, owner: { authed: any }, lawyerId: any) {
  const caseTypeId = await owner.authed.mutation(api.caseTypes.create, {
    key: 'civil-claim',
    label: 'Civil Claim',
    requiredPartyRoles: ['plaintiff', 'defendant'],
    requiredDocumentChecklist: [],
  });
  const caseId = await owner.authed.mutation(api.cases.create, {
    internalNumber: 'C-0001',
    caseTypeId,
    primaryLawyerId: lawyerId,
    status: 'intake',
  });
  const partyId = await owner.authed.mutation(api.parties.create, {
    nationalId: '900123456',
    fullName: 'Ahmad Khalil',
  });
  return { caseId, partyId };
}

describe('caseParties', () => {
  test('adding a party to a case creates a listable link, visible from both sides', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const { caseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);

    await lawyer.authed.mutation(api.caseParties.add, {
      caseId,
      partyId,
      role: 'plaintiff',
    });

    const caseParties = await lawyer.authed.query(api.caseParties.listForCase, { caseId });
    expect(caseParties).toHaveLength(1);
    expect(caseParties[0]?.role).toBe('plaintiff');

    const partyCases = await lawyer.authed.query(api.caseParties.listForParty, { partyId });
    expect(partyCases).toHaveLength(1);
    expect(partyCases[0]?.caseId).toBe(caseId);
  });

  test('an Associate cannot add a party to a case they are not assigned to', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const associate = await addFirmMember(t, firmId, 'associate', { name: 'Ana', email: 'ana@example.com' });
    const { caseId, partyId } = await setupCaseAndParty(t, owner, lawyer.userId);

    await expectRejectedWithCode(
      associate.authed.mutation(api.caseParties.add, { caseId, partyId, role: 'defendant' }),
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  });

  test('adding a party to a nonexistent case fails with CASE_NOT_FOUND', async () => {
    const t = makeTest();
    const { owner, firmId } = await bootstrapFirm(t);
    const lawyer = await addFirmMember(t, firmId, 'lawyer', { name: 'Lina', email: 'lina@example.com' });
    const { partyId } = await setupCaseAndParty(t, owner, lawyer.userId);
    // A syntactically-valid but nonexistent case id — reusing partyId's raw
    // string in the wrong table's id slot deliberately, to exercise the
    // not-found path rather than a validator-rejection path.
    const fakeCaseId = partyId as unknown as Id<'cases'>;

    await expectRejectedWithCode(
      lawyer.authed.mutation(api.caseParties.add, {
        caseId: fakeCaseId,
        partyId,
        role: 'defendant',
      }),
      ERROR_CODES.CASE_NOT_FOUND,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bunx vitest run convex/caseParties.test.ts`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Write the model layer**

```ts
// convex/model/caseParties/caseParties.ts
import type { Id, Doc } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { PartyRole } from '@diwan/shared';

type WriteCtx = Pick<MutationCtx, 'db'>;
type ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>;

export interface AddCasePartyFields {
  role: PartyRole;
  representingLawyerId?: Id<'users'>;
  powerOfAttorneyRef?: string;
}

export async function addCaseParty(
  ctx: WriteCtx,
  firmId: Id<'firms'>,
  caseId: Id<'cases'>,
  partyId: Id<'parties'>,
  fields: AddCasePartyFields,
): Promise<Id<'caseParties'>> {
  return await ctx.db.insert('caseParties', {
    firmId,
    caseId,
    partyId,
    role: fields.role,
    representingLawyerId: fields.representingLawyerId,
    powerOfAttorneyRef: fields.powerOfAttorneyRef,
    createdAt: Date.now(),
  });
}

export async function listPartiesForCase(ctx: ReadCtx, caseId: Id<'cases'>): Promise<Doc<'caseParties'>[]> {
  return await ctx.db
    .query('caseParties')
    .withIndex('by_case', (q) => q.eq('caseId', caseId))
    .collect();
}

export async function listCasesForParty(ctx: ReadCtx, partyId: Id<'parties'>): Promise<Doc<'caseParties'>[]> {
  return await ctx.db
    .query('caseParties')
    .withIndex('by_party', (q) => q.eq('partyId', partyId))
    .collect();
}
```

Both list functions use plain `.collect()` (not pagination) here — deliberately: the number of parties on a single case, or cases a single person is party to, is bounded by the domain (a handful to a few dozen, never thousands), unlike firm-wide `cases`/`parties` lists.

- [ ] **Step 4: Write the function surface**

```ts
// convex/caseParties.ts
import { v } from 'convex/values';
import { firmQuery, firmMutation } from './functions.ts';
import { requireAccessibleCase, requireLawyerScopedAccess } from './model/authz/owned.ts';
import { requireAccessibleParty } from './model/parties/parties.ts';
import { addCaseParty, listPartiesForCase, listCasesForParty } from './model/caseParties/caseParties.ts';
import { recordAuditEvent } from './model/audit/recordAuditEvent.ts';
import { literalUnion } from './lib/validators.ts';
import { PERMISSIONS, PARTY_ROLES } from '@diwan/shared';

const roleValidator = literalUnion(PARTY_ROLES);

const casePartyValidator = v.object({
  _id: v.id('caseParties'),
  caseId: v.id('cases'),
  partyId: v.id('parties'),
  role: roleValidator,
  representingLawyerId: v.optional(v.id('users')),
  powerOfAttorneyRef: v.optional(v.string()),
});

export const add = firmMutation({
  args: {
    caseId: v.id('cases'),
    partyId: v.id('parties'),
    role: roleValidator,
    representingLawyerId: v.optional(v.id('users')),
    powerOfAttorneyRef: v.optional(v.string()),
  },
  returns: v.id('caseParties'),
  handler: async (ctx, args) => {
    const caseDoc = await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    requireLawyerScopedAccess(
      ctx,
      caseDoc.primaryLawyerId,
      PERMISSIONS.CASES_WRITE_OWN,
      PERMISSIONS.CASES_WRITE_ALL,
    );
    await requireAccessibleParty(ctx, ctx.firmId, args.partyId);

    const casePartyId = await addCaseParty(ctx, ctx.firmId, args.caseId, args.partyId, {
      role: args.role,
      representingLawyerId: args.representingLawyerId,
      powerOfAttorneyRef: args.powerOfAttorneyRef,
    });
    await recordAuditEvent(ctx, {
      firmId: ctx.firmId,
      actorId: ctx.userId,
      entityType: 'caseParties',
      entityId: casePartyId,
      action: 'create',
      after: args,
    });
    return casePartyId;
  },
});

export const listForCase = firmQuery({
  args: { caseId: v.id('cases') },
  returns: v.array(casePartyValidator),
  handler: async (ctx, args) => {
    await requireAccessibleCase(ctx, ctx.firmId, args.caseId);
    const rows = await listPartiesForCase(ctx, args.caseId);
    return rows.map((row) => ({
      _id: row._id,
      caseId: row.caseId,
      partyId: row.partyId,
      role: row.role,
      representingLawyerId: row.representingLawyerId,
      powerOfAttorneyRef: row.powerOfAttorneyRef,
    }));
  },
});

export const listForParty = firmQuery({
  args: { partyId: v.id('parties') },
  returns: v.array(casePartyValidator),
  handler: async (ctx, args) => {
    await requireAccessibleParty(ctx, ctx.firmId, args.partyId);
    const rows = await listCasesForParty(ctx, args.partyId);
    return rows.map((row) => ({
      _id: row._id,
      caseId: row.caseId,
      partyId: row.partyId,
      role: row.role,
      representingLawyerId: row.representingLawyerId,
      powerOfAttorneyRef: row.powerOfAttorneyRef,
    }));
  },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bunx convex dev --once && bunx vitest run convex/caseParties.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 6: Run the full suite and the root gate**

Run: `bun run check && bun run test`
Expected: `tsc --noEmit` clean; every test file across all 7 tasks passes.

- [ ] **Step 7: Commit**

```bash
git add convex/model/caseParties/ convex/caseParties.ts convex/caseParties.test.ts
git commit -m "feat: add caseParties add/listForCase/listForParty — cross-linked case<->party view"
```

---

## Self-Review

**1. Spec coverage against IMPLEMENTATION_PLAN.md §2 and its Definition of Done:**

- ✅ "Two parties with identical names and different national IDs never merge; two records with the same national ID always resolve to one person" — Task 5, `findOrCreateParty` + its two dedicated tests.
- ✅ "Archiving a case never deletes anything reachable — findable from Search and Archive views immediately after" — Task 6, `updateStatus`'s `'archived'` transition (never touches `deletedAt`) + its dedicated test.
- ✅ "Search returns cases/people/documents scoped to the firm, with Arabic fuzzy matching... highlights matches correctly against the original text" — Task 2 (`normalizeSearchText`/`highlightMatches`) wired into Task 5/6's `search` queries. Documents search is Plan 2's responsibility (out of scope here, per the agreed split).
- ✅ "A Secretary account never sees a case-file tab their role can't act on; an Associate's read-only tabs are provably read-only" — covered at the backend permission-boundary level (Task 6's Secretary-can-intake / Associate-cannot-close / Associate-cannot-read-unassigned-case tests). The *frontend* tab-gating itself is out of scope for a backend plan — flag for the M1 frontend plan.
- ✅ `caseTypes.requiredPartyRoles`/`requiredDocumentChecklist` — modeled in schema (Phase 0) and Task 4's `create`; nothing in this plan yet *enforces* a case's parties/documents against its type's checklist — that enforcement wasn't in IMPLEMENTATION_PLAN.md's M1 DoD text either, so it's correctly deferred, not silently dropped.
- ✅ Audit log — every mutation in Tasks 4-7 calls `recordAuditEvent`.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" patterns present — re-read every step; each has complete code. The one intentionally-deferred item (own-cases-only `list` view for Lawyer/Associate) is called out explicitly as a named follow-up, not glossed over.

**3. Type/signature consistency across tasks:**
- `WriteCtx = Pick<MutationCtx, 'db'>` / `ReadCtx = Pick<QueryCtx | MutationCtx, 'db'>` — same shape, same names, in every model file (Tasks 3, 4, 5, 6, 7).
- `requireAccessibleCase`/`requireLawyerScopedAccess` signatures used in Task 6/7 match exactly what Phase 0 already built in `convex/model/authz/owned.ts` (verified against that file's actual exports, not recalled from memory).
- `PartyFields`/`CreateCaseFields`/`AddCasePartyFields` — each defined once in its model file, imported everywhere else that needs the shape; no second hand-typed copy.
- `recordAuditEvent`'s call signature (`{firmId, actorId, entityType, entityId, action, before?, after?}`) is identical across all 8 call sites in Tasks 4-7.

**4. Known minor tradeoff, flagged rather than silently accepted:** Task 1's `exampleAuthedQuery` is a real, permanently-deployed `api.testHelpers.exampleAuthedQuery` endpoint that exists only to smoke-test the `activeFirmQuery` ladder before any real entity function exists to test it against (Tasks 4-7 come later). It returns nothing sensitive beyond the caller's own `firmId`, but it's a test-only endpoint living in production `api.*` surface indefinitely. Low severity, not worth blocking this plan over — but worth a follow-up task in Plan 2 or later to either delete it once a real query exists to re-target the smoke test at, or move it behind `internal*` if Convex's test harness allows testing internal-function-built ladders directly (needs checking against `convex-test`'s actual behavior with `internalQuery`-based custom builders).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-10-lcms-m1-core-entities.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
