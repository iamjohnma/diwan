import { useCallback } from 'react';
import { useBreakpoint } from '@/hooks/common';
import { useSidebarNavStore } from '@/stores/sidebar-nav';
import { useUserPreferencesStore } from '@/stores/user-preferences';

export interface SidebarHook {
  isOpen: boolean;
  isMobile: boolean;
  isMobileOpen: boolean;
  isTablet: boolean;
  canExpand: boolean;
  toggleOpen: () => void;
  toggleWithHotkey: () => void;
  openMobile: () => void;
  closeMobile: () => void;
}

// Desktop open/collapsed state persists as a user preference; tablets always
// collapse to the icon rail; mobile uses the drawer instead.
export function useSidebar(): SidebarHook {
  const breakpoint = useBreakpoint();
  const isSidebarOpen = useUserPreferencesStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useUserPreferencesStore(
    (state) => state.setSidebarOpen
  );
  const isMobileOpen = useSidebarNavStore((state) => state.isMobileOpen);
  const openMobile = useSidebarNavStore((state) => state.openMobile);
  const closeMobile = useSidebarNavStore((state) => state.closeMobile);
  const isOpen = breakpoint.isTablet ? false : isSidebarOpen;
  const toggleOpen = useCallback(() => {
    setSidebarOpen(!isOpen);
  }, [isOpen, setSidebarOpen]);

  return {
    isOpen,
    isMobile: breakpoint.isMobile,
    isMobileOpen,
    isTablet: breakpoint.isTablet,
    canExpand: !isOpen,
    toggleOpen,
    toggleWithHotkey: toggleOpen,
    openMobile,
    closeMobile
  };
}
