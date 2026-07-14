import type { CSSProperties, ReactNode, Ref } from 'react';
import {
  CheckCircleIcon,
  ClockCountdownIcon,
  GavelIcon,
  LockIcon
} from '@phosphor-icons/react';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import { EventAppointmentPopover } from '@/components/common/big-calendar/shared/appointment-popover/event-appointment-popover';
import {
  type EventBadgeSurfaceClasses,
  getDoctorColorStyles,
  getEventBadgeIconContainerClass,
  getEventBadgeSurfaceClasses,
  getHighlightColorStyles,
  getIconContainerStyle
} from '@/components/common/big-calendar/shared/month-event-badge/color-utils';
import { cn } from '@/utils/common/cn';

/**
 * Chrome shared by both badge variants (default time-grid badge and the month
 * cell badge): the arrived/late status resolution, the status glyph, the
 * surface colour classes, and the outer interactive shell.
 */

interface EventBadgeChromeOptions {
  event: CalendarEvent;
  doctorColor: string | null;
  isReadOnly: boolean;
  isSelected: boolean;
  enableHoverState: boolean;
  forceHover?: boolean;
  // Classes for the status glyph; the month cell leaves the lock/tooth glyphs
  // at their natural size, so they are configured separately.
  lockToothIconClassName?: string;
  checkClockIconClassName: string;
}

export interface EventBadgeChrome {
  statusIcon: ReactNode;
  surface: EventBadgeSurfaceClasses;
  showDoctorColor: boolean;
  iconContainerClass: string | false;
  iconContainerStyle: CSSProperties | undefined;
  doctorColorStyles: CSSProperties | undefined;
}

export function useEventBadgeChrome(
  options: EventBadgeChromeOptions
): EventBadgeChrome {
  const calendar = useCalendarContext();
  const patientArrived = calendar.getEffectivePatientArrived(options.event);
  const isVisitLate = calendar.getEffectiveVisitLate(options.event);
  const showLateGray = isVisitLate && !patientArrived && !options.isReadOnly;
  const showDoctorColor = !!options.doctorColor && !showLateGray;

  const statusIcon = options.isReadOnly ? (
    <LockIcon
      weight="fill"
      color="white"
      className={options.lockToothIconClassName}
    />
  ) : patientArrived ? (
    <CheckCircleIcon
      weight="fill"
      className={options.checkClockIconClassName}
    />
  ) : isVisitLate ? (
    <ClockCountdownIcon
      weight="fill"
      className={options.checkClockIconClassName}
    />
  ) : (
    <GavelIcon
      weight="fill"
      color="white"
      className={options.lockToothIconClassName}
    />
  );

  return {
    statusIcon,
    surface: getEventBadgeSurfaceClasses({
      showLateGray,
      showDoctorColor,
      isSelected: options.isSelected,
      enableHoverState: options.enableHoverState,
      forceHover: options.forceHover
    }),
    showDoctorColor,
    iconContainerClass: getEventBadgeIconContainerClass({
      showLateGray,
      showDoctorColor
    }),
    iconContainerStyle: showDoctorColor
      ? getIconContainerStyle(options.doctorColor)
      : undefined,
    doctorColorStyles: showDoctorColor
      ? getDoctorColorStyles(options.doctorColor)
      : undefined
  };
}

interface EventBadgeShellProps {
  event: CalendarEvent;
  chrome: EventBadgeChrome;
  isDragging: boolean;
  isPressable: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  // The visit's dentist color: the highlight glow always uses it (in every
  // view and even on gray late badges) so a deep-linked visit lights up in its
  // own color rather than the primary accent. Null falls back to currentColor.
  highlightColor?: string | null;
  showFocusRing: boolean;
  // Variant-specific spacing/typography classes layered over the shared shell.
  className?: string;
  externalClassName?: string;
  style?: CSSProperties;
  badgeRef?: Ref<HTMLDivElement>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseDownCapture?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

/** Outer interactive surface shared by both badge variants. */
export function EventBadgeShell(props: EventBadgeShellProps) {
  const highlightColorStyles =
    props.isHighlighted && props.highlightColor
      ? getHighlightColorStyles(props.highlightColor)
      : undefined;

  return (
    <EventAppointmentPopover event={props.event} isDragging={props.isDragging}>
      <div
        ref={props.badgeRef}
        role={props.isPressable ? 'button' : undefined}
        tabIndex={props.isPressable ? 0 : undefined}
        className={cn(
          'group/badge relative mx-1 flex h-full select-none rounded-md transition',
          props.isPressable && 'cursor-pointer',
          props.className,
          props.chrome.surface.tone,
          props.chrome.surface.fill,
          props.chrome.surface.hover,
          props.isSelected && 'opacity-65',
          props.isHighlighted &&
            (highlightColorStyles
              ? 'ring-2 transition-colors duration-300'
              : '!bg-current/15 ring-2 ring-current/35 transition-colors duration-300'),
          'focus:outline-none focus-visible:outline-none',
          props.showFocusRing && 'focus-visible:ring-1 focus-visible:ring-ring',
          props.externalClassName
        )}
        style={{
          ...props.style,
          ...props.chrome.doctorColorStyles,
          ...highlightColorStyles
        }}
        onKeyDown={props.onKeyDown}
        onClick={props.onClick}
        onMouseDownCapture={props.onMouseDownCapture}
      >
        {props.children}
      </div>
    </EventAppointmentPopover>
  );
}
