import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  CASE_STATUSES,
  CHECK_STATUSES,
  CONFIDENTIALITY_LEVELS,
  DOCUMENT_KINDS,
  FINANCIAL_COUNTER_SCOPES,
  INSTALLMENT_STATUSES,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_DIRECTIONS,
  LEDGER_ENTRY_TYPES,
  MISSION_PRIORITIES,
  MISSION_STATUSES,
  MISSION_TYPES,
  NOTIFICATION_EVENT_TYPES,
  PARTY_ROLES,
  PAYMENT_METHODS,
  SUBSCRIPTION_STATUSES,
  SYSTEM_ROLES
} from '@diwan/shared';
import { literalUnion } from './lib/validators.ts';

// Every table this plan names in Phase 0 §1.1 item 1 is defined now, even
// though most milestones won't populate theirs until later. Tenant-rooted
// indexes lead with `firmId`; child indexes may lead with an already-authorized
// parent ID. Soft-deletable records carry `deletedAt`.
export default defineSchema({
  // @convex-dev/auth's own tables (authAccounts, authSessions,
  // authRefreshTokens, authVerificationCodes, authVerifiers,
  // authRateLimits, and a default `users`) — spread first so our `users`
  // override below wins, per the library's documented merge pattern.
  ...authTables,

  // ---------------------------------------------------------------------
  // Tenancy & auth
  // ---------------------------------------------------------------------

  firms: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number()
  }).index('by_slug', ['slug']),

  subscriptions: defineTable({
    firmId: v.id('firms'),
    // Plan structure (single tier vs. seat bands) is PRD §11's open
    // question — kept as a free string until that's decided.
    plan: v.string(),
    seatLimit: v.number(),
    status: literalUnion(SUBSCRIPTION_STATUSES),
    billingNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_firm', ['firmId']),

  // Global — a user can belong to multiple firms via firmMembers.
  // Merge with @convex-dev/auth's own `authTables` once auth is wired up
  // (Phase 0 §1.1.4); this shape must stay compatible with what that
  // library expects on the users table.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    activeFirmId: v.optional(v.id('firms')),
    // Soft-delete marker for accounts (mirrors deletedAt's role elsewhere;
    // checked in loadAuthenticatedUser per the manifesto's ladder pattern).
    archivedAt: v.optional(v.number())
  }).index('by_email', ['email']),

  // Global RBAC role catalog — the six system roles (PRD §6), seeded
  // idempotently by internal/rbac.ts. Not firm-scoped: the role
  // definitions and their permission sets are the same everywhere: the
  // catalog is code (packages/shared/rbac.ts), this table is just its
  // seeded, queryable form so firmMembers.roleId can reference a Doc.
  roles: defineTable({
    name: literalUnion(SYSTEM_ROLES),
    permissions: v.array(v.string()),
    isSystemRole: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_name', ['name']),

  firmMembers: defineTable({
    firmId: v.id('firms'),
    userId: v.id('users'),
    roleId: v.id('roles'),
    status: literalUnion(['pending', 'active', 'archived'] as const),
    invitedAt: v.number(),
    joinedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number())
  })
    .index('by_firm', ['firmId'])
    .index('by_firm_deleted', ['firmId', 'deletedAt'])
    .index('by_firm_user', ['firmId', 'userId'])
    .index('by_user', ['userId']),

  // Per-member grant/revoke overrides on top of the role's permission set
  // (Backend Manifesto §4's loadMemberContext pattern). firmId is
  // duplicated from the referenced member for direct index scoping.
  memberPermissionOverrides: defineTable({
    firmId: v.id('firms'),
    memberId: v.id('firmMembers'),
    permission: v.string(),
    effect: literalUnion(['grant', 'revoke'] as const),
    createdAt: v.number()
  }).index('by_member', ['memberId']),

  // ---------------------------------------------------------------------
  // M1 — Cases, Parties, Documents, Search, Audit
  // ---------------------------------------------------------------------

  cases: defineTable({
    firmId: v.id('firms'),
    internalNumber: v.string(),
    courtNumber: v.optional(v.string()),
    courtName: v.optional(v.string()),
    caseTypeId: v.id('caseTypes'),
    claimAmount: v.optional(v.number()),
    status: literalUnion(CASE_STATUSES),
    // Own-vs-assigned scoping key (PRD §6: Lawyer "own/assigned cases",
    // Associate "assigned cases"). Not itemized as a field in PLAN §2's
    // table list, but the RBAC own/all permission split (packages/shared
    // rbac.ts) is structurally meaningless without it.
    primaryLawyerId: v.id('users'),
    searchText: v.string(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_firm_status', ['firmId', 'status'])
    .index('by_firm_status_and_deleted_and_created', [
      'firmId',
      'status',
      'deletedAt',
      'createdAt'
    ])
    .index('by_firm_deleted_created', ['firmId', 'deletedAt', 'createdAt'])
    .index('by_firm_lawyer_deleted_created', [
      'firmId',
      'primaryLawyerId',
      'deletedAt',
      'createdAt'
    ])
    .index('by_firm_lawyer_and_status_and_deleted_and_created', [
      'firmId',
      'primaryLawyerId',
      'status',
      'deletedAt',
      'createdAt'
    ])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['firmId', 'primaryLawyerId', 'deletedAt']
    }),

  // Denormalized totals used by the Naab-style cases table. There is one
  // firm-wide row and one row per assigned lawyer, allowing the table footer
  // and status tabs to stay exact without scanning the cases table.
  caseTableMetrics: defineTable({
    firmId: v.id('firms'),
    scope: literalUnion(['firm', 'lawyer'] as const),
    primaryLawyerId: v.optional(v.id('users')),
    total: v.number(),
    statusCounts: v.object({
      intake: v.number(),
      filed: v.number(),
      in_hearings: v.number(),
      verdict: v.number(),
      execution: v.number(),
      closed: v.number(),
      archived: v.number()
    }),
    updatedAt: v.number()
  })
    .index('by_firm_and_scope', ['firmId', 'scope'])
    .index('by_firm_and_scope_and_lawyer', [
      'firmId',
      'scope',
      'primaryLawyerId'
    ]),

  // Admin-configurable taxonomy, seeded from a Palestine default set per
  // firm (PRD §2) — what makes a second jurisdiction later a data-entry
  // task, not code. PLAN §2 flags the actual default content as a
  // legal-research deliverable still needing an owner.
  caseTypes: defineTable({
    firmId: v.id('firms'),
    key: v.string(),
    label: v.string(),
    requiredPartyRoles: v.array(literalUnion(PARTY_ROLES)),
    requiredDocumentChecklist: v.array(literalUnion(DOCUMENT_KINDS)),
    deletedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index('by_firm_key', ['firmId', 'key'])
    .index('by_firm_deleted', ['firmId', 'deletedAt']),

  parties: defineTable({
    firmId: v.id('firms'),
    // The disambiguation key — PRD's no-OTP decision means this is the
    // *only* identity mechanism; get dedup-on-nationalId right (PLAN §2).
    nationalId: v.string(),
    fullName: v.string(),
    fatherName: v.optional(v.string()),
    dob: v.optional(v.number()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    searchText: v.string(),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_firm_national_id', ['firmId', 'nationalId'])
    .index('by_firm_deleted_created', ['firmId', 'deletedAt', 'createdAt'])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['firmId', 'deletedAt']
    }),

  // Join row between a case and a party. firmId is duplicated from the
  // owning case for direct index scoping (Backend Manifesto §4).
  caseParties: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    partyId: v.id('parties'),
    role: literalUnion(PARTY_ROLES),
    representingLawyerId: v.optional(v.id('users')),
    powerOfAttorneyRef: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_case', ['caseId'])
    .index('by_case_party_role', ['caseId', 'partyId', 'role'])
    .index('by_party', ['partyId']),

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
    updatedAt: v.number()
  })
    .index('by_case_deleted', ['caseId', 'deletedAt'])
    .index('by_case_deleted_kind', ['caseId', 'deletedAt', 'kind'])
    .index('by_firm_deleted_created', ['firmId', 'deletedAt', 'createdAt'])
    .searchIndex('search_text', {
      searchField: 'searchText',
      filterFields: ['firmId', 'deletedAt']
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
    // is selected and implemented.
    ocrText: v.optional(v.string()),
    uploadedBy: v.id('users'),
    createdAt: v.number()
  }).index('by_document', ['documentId']),

  auditLog: defineTable({
    firmId: v.id('firms'),
    actorId: v.id('users'),
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    // JSON-stringified snapshots — genuinely variable shape per entity
    // type, but the manifesto bans v.any() outright, so this is a string
    // rather than an escape hatch. Not queried structurally; only ever
    // displayed.
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_firm_entity', ['firmId', 'entityType', 'entityId'])
    .index('by_firm_created', ['firmId', 'createdAt']),

  // ---------------------------------------------------------------------
  // M2 — Money
  // ---------------------------------------------------------------------

  // Append-only. No update/delete mutation exists on this table anywhere
  // in convex/ — corrections are new reversing rows (PLAN §3). That
  // absence is itself the safety mechanism, stronger than a permission
  // check.
  ledgerEntries: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    accountType: literalUnion(LEDGER_ACCOUNT_TYPES),
    personId: v.id('parties'),
    amount: v.number(),
    direction: literalUnion(LEDGER_DIRECTIONS),
    type: literalUnion(LEDGER_ENTRY_TYPES),
    refType: v.string(),
    refId: v.string(),
    createdBy: v.id('users'),
    createdAt: v.number()
  })
    .index('by_case', ['caseId'])
    .index('by_case_account_type', ['caseId', 'accountType'])
    .index('by_firm_created', ['firmId', 'createdAt'])
    .index('by_firm_ref_type_ref_id', ['firmId', 'refType', 'refId']),

  // receiptNo must be a real gapless sequential counter per firm (PLAN
  // §3) — a Convex-transaction-safe increment, never a random code or a
  // client-computed positional index.
  receipts: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    receiptNo: v.number(),
    payerId: v.id('parties'),
    payeeId: v.optional(v.id('parties')),
    amount: v.number(),
    method: literalUnion(PAYMENT_METHODS),
    date: v.number(),
    remainingBalance: v.number(),
    signatureRef: v.optional(v.string()),
    createdBy: v.id('users'),
    createdAt: v.number()
  })
    .index('by_firm_receipt_no', ['firmId', 'receiptNo'])
    .index('by_case', ['caseId']),

  checks: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    receiptId: v.id('receipts'),
    checkNumber: v.string(),
    bank: v.string(),
    dueDate: v.number(),
    status: literalUnion(CHECK_STATUSES),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_case', ['caseId'])
    .index('by_case_status', ['caseId', 'status'])
    .index('by_firm_status_due_date', ['firmId', 'status', 'dueDate']),

  // Schedule rows feeding the notification escalation ladder (PLAN §3) —
  // one row per installment, not an array field on a parent plan. Status
  // only ever transitions scheduled->paid; 'overdue' is computed at read
  // time in convex/installments.ts, never stored (M2 Plan design §2.6).
  installmentPlans: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    amount: v.number(),
    dueDate: v.number(),
    status: literalUnion(INSTALLMENT_STATUSES),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_case', ['caseId'])
    .index('by_firm_status_due_date', ['firmId', 'status', 'dueDate']),

  // Running who-owes-whom totals, maintained by a before/after delta on
  // every ledger write and patched in the same transaction (PLAN §3) —
  // never recomputed from scratch on read. `scope`/`lawyerId` together
  // key both the firm-wide and per-lawyer aggregate rows. Tracks fee
  // receivables only, not trust balances (M2 Plan design §2.8).
  financialCounters: defineTable({
    firmId: v.id('firms'),
    scope: literalUnion(FINANCIAL_COUNTER_SCOPES),
    lawyerId: v.optional(v.id('users')),
    outstandingBalance: v.number(),
    updatedAt: v.number()
  })
    .index('by_firm_scope', ['firmId', 'scope'])
    .index('by_firm_scope_lawyer', ['firmId', 'scope', 'lawyerId']),

  // O(1) trust/client balance reads on payment write paths. Updated in the
  // same transaction as the append-only ledger row; the ledger remains the
  // reconciliation source of truth. Existing deployments must backfill these
  // rows before enabling writes that predate this table.
  caseAccountBalances: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    accountType: literalUnion(['trust', 'client'] as const),
    balance: v.number(),
    updatedAt: v.number()
  }).index('by_case_account_type', ['caseId', 'accountType']),

  // One narrow row per firm — the entire concurrency-safety mechanism for
  // receiptNo (M2 Plan design §2.2). Convex's OCC serializes concurrent
  // writers on this exact document, so two concurrent receipt creations
  // can never collide or skip a number.
  receiptCounters: defineTable({
    firmId: v.id('firms'),
    nextReceiptNo: v.number(),
    updatedAt: v.number()
  }).index('by_firm', ['firmId']),

  // ---------------------------------------------------------------------
  // M3 — Hearings, Calendar, Missions, Notifications
  // ---------------------------------------------------------------------

  hearings: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    date: v.number(),
    court: v.optional(v.string()),
    judge: v.optional(v.string()),
    hall: v.optional(v.string()),
    outcome: v.optional(v.string()),
    // Self-link preserving the postponement chain (PLAN §4).
    nextHearingId: v.optional(v.id('hearings')),
    // Conflict-detection key — PLAN §4 requires "an indexed range query
    // on by_lawyer_date for the target lawyer's existing hearings" at
    // write time; this field and index exist now so that check has
    // something to query against.
    lawyerId: v.id('users'),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_firm', ['firmId'])
    .index('by_case', ['caseId'])
    .index('by_firm_lawyer_date', ['firmId', 'lawyerId', 'date'])
    .index('by_firm_deleted_date', ['firmId', 'deletedAt', 'date']),

  missions: defineTable({
    firmId: v.id('firms'),
    caseId: v.id('cases'),
    title: v.string(),
    type: literalUnion(MISSION_TYPES),
    assigneeId: v.id('users'),
    dueDate: v.number(),
    priority: literalUnion(MISSION_PRIORITIES),
    status: literalUnion(MISSION_STATUSES),
    checklist: v.array(v.object({ label: v.string(), done: v.boolean() })),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_firm', ['firmId'])
    .index('by_case', ['caseId'])
    .index('by_firm_assignee_status', ['firmId', 'assigneeId', 'status'])
    .index('by_firm_deleted_due_date', ['firmId', 'deletedAt', 'dueDate']),

  notifications: defineTable({
    firmId: v.id('firms'),
    userId: v.id('users'),
    eventType: literalUnion(NOTIFICATION_EVENT_TYPES),
    // Small JSON payload, shape varies by eventType — parsed client-side.
    // Placeholder until M3 designs the real routing table (see
    // packages/shared/notifications.ts).
    payload: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number()
  })
    .index('by_firm_user', ['firmId', 'userId'])
    .index('by_firm_user_read', ['firmId', 'userId', 'read']),

  notificationPreferences: defineTable({
    firmId: v.id('firms'),
    userId: v.id('users'),
    eventType: literalUnion(NOTIFICATION_EVENT_TYPES),
    channel: literalUnion(['in_app', 'sms', 'whatsapp'] as const),
    enabled: v.boolean()
  }).index('by_firm_user', ['firmId', 'userId']),

  // ---------------------------------------------------------------------
  // M4 — AI Assistant
  // ---------------------------------------------------------------------

  aiThreads: defineTable({
    firmId: v.id('firms'),
    userId: v.id('users'),
    // Dedupes a thread across client reconnects (PLAN §5).
    clientThreadKey: v.string(),
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_firm_user', ['firmId', 'userId'])
    .index('by_firm_user_client_thread_key', [
      'firmId',
      'userId',
      'clientThreadKey'
    ]),

  aiMessages: defineTable({
    firmId: v.id('firms'),
    threadId: v.id('aiThreads'),
    role: literalUnion(['user', 'assistant', 'tool'] as const),
    content: v.string(),
    // JSON-stringified tool-call record for assistant turns, if any.
    toolCalls: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_thread', ['threadId'])
    .index('by_firm', ['firmId']),

  aiUsageCredits: defineTable({
    firmId: v.id('firms'),
    balance: v.number(),
    ceiling: v.number(),
    updatedAt: v.number()
  }).index('by_firm', ['firmId']),

  // The "event log" PLAN §5 describes alongside aiUsageCredits — split
  // into its own append-only table rather than an ever-growing array
  // field on the single per-firm balance row (the same insert-only
  // reasoning as ledgerEntries: an unbounded log can't live inside one
  // document that every LLM call would otherwise have to patch).
  aiUsageEvents: defineTable({
    firmId: v.id('firms'),
    threadId: v.optional(v.id('aiThreads')),
    balanceBefore: v.number(),
    balanceAfter: v.number(),
    cost: v.number(),
    createdAt: v.number()
  }).index('by_firm_created', ['firmId', 'createdAt'])
});
