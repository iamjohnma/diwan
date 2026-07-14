import type { CSSProperties } from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  NAVIGATION_ROW_ACTIVE_CLASS_NAME,
  NAVIGATION_ROW_CLASS_NAME,
  NAVIGATION_ROW_GHOST_CLASS_NAME
} from '@/components/pages/_app/side-bar/navigation-row';
import { NestedLinksList } from '@/components/pages/_app/side-bar/nested-links-list';
import type { NavigationLinkConfig } from '@/constants/core/navigation-links';
import { getNavigationLinkKey } from '@/constants/core/navigation-links';
import { useDirection } from '@/hooks/common';
import { usePointerToggle } from '@/hooks/core';
import { useSidebarNavigationLinkPress } from '@/hooks/pages/_app';
import type { SidebarHook } from '@/hooks/pages/_app';
import { cn } from '@/lib/utils';
import { useSidebarNavStore } from '@/stores/sidebar-nav';
import { isRoutePathActive } from '@/utils/core/pathname';

// Matches Naab's `px-[11px]` row inset without an arbitrary Tailwind value.
const ROW_STYLE: CSSProperties = { paddingInline: 11 };

interface NavigationLinkProps {
  link: NavigationLinkConfig;
  sidebar: SidebarHook;
  onNavigate?: () => void;
}

interface NavigationLinkLabelProps {
  label: string;
  isSidebarOpen: boolean;
}

function NavigationLinkLabel(props: NavigationLinkLabelProps) {
  return (
    <span
      className={cn(
        'flex-1 truncate text-sm font-medium transition-opacity duration-300',
        props.isSidebarOpen ? 'opacity-100' : 'opacity-0'
      )}
    >
      {props.label}
    </span>
  );
}

interface ExpandChevronProps {
  isVisible: boolean;
  isExpanded: boolean;
}

// Matches Naab: points down when expanded; collapsed points into the content
// (180° in RTL, 0° in LTR).
function ExpandChevron(props: ExpandChevronProps) {
  const direction = useDirection();
  const collapsedRotation = direction === 'rtl' ? 'rotate-180' : 'rotate-0';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center transition-[transform,opacity,width] duration-300',
        props.isExpanded ? 'rotate-90' : collapsedRotation,
        props.isVisible ? 'w-4 opacity-100' : 'w-0 opacity-0'
      )}
    >
      <CaretRightIcon className="size-4" weight="bold" />
    </span>
  );
}

interface NavigationGroupProps extends NavigationLinkProps {
  link: Extract<NavigationLinkConfig, { children: unknown }>;
}

// A group row (billing): toggles its nested links. Like Naab, toggling works
// in the collapsed rail too — the nested icons expand inline.
function NavigationGroup(props: NavigationGroupProps) {
  const { t } = useTranslation();
  const linkKey = getNavigationLinkKey(props.link);
  const GroupIcon = props.link.icon;
  const isExpanded = useSidebarNavStore((state) =>
    state.expandedKeys.includes(linkKey)
  );
  const toggleExpandedKey = useSidebarNavStore(
    (state) => state.toggleExpandedKey
  );
  // Mouse expands on pointer-down; touch waits for click.
  const expandToggle = usePointerToggle(() => toggleExpandedKey(linkKey));
  const isChildActive = useRouterState({
    select: (state) =>
      props.link.children.some((child) =>
        isRoutePathActive(state.location.pathname, child.href)
      )
  });

  return (
    <div className="flex flex-col">
      <button
        aria-expanded={isExpanded}
        className={cn(
          NAVIGATION_ROW_CLASS_NAME,
          isChildActive && !isExpanded
            ? NAVIGATION_ROW_ACTIVE_CLASS_NAME
            : NAVIGATION_ROW_GHOST_CLASS_NAME
        )}
        onPointerDown={expandToggle.onPointerDown}
        onClick={expandToggle.onClick}
        style={ROW_STYLE}
        type="button"
      >
        <GroupIcon
          aria-hidden="true"
          className="size-5 shrink-0"
          weight="duotone"
        />
        <NavigationLinkLabel
          label={t(props.link.labelKey)}
          isSidebarOpen={props.sidebar.isOpen}
        />
        <ExpandChevron
          isVisible={props.sidebar.isOpen}
          isExpanded={isExpanded}
        />
      </button>
      <NestedLinksList
        links={props.link.children}
        isSidebarOpen={props.sidebar.isOpen}
        isExpanded={isExpanded}
        onNavigate={props.onNavigate}
      />
    </div>
  );
}

interface NavigationLeafLinkProps extends NavigationLinkProps {
  link: Extract<NavigationLinkConfig, { href: unknown }>;
}

function NavigationLeafLink(props: NavigationLeafLinkProps) {
  const { t } = useTranslation();
  const LeafIcon = props.link.icon;
  const isActive = useRouterState({
    select: (state) =>
      isRoutePathActive(state.location.pathname, props.link.href)
  });
  const linkPress = useSidebarNavigationLinkPress({
    href: props.link.href,
    onNavigate: props.onNavigate
  });

  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        NAVIGATION_ROW_CLASS_NAME,
        isActive
          ? NAVIGATION_ROW_ACTIVE_CLASS_NAME
          : NAVIGATION_ROW_GHOST_CLASS_NAME
      )}
      style={ROW_STYLE}
      to={props.link.href}
      {...linkPress}
    >
      <LeafIcon
        aria-hidden="true"
        className="size-5 shrink-0"
        weight="duotone"
      />
      <NavigationLinkLabel
        label={t(props.link.labelKey)}
        isSidebarOpen={props.sidebar.isOpen}
      />
    </Link>
  );
}

export function NavigationLink(props: NavigationLinkProps) {
  if ('children' in props.link) {
    return (
      <NavigationGroup
        link={props.link}
        sidebar={props.sidebar}
        onNavigate={props.onNavigate}
      />
    );
  }

  return (
    <NavigationLeafLink
      link={props.link}
      sidebar={props.sidebar}
      onNavigate={props.onNavigate}
    />
  );
}
