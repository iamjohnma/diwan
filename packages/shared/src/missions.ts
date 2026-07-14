// PLAN §4 gives the board columns as an example only ("e.g. To Do / In
// Progress / Done, or however the firm's workflow maps missions.status") —
// starter set for the v1 schema, not a finalized design. Revisit when M3's
// Kanban board is built.
export const MISSION_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type MissionPriority = (typeof MISSION_PRIORITIES)[number];

// PLAN §4 names "appeal window, statute deadline" as the deadline-critical
// types that auto-generate from verdict/hearing events; PRD §4 gives "serve
// summons, submit memo, obtain prison order" as general examples. Starter
// set — revisit when M3 designs the Palestinian legal-deadline templates.
export const MISSION_TYPES = [
  'appeal_deadline',
  'statute_deadline',
  'serve_summons',
  'submit_memo',
  'obtain_court_order',
  'hearing_prep',
  'client_meeting',
  'other',
] as const;
export type MissionType = (typeof MISSION_TYPES)[number];
