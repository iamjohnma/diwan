// IMPLEMENTATION_PLAN.md §2 — case lifecycle, given verbatim as
// "Intake→Filed→InHearings→Verdict→Execution→Closed→Archived".
export const CASE_STATUSES = [
  'intake',
  'filed',
  'in_hearings',
  'verdict',
  'execution',
  'closed',
  'archived',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

// PLAN §2 gives "plaintiff/defendant/guardian/intervener/…" — starter set,
// extend when M1's case-file Parties tab is built out.
export const PARTY_ROLES = [
  'plaintiff',
  'defendant',
  'guardian',
  'intervener',
  'witness',
  'other',
] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];
