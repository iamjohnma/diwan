import { useLayoutEffect, useState } from 'react';
import { TIME_COLUMN_WIDTH } from '@/constants/common/big-calendar';
import { useCalendarViewportScrollState } from '@/hooks/common/big-calendar/use-calendar-viewport-scroll-state';

const MIN_COLUMN_WIDTH = 240;
const COLUMN_THROTTLE_MS = 150;

interface DoctorViewLayoutPropsHook {
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  doctorCount: number;
  isDraggingRef: React.RefObject<boolean>;
  timeColumnWidth?: number;
}

export function useDoctorViewLayout(props: DoctorViewLayoutPropsHook) {
  const timeColumnWidth = props.timeColumnWidth ?? TIME_COLUMN_WIDTH;
  const [columnWidth, setColumnWidth] = useState(MIN_COLUMN_WIDTH);
  const { viewportElement, scrollState, syncScrollState } =
    useCalendarViewportScrollState({
      scrollAreaRef: props.scrollAreaRef,
      isDraggingRef: props.isDraggingRef
    });

  useLayoutEffect(() => {
    const container = props.containerRef.current;
    if (!container) return;

    let lastRun = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const runUpdate = () => {
      const availableWidth = Math.max(
        container.offsetWidth - timeColumnWidth,
        MIN_COLUMN_WIDTH
      );
      const visibleDoctorCount = Math.max(
        1,
        Math.min(
          Math.floor(availableWidth / MIN_COLUMN_WIDTH),
          props.doctorCount
        )
      );
      setColumnWidth(
        Math.max(
          MIN_COLUMN_WIDTH,
          Math.floor(availableWidth / visibleDoctorCount)
        )
      );
    };

    const scheduleUpdate = () => {
      const now = Date.now();
      const elapsed = now - lastRun;
      if (elapsed >= COLUMN_THROTTLE_MS || lastRun === 0) {
        lastRun = now;
        runUpdate();
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        return;
      }
      if (timeoutId !== null) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        lastRun = Date.now();
        runUpdate();
      }, COLUMN_THROTTLE_MS - elapsed);
    };

    runUpdate();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [props.doctorCount, props.containerRef, timeColumnWidth]);

  return {
    columnWidth,
    viewportElement,
    scrollState,
    syncScrollState
  };
}
