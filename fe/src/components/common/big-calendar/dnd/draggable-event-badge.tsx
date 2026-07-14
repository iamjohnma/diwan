import type { CSSProperties, ReactNode, RefObject } from 'react';
import { memo, useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import { parsePixelLength } from '@/components/common/big-calendar/dnd/draggable-event-badge/pixel-utils';
import {
  CALENDAR_EVENT_RESIZE_HANDLE_ATTR,
  isCalendarEventResizeHandleTarget
} from '@/components/common/big-calendar/dnd/draggable-event-badge/resize-handle-utils';
import { useTouchScrollPassthrough } from '@/components/common/big-calendar/dnd/draggable-event-badge/use-touch-scroll-passthrough';
import { EventAppointmentPopover } from '@/components/common/big-calendar/shared/appointment-popover/event-appointment-popover';
import { MonthEventBadge } from '@/components/common/big-calendar/shared/month-event-badge';
import type { BadgeLayoutSize } from '@/components/common/big-calendar/shared/month-event-badge/badge-layout-utils';
import {
  CALENDAR_TOUCH_HOLD_MOTION_TRANSITION,
  CALENDAR_TOUCH_HOLD_ROTATE_DEG,
  MIN_BADGE_HEIGHT_PX
} from '@/constants/common/big-calendar';
import { useEventBadgeDoubleTap } from '@/hooks/common/big-calendar/use-event-badge-double-tap';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useTouchScreen } from '@/hooks/common/touch-screen';
import { cn } from '@/utils/common/cn';

export { MIN_BADGE_HEIGHT_PX } from '@/constants/common/big-calendar';

const MAX_RESIZE_HANDLE_HEIGHT_PX = 12;
const MIN_RESIZE_HANDLE_HEIGHT_PX = 4;
const MAX_TOUCH_RESIZE_HANDLE_HEIGHT_PX = 22;
const MIN_TOUCH_RESIZE_HANDLE_HEIGHT_PX = 14;
const MIN_DRAG_CENTER_ZONE_HEIGHT_PX = 16;

interface MoveDragSurfaceProps {
  event: CalendarEvent;
  dragInstanceId: string;
  disabled: boolean;
  nodeRef: RefObject<HTMLDivElement | null>;
  className: string;
  children: ReactNode;
}

interface ResizeDragHandleProps {
  event: CalendarEvent;
  dragInstanceId: string;
  disabled: boolean;
  type: 'resize' | 'resize-top';
  handlePosition: 'top' | 'bottom';
  className: string;
  height: string;
}

export interface DraggableEventBadgeProps {
  event: CalendarEvent;
  dragInstanceId?: string;
  style?: CSSProperties;
  layoutSize?: BadgeLayoutSize | null;
  displayStartDate?: string;
  displayEndDate?: string;
  isResizing?: boolean;
  resizeDeltaMinutes?: number;
  isResizingTop?: boolean;
  resizeTopDeltaMinutes?: number;
  disableDragDrop?: boolean;
  isMoving?: boolean;
  showResizeTopHandle?: boolean;
  showResizeBottomHandle?: boolean;
  onIdleInteractionEnd?: () => void;
  onActiveInteraction?: () => void;
}

function areLayoutSizesEqual(
  previous: BadgeLayoutSize | null | undefined,
  next: BadgeLayoutSize | null | undefined
) {
  return (
    (previous?.height ?? 0) === (next?.height ?? 0) &&
    (previous?.width ?? 0) === (next?.width ?? 0)
  );
}

/**
 * Compares every data prop shared by the static and draggable badge variants.
 * Callback props are compared separately by each memo wrapper.
 */
export function areEventBadgeCorePropsEqual(
  previous: DraggableEventBadgeProps,
  next: DraggableEventBadgeProps
) {
  return (
    previous.event === next.event &&
    previous.style === next.style &&
    areLayoutSizesEqual(previous.layoutSize, next.layoutSize) &&
    (previous.displayStartDate ?? '') === (next.displayStartDate ?? '') &&
    (previous.displayEndDate ?? '') === (next.displayEndDate ?? '') &&
    !!previous.isResizing === !!next.isResizing &&
    (previous.resizeDeltaMinutes ?? 0) === (next.resizeDeltaMinutes ?? 0) &&
    !!previous.isResizingTop === !!next.isResizingTop &&
    (previous.resizeTopDeltaMinutes ?? 0) ===
      (next.resizeTopDeltaMinutes ?? 0) &&
    !!previous.disableDragDrop === !!next.disableDragDrop &&
    !!previous.isMoving === !!next.isMoving &&
    (previous.dragInstanceId ?? '') === (next.dragInstanceId ?? '') &&
    !!previous.showResizeTopHandle === !!next.showResizeTopHandle &&
    !!previous.showResizeBottomHandle === !!next.showResizeBottomHandle
  );
}

function areDraggableEventBadgePropsEqual(
  previous: DraggableEventBadgeProps,
  next: DraggableEventBadgeProps
) {
  return (
    areEventBadgeCorePropsEqual(previous, next) &&
    previous.onIdleInteractionEnd === next.onIdleInteractionEnd &&
    previous.onActiveInteraction === next.onActiveInteraction
  );
}

const MoveDragSurface = memo(function MoveDragSurface(
  props: MoveDragSurfaceProps
) {
  const {
    attributes: moveAttributes,
    listeners: moveListeners,
    setNodeRef: setMoveNodeRef
  } = useDraggable({
    id: `event-move-${props.dragInstanceId}`,
    disabled: props.disabled,
    data: {
      event: props.event,
      type: 'move',
      getHeight: () => props.nodeRef.current?.offsetHeight ?? 0
    }
  });

  return (
    <div
      ref={setMoveNodeRef}
      className={props.className}
      {...moveListeners}
      {...moveAttributes}
    >
      {props.children}
    </div>
  );
});

const ResizeDragHandle = memo(function ResizeDragHandle(
  props: ResizeDragHandleProps
) {
  const {
    attributes: resizeAttributes,
    listeners: resizeListeners,
    setNodeRef: setResizeNodeRef
  } = useDraggable({
    id: `event-${props.type}-${props.dragInstanceId}`,
    disabled: props.disabled,
    data: { event: props.event, type: props.type }
  });

  return (
    <div
      ref={setResizeNodeRef}
      {...{ [CALENDAR_EVENT_RESIZE_HANDLE_ATTR]: props.handlePosition }}
      className={props.className}
      style={{ height: props.height }}
      {...resizeListeners}
      {...resizeAttributes}
    />
  );
});

export const DraggableEventBadge = memo(function DraggableEventBadge(
  props: DraggableEventBadgeProps
) {
  const nodeRef = useRef<HTMLDivElement>(null);
  // This badge only mounts (upgrading from its static placeholder) because the
  // pointer is already over it, so it starts "inside". Owning the hover state
  // here â€” instead of leaning on CSS `:hover` â€” lets the freshly-swapped badge
  // paint in its hover style on the first frame. Otherwise the browser
  // re-evaluates `:hover` a frame late under the stationary cursor and the
  // badge's `transition` animates a visible hoverâ†’unhoverâ†’hover flicker.
  const [isPointerInside, setIsPointerInside] = useState(true);
  const disableDragDrop = props.disableDragDrop ?? false;
  const isReadOnly = props.event.isReadOnly ?? false;
  const isPendingCreate = props.event.isPendingCreate ?? false;
  const isDragLocked = isReadOnly && !isPendingCreate;
  const canDrag = !disableDragDrop && !isDragLocked;
  const dragInstanceId = props.dragInstanceId ?? String(props.event.id);
  const showResizeTopHandle = props.showResizeTopHandle ?? true;
  const showResizeBottomHandle = props.showResizeBottomHandle ?? true;

  const touchScreen = useTouchScreen();
  const { isMobile } = useBreakpoint();
  const useTouchResizeStrips = isMobile || touchScreen.hasTouchCapability;

  const touchHandlers = useTouchScrollPassthrough(
    nodeRef,
    canDrag,
    !!props.isMoving,
    { shouldIgnoreTouch: isCalendarEventResizeHandleTarget }
  );

  const isTouchHoldFeedback =
    touchScreen.hasTouchCapability && touchHandlers.isTouchHoldFeedback;
  const badgeTap = useEventBadgeDoubleTap(props.event);

  const isAnyDragActive =
    !!props.isMoving || !!props.isResizing || !!props.isResizingTop;

  useEffect(() => {
    if (isAnyDragActive) {
      badgeTap.cancelPendingPress();
    }
  }, [isAnyDragActive, badgeTap.cancelPendingPress]);

  const isMoving = !!props.isMoving;
  const isBeingResized = !!props.isResizing;
  const isBeingResizedTop = !!props.isResizingTop;
  const resolvedMinHeightPx = Math.max(
    MIN_BADGE_HEIGHT_PX,
    parsePixelLength(props.style?.minHeight) ?? MIN_BADGE_HEIGHT_PX
  );

  const style: CSSProperties = {
    ...props.style,
    minHeight: `${resolvedMinHeightPx}px`
  };

  const hasDisplayDatePreview =
    props.displayStartDate !== undefined || props.displayEndDate !== undefined;
  const previewResizeDeltaMinutes =
    isBeingResized && !hasDisplayDatePreview
      ? props.resizeDeltaMinutes
      : undefined;
  const previewResizeTopDeltaMinutes =
    isBeingResizedTop && !hasDisplayDatePreview
      ? props.resizeTopDeltaMinutes
      : undefined;
  const minResizeHandleHeightPx = useTouchResizeStrips
    ? MIN_TOUCH_RESIZE_HANDLE_HEIGHT_PX
    : MIN_RESIZE_HANDLE_HEIGHT_PX;
  const maxResizeHandleHeightPx = useTouchResizeStrips
    ? MAX_TOUCH_RESIZE_HANDLE_HEIGHT_PX
    : MAX_RESIZE_HANDLE_HEIGHT_PX;
  const resizeHandleHeight = `clamp(${minResizeHandleHeightPx}px, calc((100% - ${MIN_DRAG_CENTER_ZONE_HEIGHT_PX}px) / 2), ${maxResizeHandleHeightPx}px)`;
  const resizeHandlePointerClass = useTouchResizeStrips
    ? 'pointer-events-auto'
    : 'pointer-events-none group-hover:pointer-events-auto';
  const topResizeHandleEndClass = useTouchResizeStrips ? 'end-0' : 'end-28';

  // Force the hover background while the pointer is over the badge and no drag
  // is in progress (during a drag/resize the pointer sits on a handle, which is
  // outside the badge surface, so hover should stay off â€” matching CSS).
  const showHoverState = isPointerInside && !isAnyDragActive;

  const handlePointerEnter = () => {
    setIsPointerInside(true);
    // Returning within the idle window cancels the pending downgrade, so we
    // never swap back to the static badge while the cursor is still on it.
    props.onActiveInteraction?.();
  };

  const handlePointerLeave = () => {
    setIsPointerInside(false);
    if (!isAnyDragActive) props.onIdleInteractionEnd?.();
  };

  return (
    <EventAppointmentPopover event={props.event} isDragging={isMoving}>
      <div
        ref={nodeRef}
        data-calendar-pan-skip
        className={cn(
          'group group/badge relative h-full min-h-0',
          canDrag && 'touch-none',
          !canDrag && badgeTap.isEnabled && 'touch-manipulation'
        )}
        style={{
          ...style,
          visibility: isMoving ? 'hidden' : 'visible',
          opacity: isMoving ? 0 : 1
        }}
        onClickCapture={badgeTap.handleClickCapture}
        onTouchStart={touchHandlers.handleTouchStart}
        onTouchMove={touchHandlers.handleTouchMove}
        onTouchEnd={touchHandlers.handleTouchEnd}
        onTouchCancel={touchHandlers.handleTouchEnd}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {canDrag && showResizeTopHandle && (
          <ResizeDragHandle
            event={props.event}
            dragInstanceId={dragInstanceId}
            disabled={!canDrag}
            type="resize-top"
            handlePosition="top"
            className={cn(
              'absolute start-0 top-0 z-20 cursor-row-resize touch-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
              topResizeHandleEndClass,
              resizeHandlePointerClass
            )}
            height={resizeHandleHeight}
          />
        )}
        <MoveDragSurface
          event={props.event}
          dragInstanceId={dragInstanceId}
          disabled={!canDrag}
          nodeRef={nodeRef}
          className={cn(
            'h-full min-h-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
            !canDrag
              ? isDragLocked
                ? 'cursor-default'
                : 'cursor-pointer'
              : 'cursor-grab active:cursor-grabbing',
            isMoving && 'cursor-grabbing'
          )}
        >
          {touchScreen.hasTouchCapability ? (
            <motion.div
              className="h-full min-h-0 origin-center"
              animate={{
                rotate: isTouchHoldFeedback ? CALENDAR_TOUCH_HOLD_ROTATE_DEG : 0
              }}
              transition={CALENDAR_TOUCH_HOLD_MOTION_TRANSITION}
            >
              <MonthEventBadge
                event={props.event}
                displayTitle={props.event.patientName}
                displayStartDate={props.displayStartDate}
                displayEndDate={props.displayEndDate}
                enableHoverState={false}
                showFocusRing={false}
                isDragging={isMoving}
                previewResizeDeltaMinutes={previewResizeDeltaMinutes}
                previewResizeTopDeltaMinutes={previewResizeTopDeltaMinutes}
                layoutSize={props.layoutSize}
              />
            </motion.div>
          ) : (
            <MonthEventBadge
              event={props.event}
              displayTitle={props.event.patientName}
              displayStartDate={props.displayStartDate}
              displayEndDate={props.displayEndDate}
              enableHoverState
              isHovered={showHoverState}
              showFocusRing={false}
              isDragging={isMoving}
              previewResizeDeltaMinutes={previewResizeDeltaMinutes}
              previewResizeTopDeltaMinutes={previewResizeTopDeltaMinutes}
              layoutSize={props.layoutSize}
            />
          )}
        </MoveDragSurface>
        {canDrag && showResizeBottomHandle && (
          <ResizeDragHandle
            event={props.event}
            dragInstanceId={dragInstanceId}
            disabled={!canDrag}
            type="resize"
            handlePosition="bottom"
            className={cn(
              'absolute inset-x-0 bottom-0 z-20 cursor-row-resize touch-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
              resizeHandlePointerClass
            )}
            height={resizeHandleHeight}
          />
        )}
      </div>
    </EventAppointmentPopover>
  );
}, areDraggableEventBadgePropsEqual);
