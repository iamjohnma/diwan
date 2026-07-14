export function buildCalendarPreferencesUpdate(calendar: {
  view: string;
  rangeDays: number;
  timeZone: string;
  timeZoneMode: 'system' | 'manual';
}) {
  return calendar;
}

export function buildAppearancePreferencesUpdate(appearance: {
  calendarZoom: number;
}) {
  return appearance;
}

export function scheduleUserPreferencesUpdate(_update: unknown): void {
  // Calendar preferences are already persisted in local UI state for the mock.
}
