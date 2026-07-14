import { XIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { GlobalSearch } from '@/components/pages/_app/side-bar/global-search';
import { NavigationLinks } from '@/components/pages/_app/side-bar/navigation-links';
import { SidebarHeader } from '@/components/pages/_app/side-bar/sidebar-header';
import { Button } from '@/components/ui';
import { type SidebarHook, useSidebar } from '@/hooks/pages/_app';
import { useSidebarToggleHotkey } from '@/hooks/pages/_app/side-bar/sidebar-toggle-hotkey';
import { cn } from '@/lib/utils';

interface DesktopSidebarProps {
  sidebar: SidebarHook;
}

// Rail structure and classes mirror Naab's desktop sidebar (`w-70` open,
// `w-17` icon rail, 300ms width transition, `pt-3 px-3 pb-3` gutter).
function DesktopSidebar(props: DesktopSidebarProps) {
  return (
    <aside
      className={cn(
        'group hidden h-full shrink-0 flex-col overflow-hidden border-e bg-background-surface transition-[width] duration-300 tablet:flex',
        props.sidebar.isOpen ? 'w-70' : 'w-17'
      )}
    >
      <div className="flex flex-1 flex-col gap-y-3 overflow-hidden px-3 pt-3 pb-3">
        <SidebarHeader sidebar={props.sidebar} />
        <GlobalSearch sidebar={props.sidebar} />
        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
          <NavigationLinks sidebar={props.sidebar} />
        </div>
      </div>
    </aside>
  );
}

interface MobileSidebarDrawerProps {
  sidebar: SidebarHook;
}

// Off-canvas drawer for mobile: slides in from the inline-start edge with a
// fading backdrop. The panel stays mounted so both directions animate.
function MobileSidebarDrawer(props: MobileSidebarDrawerProps) {
  const { t } = useTranslation();
  const isOpen = props.sidebar.isMobileOpen;
  const mobileSidebar: SidebarHook = {
    ...props.sidebar,
    isOpen: true,
    toggleOpen: props.sidebar.closeMobile
  };

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        'fixed inset-0 z-50 tablet:hidden',
        isOpen ? '' : 'pointer-events-none'
      )}
    >
      <button
        aria-label={t('sidebar.closeMenu')}
        className={cn(
          'absolute inset-0 bg-background-inverted/40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={props.sidebar.closeMobile}
        tabIndex={isOpen ? 0 : -1}
        type="button"
      />
      <aside
        className={cn(
          'absolute inset-y-0 start-0 flex w-70 flex-col gap-y-3 overflow-hidden border-e bg-background-surface px-3 pt-3 pb-3 shadow-xs transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex shrink-0 items-center gap-x-2">
          <div className="min-w-0 flex-1">
            <SidebarHeader sidebar={mobileSidebar} />
          </div>
          <Button
            aria-label={t('sidebar.closeMenu')}
            className="shrink-0"
            onClick={props.sidebar.closeMobile}
            size="icon"
            variant="ghost"
          >
            <XIcon aria-hidden="true" className="size-5" />
          </Button>
        </div>
        <GlobalSearch
          sidebar={mobileSidebar}
          onOpen={props.sidebar.closeMobile}
        />
        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
          <NavigationLinks
            sidebar={mobileSidebar}
            onNavigate={props.sidebar.closeMobile}
          />
        </div>
      </aside>
    </div>
  );
}

export function Sidebar() {
  const sidebar = useSidebar();
  useSidebarToggleHotkey({ sidebar });

  return (
    <>
      <DesktopSidebar sidebar={sidebar} />
      <MobileSidebarDrawer sidebar={sidebar} />
    </>
  );
}
