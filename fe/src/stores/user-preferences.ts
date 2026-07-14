import { create } from 'zustand';
import type { CalendarView, RangeDays } from '@/@types/common/big-calendar';
import type { LanguagePreference } from '@/integrations/i18n/config';
import {
  applyPrimaryColor,
  type ForegroundOverride
} from '@/utils/common/apply-preferences';
import { snapCalendarZoom } from '@/utils/common/calendar-zoom';
import { getSystemTimeZone } from '@/utils/common/time-zone';

export type FontSize = 'small' | 'medium' | 'large';
export type SidebarPreference = 'open' | 'closed' | 'remember';
export type UnsavedChangesBehaviour = 'ask' | 'discard';

export interface AppearancePreferences {
  primaryColor: string;
  foregroundOverride: ForegroundOverride;
  starredColors: string[];
  fontSize: FontSize;
  language: LanguagePreference;
  openCommandPaletteOnType: boolean;
  hideNumbers: boolean;
  showFastAccessButtons: boolean;
  tableRowsFill: boolean;
  sidebar: SidebarPreference;
  unsavedChangesBehaviour: UnsavedChangesBehaviour;
  calendarZoom: number;
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  primaryColor: '#d03f3f',
  foregroundOverride: 'auto',
  starredColors: [],
  fontSize: 'medium',
  language: 'system',
  openCommandPaletteOnType: true,
  hideNumbers: false,
  showFastAccessButtons: false,
  tableRowsFill: false,
  sidebar: 'remember',
  unsavedChangesBehaviour: 'ask',
  calendarZoom: 1
};

const APPEARANCE_STORAGE_KEY = 'diwan:appearance';

function readInitialAppearance(): AppearancePreferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}'
    ) as Partial<AppearancePreferences>;

    return { ...DEFAULT_APPEARANCE, ...stored };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function persistAppearance(appearance: AppearancePreferences): void {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // Storage can be unavailable in privacy-restricted browsing modes.
  }
}

// Must stay in sync with the index.html boot script, which restores the raw
// value from this key before React starts to avoid a font-size flash.
const FONT_SIZE_STORAGE_KEY = 'diwan:font-size';
const FONT_SIZES: FontSize[] = ['small', 'medium', 'large'];

function isFontSize(value: unknown): value is FontSize {
  return typeof value === 'string' && FONT_SIZES.includes(value as FontSize);
}

function readInitialFontSize(): FontSize {
  if (typeof document === 'undefined') {
    return 'medium';
  }

  const restored = document.documentElement.dataset.fontSize;

  return isFontSize(restored) ? restored : 'medium';
}

function applyFontSize(fontSize: FontSize): void {
  document.documentElement.dataset.fontSize = fontSize;

  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
  } catch {
    // Storage can be unavailable in privacy-restricted browsing modes.
  }
}

const SIDEBAR_OPEN_STORAGE_KEY = 'diwan:sidebar-open';

function readInitialSidebarOpen(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

interface UserPreferencesState {
  fontSize: FontSize;
  isSidebarOpen: boolean;
  calendar: {
    view: CalendarView;
    rangeDays: RangeDays;
    timeZone: string;
    timeZoneMode: 'system' | 'manual';
  };
  appearance: AppearancePreferences;
  setFontSize: (fontSize: FontSize) => void;
  setSidebarOpen: (isSidebarOpen: boolean) => void;
  setCalendarView: (view: CalendarView) => void;
  setCalendarRangeDays: (rangeDays: RangeDays) => void;
  setCalendarTimeZone: (timeZone: string, mode?: 'system' | 'manual') => void;
  setAppearance: (appearance: Partial<AppearancePreferences>) => void;
}

const initialAppearance = readInitialAppearance();
applyPrimaryColor(
  initialAppearance.primaryColor,
  initialAppearance.foregroundOverride
);

export const useUserPreferencesStore = create<UserPreferencesState>((set) => ({
  fontSize: initialAppearance.fontSize ?? readInitialFontSize(),
  isSidebarOpen: readInitialSidebarOpen(),
  calendar: {
    view: 'doctor',
    rangeDays: 3,
    timeZone: getSystemTimeZone(),
    timeZoneMode: 'system'
  },
  appearance: initialAppearance,
  setFontSize: (fontSize) => {
    applyFontSize(fontSize);
    set((state) => {
      const appearance = { ...state.appearance, fontSize };
      persistAppearance(appearance);
      return { fontSize, appearance };
    });
  },
  setSidebarOpen: (isSidebarOpen) => {
    try {
      localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(isSidebarOpen));
    } catch {
      // Storage can be unavailable in privacy-restricted browsing modes.
    }
    set({ isSidebarOpen });
  },
  setCalendarView: (view) =>
    set((state) => ({ calendar: { ...state.calendar, view } })),
  setCalendarRangeDays: (rangeDays) =>
    set((state) => ({ calendar: { ...state.calendar, rangeDays } })),
  setCalendarTimeZone: (timeZone, timeZoneMode = 'manual') =>
    set((state) => ({
      calendar: { ...state.calendar, timeZone, timeZoneMode }
    })),
  setAppearance: (appearance) =>
    set((state) => {
      const nextAppearance: AppearancePreferences = {
        ...state.appearance,
        ...appearance,
        ...(appearance.calendarZoom === undefined
          ? {}
          : { calendarZoom: snapCalendarZoom(appearance.calendarZoom) })
      };
      persistAppearance(nextAppearance);
      if (appearance.fontSize !== undefined) {
        applyFontSize(nextAppearance.fontSize);
      }
      if (
        appearance.primaryColor !== undefined ||
        appearance.foregroundOverride !== undefined
      ) {
        applyPrimaryColor(
          nextAppearance.primaryColor,
          nextAppearance.foregroundOverride
        );
      }

      return {
        appearance: nextAppearance,
        fontSize: nextAppearance.fontSize
      };
    })
}));
