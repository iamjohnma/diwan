import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import { useCalendarContext } from '@/components/common/big-calendar/calendar-context';
import {
  EventBadgeShell,
  useEventBadgeChrome
} from '@/components/common/big-calendar/shared/month-event-badge/badge-chrome';
import {
  type BadgeLayoutSize,
  getBadgeSizeClasses,
  resolveBadgeHeightTier,
  resolveBadgeLayout,
  resolveBadgeVisualHeightTier
} from '@/components/common/big-calendar/shared/month-event-badge/badge-layout-utils';
import { EventBadgeStatusIcon } from '@/components/common/big-calendar/shared/month-event-badge/event-badge-status-icon';
import { TruncateText } from '@/components/common/truncate-text';
import { cn } from '@/utils/common/cn';

const TEXT_ABOVE_RESIZE_HANDLES_CLASS = 'relative z-21';

interface DefaultEventBadgeProps {
  event: CalendarEvent;
  displayTitle: string;
  timeLabel: string;
  compactTimeLabel: string;
  doctorColor: string | null;
  isReadOnly: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  highlightColor: string | null;
  showFocusRing: boolean;
  enableHoverState: boolean;
  isHovered?: boolean;
  isPressable: boolean;
  isDragging: boolean;
  layoutSize?: BadgeLayoutSize | null;
  className?: string;
  style?: CSSProperties;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseDownCapture?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function DefaultEventBadge(props: DefaultEventBadgeProps) {
  const calendar = useCalendarContext();
  const pixelsPerHour = calendar.pixelsPerHour;
  const badgeRef = useRef<HTMLDivElement>(null);
  const hasControlledLayout =
    props.layoutSize !== undefined &&
    props.layoutSize !== null &&
    props.layoutSize.height > 0;
  const [measuredSize, setMeasuredSize] = useState<BadgeLayoutSize>({
    height: 0,
    width: 0
  });

  const applyMeasuredSize = useCallback((height: number, width: number) => {
    if (height <= 0 || width <= 0) return;

    setMeasuredSize((previous) =>
      previous.height === height && previous.width === width
        ? previous
        : { height, width }
    );
  }, []);

  const measureFromRef = useCallback(() => {
    const element = badgeRef.current;
    if (!element) return;

    applyMeasuredSize(element.clientHeight, element.clientWidth);
  }, [applyMeasuredSize]);

  useLayoutEffect(() => {
    if (hasControlledLayout) return;

    measureFromRef();
  }, [hasControlledLayout, measureFromRef, pixelsPerHour]);

  useEffect(() => {
    if (hasControlledLayout) return;

    const element = badgeRef.current;
    if (!element) return;

    measureFromRef();

    const observer = new ResizeObserver(() => {
      measureFromRef();
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [hasControlledLayout, measureFromRef, props.event.id]);

  const badgeSize = hasControlledLayout ? props.layoutSize! : measuredSize;
  const heightTier = resolveBadgeVisualHeightTier({
    heightTier: resolveBadgeHeightTier(badgeSize.height),
    width: badgeSize.width
  });
  const layout = resolveBadgeLayout({
    height: badgeSize.height,
    width: badgeSize.width,
    heightTier
  });
  const isCondensedLayout = layout !== 'full';
  const classes = getBadgeSizeClasses(heightTier);

  const chrome = useEventBadgeChrome({
    event: props.event,
    doctorColor: props.doctorColor,
    isReadOnly: props.isReadOnly,
    isSelected: props.isSelected,
    enableHoverState: props.enableHoverState,
    forceHover: props.isHovered,
    lockToothIconClassName: classes.icon,
    checkClockIconClassName: cn(classes.icon, 'text-white')
  });

  const statusIcon = (containerClassName: string) => (
    <EventBadgeStatusIcon
      event={props.event}
      icon={chrome.statusIcon}
      isDragging={props.isDragging}
      containerClassName={cn(
        'shrink-0 rounded-lg flex items-center justify-center',
        classes.iconContainer,
        chrome.iconContainerClass,
        containerClassName
      )}
      containerStyle={chrome.iconContainerStyle}
    />
  );

  return (
    <EventBadgeShell
      event={props.event}
      chrome={chrome}
      badgeRef={badgeRef}
      isDragging={props.isDragging}
      isPressable={props.isPressable}
      isSelected={props.isSelected}
      isHighlighted={props.isHighlighted}
      highlightColor={props.highlightColor}
      showFocusRing={props.showFocusRing}
      className={cn('min-h-0', classes.rootSpacing, classes.rootText)}
      externalClassName={props.className}
      style={props.style}
      onKeyDown={props.onKeyDown}
      onClick={props.onClick}
      onMouseDownCapture={props.onMouseDownCapture}
    >
      <div
        className={cn(
          'flex min-h-0 w-full overflow-hidden',
          isCondensedLayout
            ? 'items-start justify-start'
            : cn('flex-col', classes.contentGap)
        )}
      >
        {isCondensedLayout ? (
          <div
            className={cn(
              'flex min-h-0 w-full self-start items-center',
              classes.condensedRowGap
            )}
          >
            <div
              className={cn(
                'flex min-w-0 flex-1 items-center',
                classes.condensedRowGap
              )}
            >
              <TruncateText
                as="p"
                className={cn(
                  TEXT_ABOVE_RESIZE_HANDLES_CLASS,
                  'shrink',
                  classes.titleText
                )}
              >
                {props.displayTitle}
              </TruncateText>
              <span
                className={cn(
                  TEXT_ABOVE_RESIZE_HANDLES_CLASS,
                  'shrink-0 whitespace-nowrap',
                  'text-text-secondary',
                  classes.metaText
                )}
              >
                {props.compactTimeLabel}
              </span>
            </div>
            {statusIcon('ms-auto')}
          </div>
        ) : (
          <>
            <div className="flex w-full items-start justify-between gap-x-1">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <TruncateText
                  as="p"
                  className={cn(
                    TEXT_ABOVE_RESIZE_HANDLES_CLASS,
                    classes.titleText
                  )}
                >
                  {props.displayTitle}
                </TruncateText>
              </div>
              {statusIcon('')}
            </div>
            <TruncateText
              className={cn(
                TEXT_ABOVE_RESIZE_HANDLES_CLASS,
                'text-text-secondary',
                classes.metaText
              )}
            >
              {props.timeLabel}
            </TruncateText>
          </>
        )}
      </div>
    </EventBadgeShell>
  );
}
