import type { CSSProperties } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  NAVIGATION_ROW_ACTIVE_CLASS_NAME,
  NAVIGATION_ROW_CLASS_NAME,
  NAVIGATION_ROW_GHOST_CLASS_NAME
} from '@/components/pages/_app/side-bar/navigation-row';
import type { NavigationChildLink } from '@/constants/core/navigation-links';
import { useSidebarNavigationLinkPress } from '@/hooks/pages/_app';
import { cn } from '@/lib/utils';
import { isRoutePathActive } from '@/utils/core/pathname';

// Timing constants copied from Naab's nested-links-list.
const ROW_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const ROW_MS = 400;
const EDGE_MS = 300;
const NESTED_ROW_STYLE: CSSProperties = { height: 34, paddingInline: 11 };

interface NestedLinkItemProps {
  child: NavigationChildLink;
  isSidebarOpen: boolean;
  onNavigate?: () => void;
}

function NestedLinkItem(props: NestedLinkItemProps) {
  const { t } = useTranslation();
  const ChildIcon = props.child.icon;
  const isChildLinkActive = useRouterState({
    select: (state) =>
      isRoutePathActive(state.location.pathname, props.child.href)
  });
  const childLinkPress = useSidebarNavigationLinkPress({
    href: props.child.href,
    onNavigate: props.onNavigate
  });

  return (
    <Link
      className={cn(
        NAVIGATION_ROW_CLASS_NAME,
        isChildLinkActive
          ? NAVIGATION_ROW_ACTIVE_CLASS_NAME
          : NAVIGATION_ROW_GHOST_CLASS_NAME
      )}
      style={NESTED_ROW_STYLE}
      to={props.child.href}
      {...childLinkPress}
    >
      <ChildIcon
        aria-hidden="true"
        className="size-4 shrink-0"
        weight="duotone"
      />
      <span
        className={cn(
          'truncate text-sm font-medium transition-[opacity,margin] duration-300',
          props.isSidebarOpen ? 'ms-2 opacity-100' : 'ms-0 opacity-0'
        )}
      >
        {t(props.child.labelKey)}
      </span>
    </Link>
  );
}

interface NestedLinksListProps {
  links: readonly NavigationChildLink[];
  isSidebarOpen: boolean;
  isExpanded: boolean;
  onNavigate?: () => void;
}

// Expands with the CSS grid-row technique from Naab: the outer grid animates
// to the content's natural height, the start-edge guide line fades in, and
// the gutter margins collapse together with the sidebar rail.
export function NestedLinksList(props: NestedLinksListProps) {
  const edgeVisible = props.isExpanded && props.isSidebarOpen;
  const gutterStyle: CSSProperties = {
    marginInlineStart: props.isSidebarOpen ? 14 : 0,
    marginTop: 4,
    transition: `margin-inline-start ${EDGE_MS}ms ${ROW_EASE}, margin-top ${EDGE_MS}ms ${ROW_EASE}`
  };
  const contentStyle: CSSProperties = {
    paddingInlineStart: props.isSidebarOpen ? 8 : 0,
    transition: `padding-inline-start ${EDGE_MS}ms ${ROW_EASE}`
  };
  const lineStyle: CSSProperties = {
    opacity: edgeVisible ? 1 : 0,
    transition: `opacity ${EDGE_MS}ms ${ROW_EASE}`,
    backgroundColor: 'var(--color-border)',
    boxShadow: '-1px 0 6px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div
      aria-hidden={!props.isExpanded}
      className="grid min-h-0"
      style={{
        gridTemplateRows: props.isExpanded ? '1fr' : '0fr',
        transition: `grid-template-rows ${ROW_MS}ms ${ROW_EASE}`
      }}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex min-h-0 flex-row" style={gutterStyle}>
          <div
            className="pointer-events-none min-h-0 w-px shrink-0 self-stretch rounded-full"
            style={lineStyle}
          />
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden"
            style={contentStyle}
          >
            {props.links.map((child) => (
              <NestedLinkItem
                key={child.href}
                child={child}
                isSidebarOpen={props.isSidebarOpen}
                onNavigate={props.onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
