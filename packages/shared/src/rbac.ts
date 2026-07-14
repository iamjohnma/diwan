// RBAC catalog — the single source of truth for permission strings, consumed by
// both convex/ (validators + seed) and the frontend (nav/tab gating).
//
// Shape: RESOURCES/ACTIONS constants -> buildPermission() string builder ->
// a curated PERMISSION_CATALOG (not a full cross-product) -> per-role arrays
// -> normalizePermissionDependencies() auto-adds implied permissions.
// Owner gets a wildcard, never an enumerated list.

export const RESOURCES = [
  'cases',
  'parties',
  'documents',
  'hearings',
  'missions',
  'payments',
  'reports',
  'staff',
  'settings',
  'auditLog',
  'notifications',
] as const;
export type Resource = (typeof RESOURCES)[number];

// Most resources use the plain actions. `cases` and `payments` are lawyer-scoped
// (own vs. all — PRD §6's "own/assigned" vs firm-wide access) and use the
// Own/All action pair instead of plain read/write, so there is never a
// redundant "read" permission sitting alongside "readOwn"/"readAll" for the
// same resource.
export const ACTIONS = [
  'read',
  'readOwn',
  'readAll',
  'write',
  'writeOwn',
  'writeAll',
  'delete',
  'close',
  'approve',
  'export',
  'manage',
] as const;
export type Action = (typeof ACTIONS)[number];

export function buildPermission(resource: Resource, action: Action): PermissionString {
  return `${resource}.${action}` as PermissionString;
}

function parsePermission(permission: PermissionString): { resource: Resource; action: Action } {
  const [resource, action] = permission.split('.') as [Resource, Action];
  return { resource, action };
}

// The curated catalog — every permission that actually exists. Deliberately
// not a full RESOURCES x ACTIONS cross-product; e.g. `parties.close` is
// meaningless and is never added here.
export const PERMISSION_CATALOG: PermissionString[] = [
  buildPermission('cases', 'readOwn'),
  buildPermission('cases', 'readAll'),
  buildPermission('cases', 'writeOwn'),
  buildPermission('cases', 'writeAll'),
  buildPermission('cases', 'delete'),
  buildPermission('cases', 'close'),

  buildPermission('parties', 'read'),
  buildPermission('parties', 'write'),
  buildPermission('parties', 'delete'),

  buildPermission('documents', 'read'),
  buildPermission('documents', 'write'),
  buildPermission('documents', 'delete'),

  buildPermission('hearings', 'read'),
  buildPermission('hearings', 'write'),
  buildPermission('hearings', 'delete'),

  buildPermission('missions', 'read'),
  buildPermission('missions', 'write'),
  buildPermission('missions', 'delete'),

  buildPermission('payments', 'readOwn'),
  buildPermission('payments', 'readAll'),
  buildPermission('payments', 'writeOwn'),
  buildPermission('payments', 'writeAll'),
  buildPermission('payments', 'approve'),

  buildPermission('reports', 'read'),
  buildPermission('reports', 'export'),

  buildPermission('staff', 'read'),
  buildPermission('staff', 'manage'),

  buildPermission('settings', 'read'),
  buildPermission('settings', 'manage'),

  buildPermission('auditLog', 'read'),

  buildPermission('notifications', 'read'),
  buildPermission('notifications', 'manage'),
];

// Actions that imply other actions on the SAME resource, applied transitively
// by normalizePermissionDependencies(). Only applied when the implied
// permission actually exists in PERMISSION_CATALOG for that resource, so this
// table can stay generic across every resource rather than being hand-listed
// per resource.
const ACTION_IMPLIES: Partial<Record<Action, Action[]>> = {
  writeOwn: ['readOwn'],
  writeAll: ['readAll'],
  write: ['read'],
  delete: ['read'],
  close: ['readOwn', 'writeOwn'],
  approve: ['readAll'],
  export: ['read'],
  manage: ['read'],
};

export function normalizePermissionDependencies(
  permissions: ReadonlySet<PermissionString>,
): Set<PermissionString> {
  const result = new Set(permissions);
  let changed = true;
  while (changed) {
    changed = false;
    for (const permission of result) {
      const { resource, action } = parsePermission(permission);
      for (const impliedAction of ACTION_IMPLIES[action] ?? []) {
        const implied = buildPermission(resource, impliedAction);
        if (PERMISSION_CATALOG.includes(implied) && !result.has(implied)) {
          result.add(implied);
          changed = true;
        }
      }
    }
  }
  return result;
}

export const RBAC = {
  OWNER_WILDCARD: '*',
} as const;

export const SYSTEM_ROLES = [
  'owner',
  'lawyer',
  'associate',
  'secretary',
  'accountant',
  'paralegal',
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

// PRD §6. Owner is intentionally absent — it gets RBAC.OWNER_WILDCARD, never
// an enumerated permission list. Accountant and Paralegal are PRD-marked
// stubs; their permission sets here are a reasonable v1 starting point, not a
// finalized design — revisit when either role's screen gets built out.
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<SystemRole, 'owner'>, PermissionString[]> = {
  // Own/assigned cases full access, own calendar, own payment ledger, create missions.
  lawyer: [
    buildPermission('cases', 'readOwn'),
    buildPermission('cases', 'writeOwn'),
    buildPermission('cases', 'close'),
    buildPermission('parties', 'read'),
    buildPermission('parties', 'write'),
    buildPermission('documents', 'read'),
    buildPermission('documents', 'write'),
    buildPermission('hearings', 'read'),
    buildPermission('hearings', 'write'),
    buildPermission('missions', 'read'),
    buildPermission('missions', 'write'),
    buildPermission('payments', 'readOwn'),
    buildPermission('payments', 'writeOwn'),
    buildPermission('payments', 'approve'),
    buildPermission('reports', 'read'),
    buildPermission('notifications', 'read'),
  ],
  // Assigned cases (read/write per assignment), draft documents, cannot
  // approve payments or close cases.
  associate: [
    buildPermission('cases', 'readOwn'),
    buildPermission('cases', 'writeOwn'),
    buildPermission('parties', 'read'),
    buildPermission('parties', 'write'),
    buildPermission('documents', 'read'),
    buildPermission('documents', 'write'),
    buildPermission('hearings', 'read'),
    buildPermission('missions', 'read'),
    buildPermission('missions', 'write'),
    buildPermission('payments', 'readOwn'),
    buildPermission('notifications', 'read'),
  ],
  // Case intake, scheduling, hearings calendar, notification routing,
  // registers cash/check payments (pending lawyer approval).
  secretary: [
    buildPermission('cases', 'readAll'),
    buildPermission('cases', 'writeAll'),
    buildPermission('parties', 'read'),
    buildPermission('parties', 'write'),
    buildPermission('documents', 'read'),
    buildPermission('documents', 'write'),
    buildPermission('hearings', 'read'),
    buildPermission('hearings', 'write'),
    buildPermission('missions', 'read'),
    buildPermission('payments', 'writeAll'),
    buildPermission('notifications', 'read'),
    buildPermission('notifications', 'manage'),
  ],
  // (stub) Reconciles ledger, approves refunds, exports financial reports;
  // no privileged legal documents.
  accountant: [
    buildPermission('cases', 'readAll'),
    buildPermission('parties', 'read'),
    buildPermission('payments', 'readAll'),
    buildPermission('payments', 'writeAll'),
    buildPermission('payments', 'approve'),
    buildPermission('reports', 'read'),
    buildPermission('reports', 'export'),
    buildPermission('notifications', 'read'),
  ],
  // (stub) Document prep, exhibit management, no financial access.
  paralegal: [
    buildPermission('cases', 'readAll'),
    buildPermission('parties', 'read'),
    buildPermission('documents', 'read'),
    buildPermission('documents', 'write'),
    buildPermission('hearings', 'read'),
    buildPermission('notifications', 'read'),
  ],
};

// Branded so a raw string can never be assigned where a checked permission is
// expected — PERMISSIONS.* constants are the only legal values.
declare const permissionBrand: unique symbol;
export type PermissionString = string & { readonly [permissionBrand]: true };

// PERMISSIONS.* typed constants — the only way permissions should be
// referenced anywhere in convex/ or the frontend. A typo here is a compile
// error, not a silent authorization hole.
export const PERMISSIONS = {
  CASES_READ_OWN: buildPermission('cases', 'readOwn'),
  CASES_READ_ALL: buildPermission('cases', 'readAll'),
  CASES_WRITE_OWN: buildPermission('cases', 'writeOwn'),
  CASES_WRITE_ALL: buildPermission('cases', 'writeAll'),
  CASES_DELETE: buildPermission('cases', 'delete'),
  CASES_CLOSE: buildPermission('cases', 'close'),

  PARTIES_READ: buildPermission('parties', 'read'),
  PARTIES_WRITE: buildPermission('parties', 'write'),
  PARTIES_DELETE: buildPermission('parties', 'delete'),

  DOCUMENTS_READ: buildPermission('documents', 'read'),
  DOCUMENTS_WRITE: buildPermission('documents', 'write'),
  DOCUMENTS_DELETE: buildPermission('documents', 'delete'),

  HEARINGS_READ: buildPermission('hearings', 'read'),
  HEARINGS_WRITE: buildPermission('hearings', 'write'),
  HEARINGS_DELETE: buildPermission('hearings', 'delete'),

  MISSIONS_READ: buildPermission('missions', 'read'),
  MISSIONS_WRITE: buildPermission('missions', 'write'),
  MISSIONS_DELETE: buildPermission('missions', 'delete'),

  PAYMENTS_READ_OWN: buildPermission('payments', 'readOwn'),
  PAYMENTS_READ_ALL: buildPermission('payments', 'readAll'),
  PAYMENTS_WRITE_OWN: buildPermission('payments', 'writeOwn'),
  PAYMENTS_WRITE_ALL: buildPermission('payments', 'writeAll'),
  PAYMENTS_APPROVE: buildPermission('payments', 'approve'),

  REPORTS_READ: buildPermission('reports', 'read'),
  REPORTS_EXPORT: buildPermission('reports', 'export'),

  STAFF_READ: buildPermission('staff', 'read'),
  STAFF_MANAGE: buildPermission('staff', 'manage'),

  SETTINGS_READ: buildPermission('settings', 'read'),
  SETTINGS_MANAGE: buildPermission('settings', 'manage'),

  AUDIT_LOG_READ: buildPermission('auditLog', 'read'),

  NOTIFICATIONS_READ: buildPermission('notifications', 'read'),
  NOTIFICATIONS_MANAGE: buildPermission('notifications', 'manage'),
} as const satisfies Record<string, PermissionString>;
export type PermissionKey = keyof typeof PERMISSIONS;
