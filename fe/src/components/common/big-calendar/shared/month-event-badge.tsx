import { type CSSProperties, memo, useMemo, useRef } from 'react';
import { addMinutes, parseISO } from 'date-fns';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import type { MonthEventBadgeVariant } from '@/@types/common/components/big-calendar/shared/month-event-badge';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import { DefaultEventBadge } from '@/components/common/big-calendar/shared/month-event-badge/default-event-badge';
import { MonthCellBadge } from '@/components/common/big-calendar/shared/month-event-badge/month-cell-badge';
import { useTranslation } from 'react-i18next';
import { formatTimeInTimeZone } from '@/utils/common/time-zone';

interface MonthEventBadgeProps {
  event: CalendarEvent;
  variant?: MonthEventBadgeVariant;
  className?: string;
  style?: CSSProperties;
  enableHoverState?: boolean;
  isHovered?: boolean;
  showFocusRing?: boolean;
  displayTitle?: string | null;
  displayStartDate?: string;
  displayEndDate?: string;
  previewResizeDeltaMinutes?: number;
  previewResizeTopDeltaMinutes?: number;
  layoutSize?: { height: number; width: number } | null;
  isDragging?: boolean;
}

export const MonthEventBadge = memo(function MonthEventBadge(
  props: MonthEventBadgeProps
) {
  const { t, i18n } = useTranslation();
  const calendar = useCalendarContext();
  const variant = props.variant ?? 'default';
  const showFocusRing = props.showFocusRing ?? true;
  const enableHoverState = props.enableHoverState ?? true;
  const isDragging = props.isDragging ?? false;
  const locale = i18n.language === 'ar' ? 'ar-PS-u-nu-latn' : 'en-US';
  const originalStart = parseISO(
    props.displayStartDate ?? props.event.startDate
  );
  const originalEnd = parseISO(props.displayEndDate ?? props.event.endDate);

  const previewResizeDelta = props.previewResizeDeltaMinutes ?? 0;
  const previewResizeTopDelta = props.previewResizeTopDeltaMinutes ?? 0;

  const start =
    previewResizeTopDelta !== 0
      ? addMinutes(originalStart, previewResizeTopDelta)
      : originalStart;
  const end =
    previewResizeDelta !== 0
      ? addMinutes(originalEnd, previewResizeDelta)
      : originalEnd;

  const isSelected = calendar.isEventSelected(props.event.id);
  const isHighlighted = calendar.isEventHighlighted(props.event.id);
  const isReadOnly = props.event.isReadOnly ?? false;
  // The badge only navigates where the calendar wires up a press handler (the
  // reservations page). On the patient page there is no `onEventPress`, so the
  // badge stays inert on click â€” tapping it would just reopen the page we're
  // already on. Multi-select modifiers and drag still work in both places.
  const isPressable = !!calendar.onEventPress;

  // The dentist's own color, resolved independently of the active view: the
  // badge surface only wears it in the doctor view, but the deep-link
  // highlight glow uses it everywhere (month view included, and even when a
  // late visit renders gray) instead of the primary accent.
  const dentistColor = useMemo(() => {
    if (!props.event.dentistId) return null;
    const doctor = calendar.doctors.find((d) => d.id === props.event.dentistId);

    return doctor?.color ?? null;
  }, [calendar.doctors, props.event.dentistId]);
  const showDentistInRange =
    calendar.view === 'range' && calendar.showDentistNameInRangeEvents;
  const doctorColor =
    calendar.view === 'doctor' || showDentistInRange ? dentistColor : null;

  const startLabel = formatTimeInTimeZone(start, calendar.timeZone, locale);
  const endLabel = formatTimeInTimeZone(end, calendar.timeZone, locale);
  const timeLabel = `${startLabel} - ${endLabel}`;
  const compactTimeLabel = `${startLabel}-${endLabel}`;

  const patientTitle =
    props.displayTitle?.trim() ||
    props.event.title?.trim() ||
    t('bigCalendar.untitledVisit');
  const dentistName = showDentistInRange ? props.event.user.name.trim() : '';
  const baseTitle = dentistName
    ? `${patientTitle} · ${dentistName}`
    : patientTitle;
  const visitType = props.event.visitType?.trim();
  const displayTitle = visitType ? `${baseTitle} - ${visitType}` : baseTitle;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isPressable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      calendar.onEventPress?.(props.event);
    }
  };

  // Set on pointer-down when a multi-select modifier handled the press, so the
  // follow-up click neither navigates nor re-toggles the selection.
  const modifierSelectionHandledRef = useRef(false);

  const applyModifierSelection = (event: {
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
  }) => {
    // Shift extends a contiguous range from the anchor (Windows Explorer
    // style); Ctrl/Cmd toggles an individual visit in/out of the selection.
    if (event.shiftKey) {
      calendar.selectEventRange(props.event);
    } else {
      calendar.toggleEventSelection(props.event);
    }
  };

  // Selection is handled on mouse-down (capture phase) rather than click so it
  // lands before dnd-kit's MouseSensor can start a drag â€” in the doctor/range
  // views the badge is wrapped in drag listeners, and a modifier-click that
  // jiggled a few pixels would otherwise become a drag and never fire a usable
  // click. Capturing mousedown (not pointerdown) is required because the
  // configured sensor activates on `mousedown`.
  const handleMouseDownCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const hasSelectionModifier =
      event.shiftKey || event.ctrlKey || event.metaKey;

    if (!hasSelectionModifier || props.event.isReadOnly) {
      modifierSelectionHandledRef.current = false;

      return;
    }

    // Stop the event before dnd-kit's MouseSensor sees it, so holding a
    // modifier selects instead of dragging.
    event.stopPropagation();
    event.preventDefault();
    modifierSelectionHandledRef.current = true;
    applyModifierSelection(event);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    // Pointer-down already performed the modifier selection for this gesture.
    if (modifierSelectionHandledRef.current) {
      modifierSelectionHandledRef.current = false;

      return;
    }

    const hasSelectionModifier =
      event.shiftKey || event.ctrlKey || event.metaKey;

    if (hasSelectionModifier) {
      // Fallback for environments without the pointer-down path (e.g. keyboard
      // -synthesized clicks). Read-only visits can't be selected.
      if (props.event.isReadOnly) return;
      event.preventDefault();
      applyModifierSelection(event);

      return;
    }

    // No press handler wired (e.g. the patient page) â†’ the badge is not
    // clickable; leave any existing selection untouched and do nothing.
    if (!isPressable) return;

    calendar.clearSelectedEvents();
    calendar.onEventPress?.(props.event);
  };

  if (variant === 'month-cell') {
    return (
      <MonthCellBadge
        event={props.event}
        displayTitle={displayTitle}
        timeLabel={timeLabel}
        doctorColor={doctorColor}
        isReadOnly={isReadOnly}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        highlightColor={dentistColor}
        showFocusRing={showFocusRing}
        enableHoverState={enableHoverState}
        isPressable={isPressable}
        isDragging={isDragging}
        className={props.className}
        style={props.style}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onMouseDownCapture={handleMouseDownCapture}
      />
    );
  }

  return (
    <DefaultEventBadge
      event={props.event}
      displayTitle={displayTitle}
      timeLabel={timeLabel}
      compactTimeLabel={compactTimeLabel}
      doctorColor={doctorColor}
      isReadOnly={isReadOnly}
      isSelected={isSelected}
      isHighlighted={isHighlighted}
      highlightColor={dentistColor}
      showFocusRing={showFocusRing}
      enableHoverState={enableHoverState}
      isHovered={props.isHovered}
      isPressable={isPressable}
      isDragging={isDragging}
      layoutSize={props.layoutSize}
      className={props.className}
      style={props.style}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onMouseDownCapture={handleMouseDownCapture}
    />
  );
});
