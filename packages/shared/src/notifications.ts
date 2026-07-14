// PRD §8 describes role-aware, in-app/SMS/WhatsApp-routed notifications in
// prose but does not give a literal event-type -> role table (confirmed by
// re-reading §8 directly — there is no table there yet). PLAN §4 explicitly
// assigns designing that data-driven routing table to M3
// ("model/notifications/" — build as real data, not a per-handler switch).
//
// This starter set exists only so Phase 0's `notifications` table has a
// typed eventType field instead of a bare v.string(). Treat it as a
// placeholder to replace, not extend, when M3 designs the actual routing
// table.
export const NOTIFICATION_EVENT_TYPES = [
  'hearing_scheduled',
  'hearing_conflict',
  'mission_assigned',
  'mission_due_soon',
  'payment_received',
  'payment_approval_needed',
  'check_bounced',
] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];
