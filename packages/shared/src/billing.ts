// IMPLEMENTATION_PLAN.md §5.6 — trial/active/past_due/cancelled, given verbatim.
export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// PLAN §3's "Recording a payment ... cash vs. check details" — the only two
// methods named so far. Extend (e.g. bank_transfer) when M2 designs the
// payment wizard's method-specific step in full.
export const PAYMENT_METHODS = ['cash', 'check'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// PLAN §3 — "received→deposited→cleared/bounced", given verbatim.
export const CHECK_STATUSES = ['received', 'deposited', 'cleared', 'bounced'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

// ledgerEntries.accountType (PLAN §3): trust/fee/client.
export const LEDGER_ACCOUNT_TYPES = ['trust', 'fee', 'client'] as const;
export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];

export const LEDGER_DIRECTIONS = ['debit', 'credit'] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

// ledgerEntries.type (PLAN §3): payment/refund/adjustment.
export const LEDGER_ENTRY_TYPES = ['payment', 'refund', 'adjustment'] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

// Stored status only ever transitions scheduled->paid (M2 Plan design
// spec §2.6) — 'overdue' is never written to the row, only computed at
// read time (dueDate < now && status === 'scheduled'), so it isn't a
// third enum value here.
export const INSTALLMENT_STATUSES = ['scheduled', 'paid'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const FINANCIAL_COUNTER_SCOPES = ['firm', 'lawyer'] as const;
export type FinancialCounterScope = (typeof FINANCIAL_COUNTER_SCOPES)[number];
