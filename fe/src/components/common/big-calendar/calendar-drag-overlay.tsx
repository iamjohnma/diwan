import { DragOverlay } from '@dnd-kit/core';
import { motion } from 'motion/react';
import { useCalendarDragState } from '@/components/common/big-calendar/calendar-context';
import { MonthEventBadge } from '@/components/common/big-calendar/shared/month-event-badge';
import {
  CALENDAR_TOUCH_HOLD_MOTION_TRANSITION,
  CALENDAR_TOUCH_HOLD_ROTATE_DEG,
  DRAG_OVERLAY_Z_INDEX,
  MIN_BADGE_HEIGHT_PX
} from '@/constants/common/big-calendar';
import { useTouchScreen } from '@/hooks/common/touch-screen';

export function CalendarDragOverlay() {
  const { dragOverlay } = useCalendarDragState();
  const touchScreen = useTouchScreen();
  const touchHoldRotate = touchScreen.hasTouchCapability
    ? CALENDAR_TOUCH_HOLD_ROTATE_DEG
    : 0;
  const overlayWidth = dragOverlay
    ? (dragOverlay.previewWidth ?? dragOverlay.baseWidth)
    : 0;
  const overlayHeight = dragOverlay
    ? Math.max(
        dragOverlay.previewHeight ?? dragOverlay.baseHeight,
        MIN_BADGE_HEIGHT_PX
      )
    : MIN_BADGE_HEIGHT_PX;

  return (
    <DragOverlay dropAnimation={null} zIndex={DRAG_OVERLAY_Z_INDEX}>
      {dragOverlay ? (
        <motion.div
          className="origin-center rounded-md"
          style={{
            width: overlayWidth > 0 ? overlayWidth : undefined,
            height: overlayHeight,
            minHeight: MIN_BADGE_HEIGHT_PX
          }}
          initial={{ rotate: 0 }}
          animate={{ rotate: touchHoldRotate }}
          transition={CALENDAR_TOUCH_HOLD_MOTION_TRANSITION}
        >
          <MonthEventBadge
            event={dragOverlay.event}
            displayTitle={dragOverlay.event.patientName}
            isDragging
            layoutSize={{ height: overlayHeight, width: overlayWidth }}
          />
        </motion.div>
      ) : null}
    </DragOverlay>
  );
}
