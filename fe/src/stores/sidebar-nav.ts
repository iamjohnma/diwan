import { create } from 'zustand';

interface SidebarNavState {
  expandedKeys: string[];
  isMobileOpen: boolean;
  toggleExpandedKey: (key: string) => void;
  openMobile: () => void;
  closeMobile: () => void;
}

export const useSidebarNavStore = create<SidebarNavState>((set) => ({
  expandedKeys: [],
  isMobileOpen: false,
  toggleExpandedKey: (key) =>
    set((state) => ({
      expandedKeys: state.expandedKeys.includes(key)
        ? state.expandedKeys.filter((expandedKey) => expandedKey !== key)
        : [...state.expandedKeys, key]
    })),
  openMobile: () => set({ isMobileOpen: true }),
  closeMobile: () => set({ isMobileOpen: false })
}));
