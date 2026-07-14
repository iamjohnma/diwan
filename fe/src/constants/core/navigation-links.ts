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
import type { TFunction } from 'i18next';
import type { FileRouteTypes } from '@/routeTree.gen';

export type AppRoute = FileRouteTypes['fullPaths'];

export type NavigationPageKey =
  | 'dashboard'
  | 'calendar'
  | 'cases'
  | 'parties'
  | 'documents'
  | 'billing'
  | 'payments'
  | 'checks'
  | 'installments'
  | 'settings';

export interface NavigationChildLink {
  icon: Icon;
  labelKey: `commandPalette.items.${NavigationPageKey}`;
  href: AppRoute;
  keywordKey: NavigationPageKey;
}

interface NavigationLeafConfig {
  icon: Icon;
  labelKey: `commandPalette.items.${NavigationPageKey}`;
  href: AppRoute;
  keywordKey: NavigationPageKey;
}

interface NavigationGroupConfig {
  icon: Icon;
  labelKey: `commandPalette.items.${NavigationPageKey}`;
  keywordKey: NavigationPageKey;
  children: NavigationChildLink[];
}

export type NavigationLinkConfig = NavigationLeafConfig | NavigationGroupConfig;

export const NAVIGATION_PAGE_KEYS = {
  calendar: 'calendar',
  dashboard: 'dashboard',
  cases: 'cases',
  parties: 'parties',
  documents: 'documents',
  billing: 'billing',
  payments: 'payments',
  checks: 'checks',
  installments: 'installments',
  settings: 'settings'
} as const satisfies Record<NavigationPageKey, NavigationPageKey>;

// Single source of truth for sidebar rows AND the command palette. Adding a
// destination here automatically surfaces it in both surfaces.
export const MAIN_NAVIGATION_LINKS: NavigationLinkConfig[] = [
  {
    icon: HouseIcon,
    labelKey: 'commandPalette.items.dashboard',
    href: '/',
    keywordKey: 'dashboard'
  },
  {
    icon: CalendarBlankIcon,
    labelKey: 'commandPalette.items.calendar',
    href: '/calendar',
    keywordKey: 'calendar'
  },
  {
    icon: ScalesIcon,
    labelKey: 'commandPalette.items.cases',
    href: '/cases',
    keywordKey: 'cases'
  },
  {
    icon: UsersThreeIcon,
    labelKey: 'commandPalette.items.parties',
    href: '/parties',
    keywordKey: 'parties'
  },
  {
    icon: FolderOpenIcon,
    labelKey: 'commandPalette.items.documents',
    href: '/documents',
    keywordKey: 'documents'
  },
  {
    icon: MoneyIcon,
    labelKey: 'commandPalette.items.billing',
    keywordKey: 'billing',
    children: [
      {
        icon: ReceiptIcon,
        labelKey: 'commandPalette.items.payments',
        href: '/payments',
        keywordKey: 'payments'
      },
      {
        icon: BankIcon,
        labelKey: 'commandPalette.items.checks',
        href: '/checks',
        keywordKey: 'checks'
      },
      {
        icon: CalendarCheckIcon,
        labelKey: 'commandPalette.items.installments',
        href: '/installments',
        keywordKey: 'installments'
      }
    ]
  }
];

export const SETTINGS_NAVIGATION_LINKS: NavigationLinkConfig[] = [
  {
    icon: GearIcon,
    labelKey: 'commandPalette.items.settings',
    href: '/settings',
    keywordKey: 'settings'
  }
];

export function getNavigationLinkKey(link: NavigationLinkConfig): string {
  return 'href' in link ? link.href : link.labelKey;
}

export function getNavigationPageTitle(
  t: TFunction,
  key: NavigationPageKey
): string {
  return t(`commandPalette.items.${key}`);
}

function getKeywords(t: TFunction, key: NavigationPageKey): readonly string[] {
  const value = t(`commandPalette.keywords.${key}`, {
    returnObjects: true
  });

  return Array.isArray(value) ? (value as string[]) : [];
}

// Flat list used by the command palette. Groups expand into their children so
// every destination is a single selectable row (mirrors Naab's root view).
export interface CommandPaletteNavItem {
  id: string;
  icon: Icon;
  label: string;
  href: AppRoute;
  keywords: readonly string[];
  groupLabel: string;
}

export function buildCommandPaletteNavItems(
  t: TFunction
): CommandPaletteNavItem[] {
  const items: CommandPaletteNavItem[] = [];

  for (const link of MAIN_NAVIGATION_LINKS) {
    if ('children' in link) {
      for (const child of link.children) {
        items.push({
          id: `navigation.${child.href}`,
          icon: child.icon,
          label: t(child.labelKey),
          href: child.href,
          keywords: [
            ...getKeywords(t, link.keywordKey),
            ...getKeywords(t, child.keywordKey)
          ],
          groupLabel: t(link.labelKey)
        });
      }
    } else {
      items.push({
        id: `navigation.${link.href}`,
        icon: link.icon,
        label: t(link.labelKey),
        href: link.href,
        keywords: getKeywords(t, link.keywordKey),
        groupLabel: t('commandPalette.groups.navigation')
      });
    }
  }

  for (const link of SETTINGS_NAVIGATION_LINKS) {
    if ('href' in link) {
      items.push({
        id: `navigation.${link.href}`,
        icon: link.icon,
        label: t(link.labelKey),
        href: link.href,
        keywords: getKeywords(t, link.keywordKey),
        groupLabel: t('commandPalette.groups.settings')
      });
    }
  }

  return items;
}
