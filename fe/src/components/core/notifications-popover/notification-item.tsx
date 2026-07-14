import type { Icon } from '@phosphor-icons/react';
import {
  ArrowSquareOutIcon,
  BellIcon,
  BellRingingIcon,
  CalendarCheckIcon,
  CoinsIcon,
  FileTextIcon,
  ScalesIcon,
  UsersThreeIcon
} from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TruncateText } from '@/components/common';
import {
  type MockNotification,
  type MockNotificationType
} from '@/hooks/core';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: MockNotification;
  isActionable?: boolean;
  onClick: (notification: MockNotification) => void;
  onMarkAsRead: (notification: MockNotification) => void;
}

type NotificationVisualTuple = readonly [Icon, string];

const defaultVisuals: NotificationVisualTuple = [
  BellIcon,
  'text-primary bg-primary/10'
];

const visualsByType: Record<MockNotificationType, NotificationVisualTuple> = {
  case_updated: [ScalesIcon, 'text-blue-500 bg-blue-500/10'],
  hearing_reminder: [BellRingingIcon, 'text-amber-500 bg-amber-500/10'],
  payment_received: [CoinsIcon, 'text-green-500 bg-green-500/10'],
  document_uploaded: [FileTextIcon, 'text-violet-500 bg-violet-500/10'],
  party_added: [UsersThreeIcon, 'text-teal-500 bg-teal-500/10'],
  installment_due: [CalendarCheckIcon, 'text-orange-500 bg-orange-500/10']
};

export function NotificationItem(props: NotificationItemProps) {
  const [IconComponent, colorClass] =
    visualsByType[props.notification.type] ?? defaultVisuals;
  const timeAgo = formatDistanceToNow(new Date(props.notification.createdAt), {
    addSuffix: true,
    locale: ar
  });
  const canPrimaryClick = !props.notification.isRead || !!props.isActionable;
  const isButtonDisabled = !canPrimaryClick;

  return (
    <button
      type="button"
      disabled={isButtonDisabled}
      onClick={() => {
        if (!canPrimaryClick) return;
        props.onClick(props.notification);
      }}
      onContextMenu={(event) => {
        if (props.notification.isRead) return;
        event.preventDefault();
        props.onMarkAsRead(props.notification);
      }}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border bg-background-base px-3 py-3 text-start transition-colors',
        'border-border-default',
        !props.notification.isRead &&
          'cursor-pointer border-primary/40 bg-primary/5 hover:bg-primary/10 active:bg-primary/13',
        props.notification.isRead &&
          props.isActionable &&
          'cursor-pointer hover:bg-secondary/40 active:bg-secondary/60',
        isButtonDisabled && 'pointer-events-none cursor-default'
      )}
    >
      <div className="relative shrink-0">
        <div className={cn('rounded-lg p-2', colorClass)}>
          <IconComponent className="size-5" weight="fill" />
        </div>
        {!props.notification.isRead && (
          <span className="absolute -top-0.5 inset-s-0 size-2.5 -translate-x-1/2 rounded-full bg-primary ring-2 ring-background-base rtl:translate-x-1/2" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <TruncateText
          className={cn(
            'text-sm',
            props.notification.isRead
              ? 'text-text-secondary'
              : 'font-medium text-text-primary'
          )}
        >
          {props.notification.title}
        </TruncateText>
        <p className="min-w-0 max-w-full wrap-anywhere line-clamp-2 text-xs text-text-tertiary">
          {props.notification.body}
        </p>
        <p className="mt-0.5 text-xs text-text-tertiary">{timeAgo}</p>
      </div>
      {props.isActionable && (
        <ArrowSquareOutIcon
          className="mt-0.5 size-4 shrink-0 text-text-tertiary"
          weight="regular"
        />
      )}
    </button>
  );
}
