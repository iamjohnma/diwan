import { useTranslation } from 'react-i18next';
import { NavigationLink } from '@/components/pages/_app/side-bar/navigation-link';
import { Separator } from '@/components/ui';
import {
  MAIN_NAVIGATION_LINKS,
  SETTINGS_NAVIGATION_LINKS,
  getNavigationLinkKey
} from '@/constants/core/navigation-links';
import type { SidebarHook } from '@/hooks/pages/_app';

interface NavigationLinksProps {
  sidebar: SidebarHook;
  onNavigate?: () => void;
}

export function NavigationLinks(props: NavigationLinksProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('sidebar.navigationLabel')}
      className="mt-1.5 flex flex-col gap-y-2 desktop:mt-4"
    >
      {MAIN_NAVIGATION_LINKS.map((link) => (
        <NavigationLink
          key={getNavigationLinkKey(link)}
          link={link}
          sidebar={props.sidebar}
          onNavigate={props.onNavigate}
        />
      ))}
      <Separator />
      {SETTINGS_NAVIGATION_LINKS.map((link) => (
        <NavigationLink
          key={getNavigationLinkKey(link)}
          link={link}
          sidebar={props.sidebar}
          onNavigate={props.onNavigate}
        />
      ))}
    </nav>
  );
}
