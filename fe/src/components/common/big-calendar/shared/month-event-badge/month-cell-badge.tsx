import type { CSSProperties } from 'react';
import type { CalendarEvent } from '@/@types/common/big-calendar';
import {
  EventBadgeShell,
  useEventBadgeChrome
} from '@/components/common/big-calendar/shared/month-event-badge/badge-chrome';
import { EventBadgeStatusIcon } from '@/components/common/big-calendar/shared/month-event-badge/event-badge-status-icon';
import { TruncateText } from '@/components/common/truncate-text';
import { cn } from '@/utils/common/cn';

interface MonthCellBadgeProps {
  event: CalendarEvent;
  displayTitle: string;
  timeLabel: string;
  doctorColor: string | null;
  isReadOnly: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  highlightColor: string | null;
  showFocusRing: boolean;
  enableHoverState: boolean;
  isPressable: boolean;
  isDragging: boolean;
  className?: string;
  style?: CSSProperties;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseDownCapture?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function MonthCellBadge(props: MonthCellBadgeProps) {
  const chrome = useEventBadgeChrome({
    event: props.event,
    doctorColor: props.doctorColor,
    isReadOnly: props.isReadOnly,
    isSelected: props.isSelected,
    enableHoverState: props.enableHoverState,
    checkClockIconClassName: 'size-3 text-white'
  });

  return (
    <EventBadgeShell
      event={props.event}
      chrome={chrome}
      isDragging={props.isDragging}
      isPressable={props.isPressable}
      isSelected={props.isSelected}
      isHighlighted={props.isHighlighted}
      highlightColor={props.highlightColor}
      showFocusRing={props.showFocusRing}
      className="px-2 py-1 text-xs"
      externalClassName={props.className}
      style={props.style}
      onKeyDown={props.onKeyDown}
      onClick={props.onClick}
      onMouseDownCapture={props.onMouseDownCapture}
    >
      <div className="flex min-h-0 w-full flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center justify-between gap-1">
          <TruncateText as="p" className="font-semibold">
            {props.displayTitle}
          </TruncateText>
          <EventBadgeStatusIcon
            event={props.event}
            icon={chrome.statusIcon}
            isDragging={props.isDragging}
            containerClassName={cn(
              'size-4.5 shrink-0 rounded-lg flex justify-center items-center',
              chrome.iconContainerClass
            )}
            containerStyle={chrome.iconContainerStyle}
          />
        </div>
        <TruncateText className="text-text-secondary">
          {props.timeLabel}
        </TruncateText>
      </div>
    </EventBadgeShell>
  );
}
