import { addDays, addMinutes, differenceInMinutes, parseISO } from 'date-fns';
import type {
  CalendarEvent,
  VisitCollisionInterval
} from '@/@types/common/big-calendar';
import { MINUTES_PER_SNAP } from '@/constants/common/big-calendar';

const MS_PER_MINUTE = 60_000;

export type VisitCollisionReason = 'patient' | 'dentist' | 'both';

export type { VisitCollisionInterval };

export interface VisitCollisionCandidate {
  start: Date;
  end: Date;
  patientId?: string | null;
  dentistId?: string | null;
  ignoreEventId?: string | number | null;
  ignoreVisitId?: string | null;
}

export interface VisitCollisionMatch {
  reason: VisitCollisionReason;
  patientConflict: VisitCollisionInterval | null;
  dentistConflict: VisitCollisionInterval | null;
}

const COLLISION_REASON_KEYS = {
  patient: 'bigCalendar.collision.patient',
  dentist: 'bigCalendar.collision.dentist',
  both: 'bigCalendar.collision.both'
} as const;

export function getVisitCollisionReasonKey(
  reason: VisitCollisionReason
): (typeof COLLISION_REASON_KEYS)[VisitCollisionReason] {
  return COLLISION_REASON_KEYS[reason];
}

export interface VisitCollisionSource {
  id: string | number;
  scheduledAt?: string | null;
  endTime?: string | null;
  patientId?: string | null;
  dentistId?: string | null;
}

/**
 * Maps raw visit rows to busy intervals for collision checks. Visits without a
 * schedule are skipped; visits without an explicit end time occupy the default
 * duration, matching how the calendar renders them.
 */
export function buildVisitCollisionIntervals(
  visits: readonly VisitCollisionSource[],
  defaultDurationMinutes: number
): VisitCollisionInterval[] {
  const intervals: VisitCollisionInterval[] = [];

  for (const visit of visits) {
    const startDate = visit.scheduledAt;
    if (!startDate) continue;

    let endDate = visit.endTime ?? null;
    if (!endDate) {
      const startMs = parseISO(startDate).getTime();
      if (!Number.isFinite(startMs)) continue;
      endDate = new Date(
        startMs + defaultDurationMinutes * MS_PER_MINUTE
      ).toISOString();
    }

    intervals.push({
      id: visit.id,
      visitId: String(visit.id),
      startDate,
      endDate,
      patientId: visit.patientId ?? null,
      dentistId: visit.dentistId ?? null
    });
  }

  return intervals;
}

function intervalsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

function isExcludedInterval(
  candidate: VisitCollisionCandidate,
  other: VisitCollisionInterval
): boolean {
  if (
    candidate.ignoreEventId !== undefined &&
    candidate.ignoreEventId !== null &&
    other.id === candidate.ignoreEventId
  ) {
    return true;
  }

  return (
    candidate.ignoreVisitId !== undefined &&
    candidate.ignoreVisitId !== null &&
    other.visitId !== undefined &&
    other.visitId !== null &&
    other.visitId === candidate.ignoreVisitId
  );
}

export function detectVisitCollision(
  candidate: VisitCollisionCandidate,
  others: readonly VisitCollisionInterval[]
): VisitCollisionMatch | null {
  const candidateStart = candidate.start.getTime();
  const candidateEnd = candidate.end.getTime();
  if (
    !Number.isFinite(candidateStart) ||
    !Number.isFinite(candidateEnd) ||
    candidateEnd <= candidateStart
  ) {
    return null;
  }

  const patientId = candidate.patientId || null;
  const dentistId = candidate.dentistId || null;
  if (!patientId && !dentistId) {
    return null;
  }

  let patientConflict: VisitCollisionInterval | null = null;
  let dentistConflict: VisitCollisionInterval | null = null;

  for (const other of others) {
    if (isExcludedInterval(candidate, other)) continue;

    const otherStart = parseISO(other.startDate).getTime();
    const otherEnd = parseISO(other.endDate).getTime();
    if (
      !Number.isFinite(otherStart) ||
      !Number.isFinite(otherEnd) ||
      otherEnd <= otherStart
    ) {
      continue;
    }
    if (!intervalsOverlap(candidateStart, candidateEnd, otherStart, otherEnd)) {
      continue;
    }

    if (!patientConflict && patientId && other.patientId === patientId) {
      patientConflict = other;
    }
    if (!dentistConflict && dentistId && other.dentistId === dentistId) {
      dentistConflict = other;
    }
    if (patientConflict && dentistConflict) break;
  }

  if (!patientConflict && !dentistConflict) {
    return null;
  }

  const reason: VisitCollisionReason =
    patientConflict && dentistConflict
      ? 'both'
      : patientConflict
        ? 'patient'
        : 'dentist';

  return { reason, patientConflict, dentistConflict };
}

export const NO_AVAILABLE_SLOT_KEY = 'bigCalendar.collision.noAvailableSlot';

const FIT_VISIT_DURATION_STEPS_MINUTES = [15, 10] as const;

export interface FitVisitDurationCandidate {
  start: Date;
  defaultDurationMinutes: number;
  patientId?: string | null;
  dentistId?: string | null;
}

/**
 * Resolves the visit duration for a click on an empty calendar slot. Tries
 * the surface's default duration first, then progressively shorter fallbacks
 * (15, then 10 minutes) so a click just before an existing appointment books
 * the gap instead of colliding. Returns null when even the 10-minute minimum
 * overlaps a busy interval â€” callers should show the "no available slot"
 * toast (see NO_AVAILABLE_SLOT_KEY) and create nothing.
 */
export function fitVisitDurationMinutes(
  candidate: FitVisitDurationCandidate,
  others: readonly VisitCollisionInterval[]
): number | null {
  const durations = [
    candidate.defaultDurationMinutes,
    ...FIT_VISIT_DURATION_STEPS_MINUTES.filter(
      (minutes) => minutes < candidate.defaultDurationMinutes
    )
  ];

  for (const durationMinutes of durations) {
    const end = addMinutes(candidate.start, durationMinutes);
    const collision = detectVisitCollision(
      {
        start: candidate.start,
        end,
        patientId: candidate.patientId,
        dentistId: candidate.dentistId
      },
      others
    );
    if (!collision) {
      return durationMinutes;
    }
  }

  return null;
}

export interface MovedEventTimes {
  movedStart: Date;
  movedEnd: Date;
  durationMinutes: number;
}

/**
 * Resolves where a dragged event would land after applying the snapped minute
 * delta (and, for the range view, a day offset). Non-positive durations are
 * clamped to zero so the preview never renders inverted.
 */
export function getMovedEventTimes(
  event: Pick<CalendarEvent, 'startDate' | 'endDate'>,
  move: { snappedDeltaMinutes: number; dayOffset?: number }
): MovedEventTimes {
  const eventStart = parseISO(event.startDate);
  const eventEnd = parseISO(event.endDate);
  const durationMinutes = differenceInMinutes(eventEnd, eventStart);
  const movedStart = addMinutes(
    addDays(eventStart, move.dayOffset ?? 0),
    move.snappedDeltaMinutes
  );
  const movedEnd = addMinutes(movedStart, Math.max(durationMinutes, 0));

  return { movedStart, movedEnd, durationMinutes };
}

/**
 * Collision check for a move preview: the moved window against every busy
 * interval, ignoring the dragged event itself. `dentistId` may override the
 * event's own dentist when dragging across doctor columns.
 */
export function detectMovedEventCollision(
  event: Pick<CalendarEvent, 'id' | 'patientId' | 'dentistId' | 'visitId'>,
  times: Pick<MovedEventTimes, 'movedStart' | 'movedEnd'>,
  others: readonly VisitCollisionInterval[],
  dentistId?: string | null
): VisitCollisionMatch | null {
  return detectVisitCollision(
    {
      start: times.movedStart,
      end: times.movedEnd,
      patientId: event.patientId,
      dentistId: dentistId ?? event.dentistId,
      ignoreEventId: event.id,
      ignoreVisitId: event.visitId ?? null
    },
    others
  );
}

export interface ClampMoveDeltaCandidate {
  start: Date;
  end: Date;
  desiredDeltaMinutes: number;
  patientId?: string | null;
  dentistId?: string | null;
  ignoreEventId?: string | number | null;
  ignoreVisitId?: string | null;
}

/**
 * Limits a vertical move so the dragged event cannot be pushed *past* an
 * existing appointment (for the same patient or dentist) into an overlap. The
 * returned delta is clamped to the nearest snap boundary that keeps the moved
 * event flush against â€” but not overlapping â€” the closest blocking appointment
 * in the drag direction. Appointments that already overlap the event are
 * ignored, so an event can still be dragged away from a pre-existing overlap.
 */
export function clampMoveDeltaMinutes(
  candidate: ClampMoveDeltaCandidate,
  others: readonly VisitCollisionInterval[]
): number {
  const desired = candidate.desiredDeltaMinutes;
  if (desired === 0) return 0;

  const start = candidate.start.getTime();
  const end = candidate.end.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return desired;
  }

  const patientId = candidate.patientId || null;
  const dentistId = candidate.dentistId || null;
  if (!patientId && !dentistId) return desired;

  const movingDown = desired > 0;
  let limit = desired;

  for (const other of others) {
    if (isExcludedInterval(candidate, other)) continue;
    const matches =
      (!!patientId && other.patientId === patientId) ||
      (!!dentistId && other.dentistId === dentistId);
    if (!matches) continue;

    const otherStart = parseISO(other.startDate).getTime();
    const otherEnd = parseISO(other.endDate).getTime();
    if (
      !Number.isFinite(otherStart) ||
      !Number.isFinite(otherEnd) ||
      otherEnd <= otherStart
    ) {
      continue;
    }

    if (movingDown) {
      // Only appointments strictly below the event can block a downward move.
      if (otherStart < end) continue;
      const snappedMax =
        Math.floor((otherStart - end) / MS_PER_MINUTE / MINUTES_PER_SNAP) *
        MINUTES_PER_SNAP;
      if (snappedMax < limit) limit = snappedMax;
    } else {
      // Only appointments strictly above the event can block an upward move.
      if (otherEnd > start) continue;
      const snappedMin =
        Math.ceil((otherEnd - start) / MS_PER_MINUTE / MINUTES_PER_SNAP) *
        MINUTES_PER_SNAP;
      if (snappedMin > limit) limit = snappedMin;
    }
  }

  return movingDown ? Math.max(0, limit) : Math.min(0, limit);
}
