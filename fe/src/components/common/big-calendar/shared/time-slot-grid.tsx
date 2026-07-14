import { memo, useCallback, useMemo } from 'react';
import { addMinutes, parseISO } from 'date-fns';
import type {
  CalendarDragType,
  CalendarEvent
} from '@/@types/common/big-calendar';
import {
  getPersistedDragToCreatePreviewStyle,
  useDragToCreate
} from '@/hooks/common/drag-to-create';
import { usePendingVisitCreateStore } from '@/stores/pending-visit-create';
import {
  CLICK_SLOTS_PER_HOUR,
  CLICK_SLOT_MINUTES,
  DEFAULT_PIXELS_PER_HOUR
} from '@/utils/common/big-calendar';
import { cn } from '@/utils/common/cn';

interface TimeSlotGridProps {
  hours: number[];
  firstHour: number;
  pixelsPerHour: number;
  canCreate: boolean;
  dayKey: string;
  timeZone?: string;
  doctorId?: string;
  isHourOffHours: (hour: number) => boolean;
  offHoursClassName?: string;
  onClick: (hour: number, minute: number) => void;
  onRangeSelect?: (startMinute: number, endMinute: number) => void;
  checkRangeCollision?: (startMinute: number, endMinute: number) => boolean;
}

export const TimeSlotGrid = memo(function TimeSlotGrid(
  props: TimeSlotGridProps
) {
  const showHalfHourDivider =
    props.pixelsPerHour > DEFAULT_PIXELS_PER_HOUR * 0.3;

  const handleClick = useCallback(
    (hour: number, minute: number) => {
      if (!props.canCreate) return;
      props.onClick(hour, minute);
    },
    [props.canCreate, props.onClick]
  );

  const handleRangeSelect = useCallback(
    (startMinute: number, endMinute: number) => {
      props.onRangeSelect?.(startMinute, endMinute);
    },
    [props.onRangeSelect]
  );

  const {
    containerRef,
    previewRef,
    handlePointerDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchCancel,
    handleSlotClick
  } = useDragToCreate({
    canCreate: props.canCreate && !!props.onRangeSelect,
    firstHour: props.firstHour,
    pixelsPerHour: props.pixelsPerHour,
    onRangeSelect: handleRangeSelect,
    onClick: handleClick,
    checkCollision: props.checkRangeCollision
  });

  const persistedPreviewStyleKey = usePendingVisitCreateStore((state) => {
    const style = getPersistedDragToCreatePreviewStyle({
      selection: state.selection,
      dayKey: props.dayKey,
      firstHour: props.firstHour,
      pixelsPerHour: props.pixelsPerHour,
      timeZone: props.timeZone,
      doctorId: props.doctorId
    });

    return style ? `${style.top}|${style.height}` : null;
  });

  const persistedPreviewStyle = useMemo(() => {
    if (!persistedPreviewStyleKey) return null;
    const [top, height] = persistedPreviewStyleKey.split('|');
    if (!top || !height) return null;

    return { top, height };
  }, [persistedPreviewStyleKey]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 [&[data-drag-to-create-active=true]_[data-drag-to-create-persisted-preview]]:hidden"
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchCancel}
    >
      {props.hours.map((hour, hourIndex) => {
        const isOffHours = props.isHourOffHours(hour);

        return (
          <div
            key={hour}
            className={cn(
              'absolute inset-x-0',
              isOffHours && cn('bg-muted/50', props.offHoursClassName)
            )}
            style={{
              height: `${props.pixelsPerHour}px`,
              transform: `translateY(${hourIndex * props.pixelsPerHour}px)`
            }}
          >
            {hourIndex !== 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-0 border-b border-border/60" />
            )}
            {props.canCreate &&
              CLICK_SLOT_MINUTES.map((minute) => (
                <div
                  key={minute}
                  className="absolute inset-x-0 cursor-pointer"
                  style={{
                    top: `${(minute / 60) * props.pixelsPerHour}px`,
                    height: `${props.pixelsPerHour / CLICK_SLOTS_PER_HOUR}px`
                  }}
                  onClick={() => handleSlotClick(hour, minute)}
                />
              ))}
            {showHalfHourDivider && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed border-border" />
            )}
          </div>
        );
      })}
      {persistedPreviewStyle && (
        <div
          data-drag-to-create-persisted-preview
          className="pointer-events-none absolute inset-x-1 z-20 rounded-md bg-(--primary)/15 border-2 border-(--primary)/40 transition-[top,height] duration-75 ease-out"
          style={persistedPreviewStyle}
        />
      )}
      <div
        ref={previewRef}
        className="pointer-events-none absolute inset-x-1 z-20 hidden rounded-md border-2 bg-(--primary)/15 border-(--primary)/40 data-[collision=true]:bg-destructive/15 data-[collision=true]:border-destructive"
      />
    </div>
  );
});

export function applyResizePreviewToEvents(
  events: CalendarEvent[],
  options: {
    dragType: CalendarDragType | null;
    resizingEventId: CalendarEvent['id'] | null;
    resizeDeltaMinutes: number;
    resizingTopEventId: CalendarEvent['id'] | null;
    resizeTopDeltaMinutes: number;
  }
) {
  if (options.dragType === 'resize' && options.resizingEventId !== null) {
    return events.map((event) => {
      if (event.id !== options.resizingEventId) return event;
      if (options.resizeDeltaMinutes === 0) return event;
      const originalEnd = parseISO(event.endDate);
      const nextEnd = addMinutes(originalEnd, options.resizeDeltaMinutes);

      return { ...event, endDate: nextEnd.toISOString() };
    });
  }

  if (
    options.dragType === 'resize-top' &&
    options.resizingTopEventId !== null
  ) {
    return events.map((event) => {
      if (event.id !== options.resizingTopEventId) return event;
      if (options.resizeTopDeltaMinutes === 0) return event;
      const originalStart = parseISO(event.startDate);
      const nextStart = addMinutes(
        originalStart,
        options.resizeTopDeltaMinutes
      );

      return { ...event, startDate: nextStart.toISOString() };
    });
  }

  return events;
}
