// Not enumerated in PRD.md/IMPLEMENTATION_PLAN.md yet — a starter set to
// unblock the M1 schema. Revisit when M1's Documents tab is designed.
export const DOCUMENT_KINDS = [
  'pleading',
  'evidence',
  'correspondence',
  'identification',
  'power_of_attorney',
  'court_order',
  'other',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const CONFIDENTIALITY_LEVELS = ['standard', 'confidential', 'privileged'] as const;
export type ConfidentialityLevel = (typeof CONFIDENTIALITY_LEVELS)[number];
