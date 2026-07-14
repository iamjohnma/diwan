# Branch notes — cursor/calendar-person-filter-3ae5

## Task

`/calendar` page (big calendar, "doctor"/team view copied from Naab): clicking a
person's column header highlighted the header and armed the Escape hint, but it
never filtered the view down to that one person like Naab does.

## Changes

- `fe/src/components/common/big-calendar/views/doctor-view/calendar-doctor-view.tsx`
  - The doctor view now derives its displayed doctors list from
    `calendar.focusedDoctorId`: when a doctor is focused, only that doctor's
    column (header, events, layout width, DnD hit-testing) renders. Clicking the
    focused header again, or pressing Escape, restores all columns.
  - A stale/unknown focus id falls back to showing everyone.
  - Display-only filter: `collisionIntervals` stays unfiltered per the contract
    documented on `BigCalendarProps.collisionIntervals`, so a focused view can
    never hide a double-booking.

## Notes for the merger

- No schema, backend, i18n, or shared-package changes. Single-file change plus
  this notes file.
- Focus state itself (page `useState`, header click toggle, Escape wiring,
  hint toast) already existed and is untouched; only the missing "apply the
  filter to the columns" piece was added.
- Pre-existing repo-wide `check` violations (7 ESLint hits in this same file,
  ~6 tsc errors elsewhere) are unchanged — verified identical on `main` before
  and after this edit.
