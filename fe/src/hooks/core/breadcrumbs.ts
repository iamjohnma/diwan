import { useMemo } from 'react';
import type { Icon } from '@phosphor-icons/react';
import {
  BankIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  FolderOpenIcon,
  GearIcon,
  HouseIcon,
  MoneyIcon,
  ReceiptIcon,
  ScalesIcon,
  UsersThreeIcon
} from '@phosphor-icons/react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  MAIN_NAVIGATION_LINKS,
  SETTINGS_NAVIGATION_LINKS,
  getNavigationPageTitle,
  type AppRoute,
  type NavigationPageKey
} from '@/constants/core/navigation-links';
import { useDirection } from '@/hooks/common';
import { isRoutePathActive } from '@/utils/core/pathname';

interface BreadcrumbItem {
  href: AppRoute | string;
  label: string;
  icon: Icon;
  isCurrent: boolean;
}

interface BreadcrumbsResult {
  items: BreadcrumbItem[];
  direction: 'ltr' | 'rtl';
  navigate: (href: string) => void;
}

interface RouteBreadcrumbConfig {
  href: AppRoute;
  pageKey: NavigationPageKey;
  icon: Icon;
}

function collectLeafRoutes(): RouteBreadcrumbConfig[] {
  const routes: RouteBreadcrumbConfig[] = [
    {
      href: '/',
      pageKey: 'dashboard',
      icon: HouseIcon
    }
  ];

  for (const link of MAIN_NAVIGATION_LINKS) {
    if ('children' in link) {
      for (const child of link.children) {
        routes.push({
          href: child.href,
          pageKey: child.keywordKey,
          icon: child.icon
        });
      }
    } else if (link.href !== '/') {
      routes.push({
        href: link.href,
        pageKey: link.keywordKey,
        icon: link.icon
      });
    }
  }

  for (const link of SETTINGS_NAVIGATION_LINKS) {
    if ('href' in link) {
      routes.push({
        href: link.href,
        pageKey: link.keywordKey,
        icon: link.icon
      });
    }
  }

  const billingChildren = new Set<AppRoute>([
    '/payments',
    '/checks',
    '/installments'
  ]);

  return routes.map((route) =>
    billingChildren.has(route.href)
      ? {
          ...route,
          icon:
            route.href === '/payments'
              ? ReceiptIcon
              : route.href === '/checks'
                ? BankIcon
                : route.href === '/installments'
                  ? CalendarCheckIcon
                  : route.icon
        }
      : route
  );
}

const ROUTE_CONFIGS = collectLeafRoutes();

const FALLBACK_ICONS: Record<string, Icon> = {
  '/': HouseIcon,
  '/calendar': CalendarBlankIcon,
  '/cases': ScalesIcon,
  '/parties': UsersThreeIcon,
  '/documents': FolderOpenIcon,
  '/payments': MoneyIcon,
  '/checks': BankIcon,
  '/installments': CalendarCheckIcon,
  '/settings': GearIcon
};

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname || '/';
}

function findRouteConfig(pathname: string): RouteBreadcrumbConfig | undefined {
  const normalized = normalizePathname(pathname);
  const exact = ROUTE_CONFIGS.find((route) => route.href === normalized);
  if (exact) {
    return exact;
  }

  return ROUTE_CONFIGS.find((route) =>
    isRoutePathActive(normalized, route.href)
  );
}

export function useBreadcrumbs(): BreadcrumbsResult {
  const { t, i18n } = useTranslation();
  const direction = useDirection();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });

  const items = useMemo(() => {
    const normalized = normalizePathname(pathname);
    const crumbs: BreadcrumbItem[] = [
      {
        href: '/',
        label: getNavigationPageTitle(t, 'dashboard'),
        icon: HouseIcon,
        isCurrent: normalized === '/'
      }
    ];

    if (normalized === '/') {
      return crumbs;
    }

    const route = findRouteConfig(normalized);
    if (!route) {
      crumbs.push({
        href: normalized,
        label: normalized,
        icon: FALLBACK_ICONS[normalized] ?? GearIcon,
        isCurrent: true
      });

      return crumbs;
    }

    const dashboard = crumbs[0];
    if (dashboard) {
      crumbs[0] = { ...dashboard, isCurrent: false };
    }
    crumbs.push({
      href: route.href,
      label: getNavigationPageTitle(t, route.pageKey),
      icon: route.icon,
      isCurrent: true
    });

    return crumbs;
  }, [i18n.language, pathname, t]);

  return {
    items,
    direction,
    navigate: (href) => {
      void navigate({ to: href });
    }
  };
}
