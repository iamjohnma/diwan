import type {
  DraggableNode,
  SensorProps,
  TouchSensorOptions
} from '@dnd-kit/core';
import { TouchSensor } from '@dnd-kit/core';
import { CALENDAR_TOUCH_RESIZE_ACTIVATION_DISTANCE_PX } from '@/constants/common/big-calendar';

type CalendarTouchSensorProps = SensorProps<TouchSensorOptions>;

function isResizeHandleDraggable(activeNode: DraggableNode): boolean {
  const type = activeNode.data.current?.type;

  return type === 'resize' || type === 'resize-top';
}

/**
 * A `TouchSensor` that swaps the activation constraint per draggable.
 *
 * The move surface shares its touch with calendar scrolling, so it needs the
 * configured hold delay + tolerance to tell an event drag from a scroll swipe.
 * The top/bottom resize handles have no such ambiguity â€” they sit under
 * `touch-none` with scroll passthrough disabled, so grabbing an edge can only
 * mean "resize". Applying the hold delay to them is what makes edge-drags feel
 * broken: a resize is a drag from the first pixel, so moving before the delay
 * elapses trips the tolerance and dnd-kit silently drops the gesture ("nothing
 * happens"). Giving the handles a small distance constraint instead lets a
 * resize begin on the first few pixels of movement, while a pure tap still
 * falls through to open the appointment popover.
 */
export class CalendarTouchSensor extends TouchSensor {
  constructor(props: CalendarTouchSensorProps) {
    super(
      isResizeHandleDraggable(props.activeNode)
        ? {
            ...props,
            options: {
              ...props.options,
              activationConstraint: {
                distance: CALENDAR_TOUCH_RESIZE_ACTIVATION_DISTANCE_PX
              }
            }
          }
        : props
    );
  }
}
