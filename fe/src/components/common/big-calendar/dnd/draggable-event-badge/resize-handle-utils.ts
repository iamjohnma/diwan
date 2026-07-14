export const CALENDAR_EVENT_RESIZE_HANDLE_ATTR =
  'data-calendar-event-resize-handle';

export function isCalendarEventResizeHandleTarget(
  target: EventTarget | null
): boolean {
  return (
    target instanceof Element &&
    target.closest(`[${CALENDAR_EVENT_RESIZE_HANDLE_ATTR}]`) !== null
  );
}
