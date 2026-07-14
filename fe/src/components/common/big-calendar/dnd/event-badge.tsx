import type { CSSProperties } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import {
  DraggableEventBadge,
  type DraggableEventBadgeProps,
  areEventBadgeCorePropsEqual
} from '@/components/common/big-calendar/dnd/draggable-event-badge';
import { parsePixelLength } from '@/components/common/big-calendar/dnd/draggable-event-badge/pixel-utils';
import { EventAppointmentPopover } from '@/components/common/big-calendar/shared/appointment-popover/event-appointment-popover';
import { MonthEventBadge } from '@/components/common/big-calendar/shared/month-event-badge';
import { MIN_BADGE_HEIGHT_PX } from '@/constants/common/big-calendar';
import { useEventBadgeDoubleTap } from '@/hooks/common/big-calendar/use-event-badge-double-tap';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import { cn } from '@/utils/common/cn';

const DRAGGABLE_BADGE_IDLE_DOWNGRADE_MS = 500;

interface StaticEventBadgeProps extends DraggableEventBadgeProps {
  onUpgradeInteraction?: () => void;
}

function areStaticEventBadgePropsEqual(
  previous: StaticEventBadgeProps,
  next: StaticEventBadgeProps
) {
  return (
    areEventBadgeCorePropsEqual(previous, next) &&
    previous.onUpgradeInteraction === next.onUpgradeInteraction
  );
}

function shouldStayStatic(props: DraggableEventBadgeProps): boolean {
  const disableDragDrop = props.disableDragDrop ?? false;
  const isReadOnly = props.event.isReadOnly ?? false;
  const isPendingCreate = props.event.isPendingCreate ?? false;

  return disableDragDrop || (isReadOnly && !isPendingCreate);
}

function shouldForceUpgrade(props: DraggableEventBadgeProps): boolean {
  return !!props.isMoving || !!props.isResizing || !!props.isResizingTop;
}

const StaticEventBadge = memo(function StaticEventBadge(
  props: StaticEventBadgeProps
) {
  const touchScreen = useTouchScreen();
  const disableDragDrop = props.disableDragDrop ?? false;
  const isReadOnly = props.event.isReadOnly ?? false;
  const isPendingCreate = props.event.isPendingCreate ?? false;
  const isDragLocked = isReadOnly && !isPendingCreate;
  const canDrag = !disableDragDrop && !isDragLocked;
  const resolvedMinHeightPx = Math.max(
    MIN_BADGE_HEIGHT_PX,
    parsePixelLength(props.style?.minHeight) ?? MIN_BADGE_HEIGHT_PX
  );
  const style: CSSProperties = {
    ...props.style,
    minHeight: `${resolvedMinHeightPx}px`
  };

  const handleUpgradeInteraction = useCallback(() => {
    props.onUpgradeInteraction?.();
  }, [props.onUpgradeInteraction]);

  // A press fires pointerdown first, immediately followed by the dnd-kit sensor
  // pointerdown reliably precedes both mousedown and touchstart, so flushing the
  const handlePressUpgrade = useCallback(() => {
    if (!props.onUpgradeInteraction) return;
    flushSync(() => {
      props.onUpgradeInteraction?.();
    });
  }, [props.onUpgradeInteraction]);

  const upgradeHandler = props.onUpgradeInteraction
    ? handleUpgradeInteraction
    : undefined;
  const pressUpgradeHandler = props.onUpgradeInteraction
    ? handlePressUpgrade
    : undefined;

  // Hovering (or focusing) a badge prefetches the visit's patient-detail data,
  // including its dentist, so the click that follows opens instantly. This runs
  // alongside the staticâ†’draggable upgrade that the same hover already triggers.
  const calendar = useCalendarContext();
  const onEventHoverIntent = calendar.onEventHoverIntent;
  const handleHoverInteraction = useCallback(() => {
    onEventHoverIntent?.(props.event);
    upgradeHandler?.();
  }, [onEventHoverIntent, props.event, upgradeHandler]);

  const badgeTap = useEventBadgeDoubleTap(props.event);
  const isPermanentlyStatic = !props.onUpgradeInteraction;

  return (
    <EventAppointmentPopover event={props.event} isDragging={false}>
      <div
        data-calendar-pan-skip
        className={cn(
          'group group/badge relative h-full min-h-0',
          canDrag && 'touch-none',
          isPermanentlyStatic && badgeTap.isEnabled && 'touch-manipulation'
        )}
        style={style}
        onClickCapture={
          isPermanentlyStatic ? badgeTap.handleClickCapture : undefined
        }
        onPointerEnter={handleHoverInteraction}
        onFocus={handleHoverInteraction}
        onPointerDown={pressUpgradeHandler}
        onTouchStart={pressUpgradeHandler}
      >
        <div
          className={cn(
            'h-full min-h-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
            isDragLocked
              ? 'cursor-default'
              : disableDragDrop
                ? 'cursor-pointer'
                : 'cursor-grab active:cursor-grabbing'
          )}
        >
          <MonthEventBadge
            event={props.event}
            displayTitle={props.event.patientName}
            displayStartDate={props.displayStartDate}
            displayEndDate={props.displayEndDate}
            enableHoverState={!touchScreen.hasTouchCapability}
            showFocusRing={false}
            isDragging={false}
          />
        </div>
      </div>
    </EventAppointmentPopover>
  );
}, areStaticEventBadgePropsEqual);

export const EventBadge = memo(function EventBadge(
  props: DraggableEventBadgeProps
) {
  const touchScreen = useTouchScreen();
  const stayStatic = shouldStayStatic(props);
  const forceUpgrade = shouldForceUpgrade(props);
  // Touch devices never get a hover pass to upgrade before the first finger
  // lands, so a static badge has no resize handles when touchstart fires.
  // Upgrading mid-gesture leaves dnd-kit without an activator â€” hold feedback
  // (rotate/vibrate) can show while resize/move never starts. Keep draggable
  // badges mounted whenever touch input is possible.
  const alwaysDraggableOnTouch = touchScreen.hasTouchCapability && !stayStatic;
  const [isUpgraded, setIsUpgraded] = useState(false);
  const downgradeTimerRef = useRef<number | null>(null);

  const clearDowngradeTimer = useCallback(() => {
    if (downgradeTimerRef.current === null) return;

    window.clearTimeout(downgradeTimerRef.current);
    downgradeTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (!stayStatic && forceUpgrade) {
      clearDowngradeTimer();
      setIsUpgraded(true);
    }
  }, [clearDowngradeTimer, forceUpgrade, stayStatic]);

  useEffect(() => clearDowngradeTimer, [clearDowngradeTimer]);

  const handleUpgradeInteraction = useCallback(() => {
    clearDowngradeTimer();
    setIsUpgraded(true);
  }, [clearDowngradeTimer]);

  const handleIdleInteractionEnd = useCallback(() => {
    if (forceUpgrade) return;

    clearDowngradeTimer();
    downgradeTimerRef.current = window.setTimeout(() => {
      downgradeTimerRef.current = null;
      setIsUpgraded(false);
    }, DRAGGABLE_BADGE_IDLE_DOWNGRADE_MS);
  }, [clearDowngradeTimer, forceUpgrade]);

  if (stayStatic) {
    return <StaticEventBadge {...props} />;
  }

  if (isUpgraded || forceUpgrade || alwaysDraggableOnTouch) {
    return (
      <DraggableEventBadge
        {...props}
        onIdleInteractionEnd={handleIdleInteractionEnd}
        onActiveInteraction={handleUpgradeInteraction}
      />
    );
  }

  return (
    <StaticEventBadge
      {...props}
      onUpgradeInteraction={handleUpgradeInteraction}
    />
  );
}, areEventBadgeCorePropsEqual);
