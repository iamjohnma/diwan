import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import {
  BellIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  GearIcon,
  ListIcon,
  MagnifyingGlassIcon,
  SignOutIcon
} from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { TruncateText } from '@/components/common';
import { NotificationsContent } from '@/components/core/notifications-popover';
import {
  Button,
  DynamicPopover,
  DynamicPopoverContent,
  DynamicPopoverPanel,
  FloatingListSlabLayer,
  type FloatingSlabState,
  getFloatingSlabLayout,
  IconButton,
  Separator,
  Skeleton,
  UserAvatar,
  useDynamicPopover,
  useDynamicPopoverTrigger,
  useInDrawer
} from '@/components/ui';
import { useTouchScreen } from '@/hooks/common';
import {
  useBreadcrumbs,
  useCurrentProfileQuery,
  useGetUnreadNotificationsCount,
  usePointerToggle
} from '@/hooks/core';
import { cn } from '@/lib/utils';
import { useSidebarNavStore } from '@/stores/sidebar-nav';
import { requestOpenCommandPalette } from '@/utils/core/command-palette/open';

const BELL_REMINDER_INTERVAL_MS = 7000;

type ProfileMenuAction = 'settings' | 'signOut';

interface ProfileMenuItem {
  key: ProfileMenuAction;
  label: string;
  Icon: typeof GearIcon;
  iconWeight?: 'duotone';
  onClick: () => void;
  isDanger: boolean;
}

interface AppHeaderProps {
  showNotifications?: boolean;
  userRoleOverride?: string;
}

interface AppHeaderMobileMenuButtonProps {
  onOpen: () => void;
}

interface AppHeaderNotificationsTriggerProps {
  isOpen: boolean;
}

interface AppHeaderProfileTriggerProps {
  userName: string;
  userImage: string | null;
  userColor?: string | null;
  userRole: string;
  isUserRoleLoading?: boolean;
}

interface AppHeaderProfileMenuContentProps {
  userName: string;
  userEmail: string;
  userImage: string | null;
  userColor?: string | null;
  onSettings: () => void;
  onSignOut: () => void;
}

interface AppHeaderActionsProps {
  activePanelId: string | null;
  showNotifications: boolean;
  userName: string;
  userEmail: string;
  userImage: string | null;
  userColor: string | null | undefined;
  memberRole: string;
  isMemberRoleLoading: boolean;
  onCommandPaletteOpen: () => void;
  onPanelChange: (panelId: string | null) => void;
  onSettings: () => void;
  onSignOut: () => void;
}

const AppHeaderMobileMenuButton = memo(function AppHeaderMobileMenuButton(
  props: AppHeaderMobileMenuButtonProps
) {
  const { t } = useTranslation();
  const pointerToggle = usePointerToggle(props.onOpen);

  return (
    <IconButton
      variant="ghost"
      size="equal"
      className="md:hidden"
      onPointerDown={pointerToggle.onPointerDown}
      onClick={pointerToggle.onClick}
      onKeyDown={(e) =>
        (e.key === 'Enter' || e.key === ' ') &&
        (e.preventDefault(), props.onOpen())
      }
      icon={ListIcon}
      iconProps={{ className: 'size-5', weight: 'regular' }}
      tooltip={t('header.menu')}
    />
  );
});

const AppHeaderBreadcrumbs = memo(function AppHeaderBreadcrumbs() {
  const breadcrumbs = useBreadcrumbs();
  const currentBreadcrumb = breadcrumbs.items[breadcrumbs.items.length - 1];
  const SeparatorIcon =
    breadcrumbs.direction === 'rtl' ? CaretLeftIcon : CaretRightIcon;

  return (
    <>
      <nav className="hidden min-w-0 flex-1 items-center gap-x-2 overflow-hidden md:flex">
        {breadcrumbs.items.map((item, index) => {
          const isLastSegment = index === breadcrumbs.items.length - 1;

          return (
            <div
              key={`${item.href}-${index}`}
              className={cn(
                'flex items-center gap-x-1',
                isLastSegment ? 'min-w-0 flex-1' : 'shrink-0'
              )}
            >
              <Button
                variant="link"
                size="link"
                className={cn(
                  'text-sm gap-x-1 rounded-md transition-colors duration-150 no-underline hover:no-underline focus-visible:no-underline',
                  item.isCurrent
                    ? 'max-w-full min-w-0 w-full cursor-default justify-start text-secondary-foreground'
                    : 'shrink-0 text-text-secondary hover:text-secondary-foreground focus-visible:text-secondary-foreground'
                )}
                prefixIcon={item.icon}
                onClick={(e) =>
                  e.button === 0 &&
                  !item.isCurrent &&
                  breadcrumbs.navigate(item.href)
                }
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') &&
                  !item.isCurrent &&
                  (e.preventDefault(), breadcrumbs.navigate(item.href))
                }
              >
                <TruncateText className={item.isCurrent ? 'flex-1' : undefined}>
                  {item.label}
                </TruncateText>
              </Button>
              {index < breadcrumbs.items.length - 1 && (
                <SeparatorIcon className="size-4 shrink-0 text-text-tertiary" />
              )}
            </div>
          );
        })}
      </nav>
      {currentBreadcrumb && (
        <TruncateText className="flex-1 text-sm font-medium text-text-primary md:hidden">
          {currentBreadcrumb.label}
        </TruncateText>
      )}
    </>
  );
});

function AppHeaderNotificationsTrigger(
  props: AppHeaderNotificationsTriggerProps
) {
  const { t } = useTranslation();
  const [bellWiggleKey, setBellWiggleKey] = useState(0);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const previousUnreadCountRef = useRef<number | null>(null);
  const unreadCountQuery = useGetUnreadNotificationsCount();
  const unreadCount = unreadCountQuery.data ?? 0;

  const { ref, toggle, triggerProps } = useDynamicPopoverTrigger(
    'notifications',
    0
  );
  const pointerToggle = usePointerToggle(toggle);

  useEffect(() => {
    if (!hasNewNotification) return;
    setBellWiggleKey((key) => key + 1);
  }, [hasNewNotification]);

  useEffect(() => {
    const previousUnreadCount = previousUnreadCountRef.current;

    if (previousUnreadCount === null) {
      previousUnreadCountRef.current = unreadCount;

      return;
    }

    if (unreadCount > previousUnreadCount && !props.isOpen) {
      setHasNewNotification(true);
    }

    if (unreadCount === 0 && hasNewNotification) {
      setHasNewNotification(false);
    }

    if (unreadCount !== previousUnreadCount) {
      previousUnreadCountRef.current = unreadCount;
    }
  }, [hasNewNotification, props.isOpen, unreadCount]);

  useEffect(() => {
    if (unreadCount <= 0) return;
    const id = window.setInterval(() => {
      setBellWiggleKey((key) => key + 1);
    }, BELL_REMINDER_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [unreadCount]);

  const handleBellAnimationComplete = useCallback(() => {
    setHasNewNotification(false);
  }, []);

  return (
    <div>
      <IconButton
        ref={ref as React.RefObject<HTMLButtonElement>}
        className="size-14 md:size-16 hover:bg-primary/5 rounded-none active:bg-primary/8 p-0 relative"
        variant="ghost"
        size="equal"
        tooltip={t('header.notifications')}
        onPointerDown={pointerToggle.onPointerDown}
        onClick={pointerToggle.onClick}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle())
        }
        {...triggerProps}
      >
        <motion.div
          key={bellWiggleKey}
          initial={{ rotate: 0 }}
          animate={
            bellWiggleKey === 0
              ? { rotate: 0 }
              : { rotate: [0, -10, 10, -6, 6, 0] }
          }
          transition={{
            duration: bellWiggleKey === 0 ? 0 : 0.6,
            ease: 'easeInOut'
          }}
          onAnimationComplete={
            bellWiggleKey === 0 ? undefined : handleBellAnimationComplete
          }
        >
          <BellIcon className="size-6 text-text-secondary" />
        </motion.div>
        {unreadCount > 0 && (
          <span className="absolute top-3 md:top-3.5 end-3 md:end-3.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground tabular-nums">
            {unreadCount}
          </span>
        )}
      </IconButton>
    </div>
  );
}

function AppHeaderProfileTrigger(props: AppHeaderProfileTriggerProps) {
  const { t } = useTranslation();
  const { ref, toggle, triggerProps } = useDynamicPopoverTrigger('profile', 1);
  const pointerToggle = usePointerToggle(toggle);
  const knownRoles = [
    'owner',
    'admin',
    'member',
    'lawyer',
    'assistant'
  ] as const;
  const roleLabel = knownRoles.includes(
    props.userRole as (typeof knownRoles)[number]
  )
    ? t(`header.roles.${props.userRole as (typeof knownRoles)[number]}`)
    : props.userRole;

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type="button"
      className="h-14 md:h-16 p-0 hover:bg-primary/5 rounded-none active:bg-primary/8 px-2.5 md:ps-3 md:pe-5 flex min-w-0 items-center gap-2 cursor-pointer outline-none group overflow-hidden"
      onPointerDown={pointerToggle.onPointerDown}
      onClick={pointerToggle.onClick}
      onKeyDown={(e) =>
        (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle())
      }
      {...triggerProps}
    >
      <UserAvatar
        name={props.userName}
        imageUrl={props.userImage}
        color={props.userColor}
        size="md"
        showSkeletonWhileImageLoading
      />
      <div className="hidden min-w-0 max-w-32 flex-col items-start md:flex">
        <TruncateText
          as="p"
          className="text-sm group-hover:text-primary duration-200 transition-colors"
        >
          {props.userName || t('header.noName')}
        </TruncateText>
        {props.isUserRoleLoading ? (
          <Skeleton className="h-3 w-14" />
        ) : (
          <TruncateText
            as="p"
            className="text-xs text-text-tertiary group-hover:text-text-secondary duration-200 transition-colors"
          >
            {roleLabel}
          </TruncateText>
        )}
      </div>
      <CaretDownIcon className="hidden md:block size-4.5 shrink-0 text-text-tertiary ms-1.5 group-hover:text-text-secondary duration-200 transition-colors" />
    </button>
  );
}

function AppHeaderProfileMenuContent(props: AppHeaderProfileMenuContentProps) {
  const { t } = useTranslation();
  const { userName, userEmail, userImage, userColor, onSettings, onSignOut } =
    props;
  const { isMobile, close } = useDynamicPopover();
  const touchScreen = useTouchScreen();
  const [slab, setSlab] = useState<FloatingSlabState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSettings = useCallback(() => {
    close();
    onSettings();
  }, [close, onSettings]);

  const handleSignOut = useCallback(() => {
    close();
    onSignOut();
  }, [close, onSignOut]);

  const handleMouseEnter = useCallback(
    (action: ProfileMenuAction, e: React.MouseEvent<HTMLButtonElement>) => {
      if (!containerRef.current) return;
      setSlab({
        layout: getFloatingSlabLayout(e.currentTarget, containerRef.current),
        itemKey: action,
        variant: action === 'signOut' ? 'error' : 'default'
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setSlab(null);
  }, []);

  const inDrawer = useInDrawer();
  const showSlabLayer = !inDrawer && !touchScreen.hasTouchCapability;
  const iconClassName = inDrawer ? 'size-5.5' : 'size-5';
  const profileMenuItems: ProfileMenuItem[] = [
    {
      key: 'settings',
      label: t('header.settings'),
      Icon: GearIcon,
      iconWeight: 'duotone',
      onClick: handleSettings,
      isDanger: false
    },
    {
      key: 'signOut',
      label: t('header.signOut'),
      Icon: SignOutIcon,
      onClick: handleSignOut,
      isDanger: true
    }
  ];

  return (
    <div className="bg-linear-to-b from-background-overlay via-background-overlay to-background-surface/50">
      {isMobile && !inDrawer && (
        <div className="px-4 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">
            {t('header.profile')}
          </h3>
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-3 border-b border-border min-w-0',
          inDrawer && 'pt-0'
        )}
      >
        <UserAvatar
          name={userName}
          imageUrl={userImage}
          color={userColor}
          size="lg"
          className="shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TruncateText
            as="p"
            className="text-base font-medium text-text-primary"
          >
            {userName}
          </TruncateText>
          <TruncateText as="p" className="text-sm text-text-tertiary">
            {userEmail}
          </TruncateText>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative p-1.5 flex flex-col"
        onMouseLeave={handleMouseLeave}
      >
        <FloatingListSlabLayer
          motionKey="profile-menu-highlight"
          roundedClassName="rounded-lg"
          show={showSlabLayer}
          slab={slab}
        />
        {profileMenuItems.map((item) => {
          const hoverClassName = item.isDanger
            ? 'hover:bg-error/10'
            : 'hover:bg-secondary hover:text-secondary-foreground';
          const Icon = item.Icon;

          return (
            <button
              key={item.key}
              type="button"
              className={cn(
                'relative z-10 flex w-full items-center rounded-lg cursor-pointer transition-colors duration-200',
                item.isDanger ? 'text-error' : 'text-text-primary',
                !item.isDanger &&
                  slab?.itemKey === item.key &&
                  showSlabLayer &&
                  'text-secondary-foreground',
                inDrawer
                  ? cn('gap-3 px-4 py-2.5 text-sm', hoverClassName)
                  : cn(
                      'gap-2.5 px-3 py-2 text-sm',
                      !showSlabLayer && hoverClassName
                    )
              )}
              onClick={item.onClick}
              onMouseEnter={(event) => handleMouseEnter(item.key, event)}
            >
              <Icon className={iconClassName} weight={item.iconWeight} />
              <TruncateText className="flex-1 text-inherit">
                {item.label}
              </TruncateText>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const AppHeaderActions = memo(function AppHeaderActions(
  props: AppHeaderActionsProps
) {
  const { t } = useTranslation();
  const touchScreen = useTouchScreen();

  return (
    <DynamicPopover onPanelChange={props.onPanelChange}>
      <div className="flex shrink-0 items-center">
        {!touchScreen.hasTouchCapability && (
          <>
            <IconButton
              variant="ghost"
              size="equal"
              className="size-14 rounded-none hover:bg-primary/5 active:bg-primary/8 p-0 md:hidden"
              onClick={(e) => e.button === 0 && props.onCommandPaletteOpen()}
              onKeyDown={(e) =>
                (e.key === 'Enter' || e.key === ' ') &&
                (e.preventDefault(), props.onCommandPaletteOpen())
              }
              icon={MagnifyingGlassIcon}
              iconProps={{ className: 'size-5', weight: 'regular' }}
              tooltip={t('header.globalSearch')}
            />
            <Separator
              orientation="vertical"
              containerClassName="self-stretch md:hidden"
            />
          </>
        )}
        {props.showNotifications && (
          <>
            <AppHeaderNotificationsTrigger
              isOpen={props.activePanelId === 'notifications'}
            />
            <Separator
              orientation="vertical"
              containerClassName="self-stretch"
            />
          </>
        )}
        {!props.showNotifications && (
          <Separator
            orientation="vertical"
            containerClassName="hidden self-stretch md:block"
          />
        )}
        <AppHeaderProfileTrigger
          userName={props.userName}
          userImage={props.userImage}
          userColor={props.userColor}
          userRole={props.memberRole}
          isUserRoleLoading={props.isMemberRoleLoading}
        />
        <DynamicPopoverContent align="end" sideOffset={0}>
          {props.showNotifications && (
            <DynamicPopoverPanel
              panelId="notifications"
              className="md:w-80"
              warmup
            >
              <NotificationsContent />
            </DynamicPopoverPanel>
          )}
          <DynamicPopoverPanel
            panelId="profile"
            className="w-72 min-w-72 max-w-72"
            warmup
          >
            <AppHeaderProfileMenuContent
              userName={props.userName}
              userEmail={props.userEmail}
              userImage={props.userImage}
              userColor={props.userColor}
              onSettings={props.onSettings}
              onSignOut={props.onSignOut}
            />
          </DynamicPopoverPanel>
        </DynamicPopoverContent>
      </div>
    </DynamicPopover>
  );
});

function AppHeaderComponent(props?: AppHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authActions = useAuthActions();
  const currentProfileQuery = useCurrentProfileQuery();
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const showNotifications = props?.showNotifications ?? true;
  const openMobile = useSidebarNavStore((state) => state.openMobile);

  const profile = currentProfileQuery.data;
  const memberRole = props?.userRoleOverride ?? profile?.role ?? 'lawyer';
  const isMemberRoleLoading =
    props?.userRoleOverride === undefined && currentProfileQuery.isPending;

  const handleSettings = useCallback(() => {
    void navigate({ to: '/settings' });
  }, [navigate]);

  const handleSignOut = useCallback(() => {
    void authActions.signOut();
  }, [authActions]);

  const userName = profile?.name || t('header.noName');
  const userEmail = profile?.email ?? '';
  const userImage = profile?.image ?? null;

  return (
    <div className="relative z-30 flex min-w-0 items-center justify-between border-b border-border-default bg-background-base ps-3 safe-top md:ps-6">
      <div className="flex min-w-0 flex-1 items-center gap-x-2 overflow-hidden">
        <AppHeaderMobileMenuButton onOpen={openMobile} />
        <AppHeaderBreadcrumbs />
      </div>
      <AppHeaderActions
        activePanelId={activePanelId}
        showNotifications={showNotifications}
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
        userColor={undefined}
        memberRole={memberRole}
        isMemberRoleLoading={isMemberRoleLoading}
        onCommandPaletteOpen={requestOpenCommandPalette}
        onPanelChange={setActivePanelId}
        onSettings={handleSettings}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

export const AppHeader = memo(AppHeaderComponent);
