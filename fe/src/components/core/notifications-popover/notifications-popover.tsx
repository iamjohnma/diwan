import { useCallback } from 'react';
import { BellIcon, ChecksIcon, GearIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { NotificationItem } from '@/components/core/notifications-popover/notification-item';
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  IconButton,
  useDynamicPopover,
  useInDrawer
} from '@/components/ui';
import { useDirection } from '@/hooks/common';
import {
  type MockNotification,
  useMockNotifications
} from '@/hooks/core';
import { cn } from '@/lib/utils';
import { handleFloatingOverlayWheelScroll } from '@/utils/common/floating-overlay-wheel-scroll';

interface NotificationsHeaderProps {
  unreadCount: number;
  onMarkAllAsRead: () => void;
}

function NotificationsHeader(props: NotificationsHeaderProps) {
  const { t } = useTranslation();
  const inDrawer = useInDrawer();

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-background-base px-4',
        inDrawer ? 'pb-3 pt-0' : 'py-3'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <h3 className="text-base font-semibold text-text-primary">
          {t('notifications.title')}
        </h3>
        {props.unreadCount > 0 && (
          <Button
            variant="link"
            size="link"
            className="gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
            prefixIcon={ChecksIcon}
            prefixIconProps={{ className: 'size-4', weight: 'bold' }}
            onClick={props.onMarkAllAsRead}
          >
            {t('notifications.markAllAsRead')}
          </Button>
        )}
      </div>
      <IconButton
        variant="ghost"
        size="iconSm"
        className="shrink-0 text-text-tertiary hover:text-text-secondary"
        icon={GearIcon}
        iconProps={{ className: 'size-4.5', weight: 'regular' }}
        tooltip={t('notifications.preferencesOpenLabel')}
      />
    </div>
  );
}

export function NotificationsContent() {
  const { t } = useTranslation();
  const direction = useDirection();
  const { close } = useDynamicPopover();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useMockNotifications();

  const handleNotificationClick = useCallback(
    (notification: MockNotification) => {
      if (!notification.isRead) {
        markAsRead(notification.id);
      }
      close();
    },
    [close, markAsRead]
  );

  const handleMarkAsRead = useCallback(
    (notification: MockNotification) => {
      markAsRead(notification.id);
    },
    [markAsRead]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NotificationsHeader
        unreadCount={unreadCount}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain md:h-96 md:max-h-96',
          notifications.length > 0 && 'p-2'
        )}
        style={{ direction }}
        onWheel={handleFloatingOverlayWheelScroll}
      >
        {notifications.length > 0 ? (
          <div className="flex flex-col gap-2 bg-background-base">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isActionable
                onClick={handleNotificationClick}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </div>
        ) : (
          <Empty className="min-h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon className="size-5" weight="duotone" />
              </EmptyMedia>
              <EmptyTitle>{t('notifications.empty')}</EmptyTitle>
              <EmptyDescription>
                {t('notifications.emptyDescription')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
