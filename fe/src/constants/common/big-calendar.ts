import type { VisibleHours, WorkingHours } from '@/@types/common/big-calendar';

const FULL_DAY: VisibleHours = { from: 0, to: 24 };

export const DEFAULT_WORKING_HOURS: WorkingHours = Object.fromEntries(
  Array.from({ length: 7 }, (_, day) => [day, { ...FULL_DAY }])
) as WorkingHours;

export const DEFAULT_VISIBLE_HOURS: VisibleHours = FULL_DAY;

export const DEFAULT_PIXELS_PER_HOUR = 200;
export const MINUTES_PER_SNAP = 5;
export const CLICK_SLOT_MINUTES = [0, 15, 30, 45];
export const CLICK_SLOTS_PER_HOUR = CLICK_SLOT_MINUTES.length;
export const EVENT_WINDOW_OVERSCAN_MINUTES = 120;

export const TIME_COLUMN_WIDTH = 72;
export const TIME_COLUMN_WIDTH_MOBILE = 48;
export const VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"]';

export function getCalendarScrollViewport(
  scrollArea: HTMLElement | null
): HTMLElement | null {
  return scrollArea?.querySelector<HTMLElement>(VIEWPORT_SELECTOR) ?? null;
}

export const CALENDAR_ZOOM_STEPS = [
  0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2
] as const;
export const CALENDAR_ZOOM_MIN = 0.25;
export const CALENDAR_ZOOM_MAX = 2;
export const CALENDAR_ZOOM_STEP = 0.05;

export const CALENDAR_CANCEL_SLOT_DRAG_EVENT = 'dms-calendar-cancel-slot-drag';

export const DRAG_OVERLAY_Z_INDEX = 19;
export const MIN_BADGE_HEIGHT_PX = 22;

// Touch gesture timeline for the event badge move surface:
//   0ms ..... finger lands (dnd-kit delay sensor arms, passthrough tracks)
//   <120ms .. fast movement (>12px) means scroll â€” passthrough takes over and
//             cancels the pending sensor
//   120ms ... scroll window closes; hold feedback (wiggle) appears
//   150ms ... sensor activates â€” the badge is picked up and follows the finger
// Thumb-contact drift is tolerated up to 24px before activation, so reacting
// to the wiggle a beat early no longer silently kills the drag.
export const CALENDAR_TOUCH_DRAG_ACTIVATION_DELAY_MS = 150;

export const CALENDAR_TOUCH_DRAG_HOLD_TOLERANCE_PX = 24;

// A gesture only counts as a scroll while it starts fast: >12px of travel
// within the first 120ms. Must stay below the activation delay (so the scroll
// window closes before the drag starts) and the threshold must stay below the
// hold tolerance (so a scroll flip always beats a tolerance cancel).
export const CALENDAR_TOUCH_SCROLL_INTENT_WINDOW_MS = 120;

export const CALENDAR_TOUCH_SCROLL_ACTIVATION_THRESHOLD_PX = 12;

// Resize handles skip the move surface's hold delay: grabbing an edge can only
// mean "resize" (no scroll to disambiguate), so a small movement should start
// the resize right away rather than requiring a motionless 200ms press.
export const CALENDAR_TOUCH_RESIZE_ACTIVATION_DISTANCE_PX = 6;

export const CALENDAR_TOUCH_HOLD_ROTATE_DEG = 2.5;

// Feedback fires at delay âˆ’ lead = 120ms, exactly when the scroll-intent
// window closes: once the badge wiggles, movement can no longer become a
// scroll, so following the wiggle immediately is safe (24px tolerance covers
// the remaining 30ms until activation).
export const CALENDAR_TOUCH_HOLD_FEEDBACK_LEAD_MS = 30;

export const CALENDAR_TOUCH_HOLD_MOTION_TRANSITION = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 26
};
