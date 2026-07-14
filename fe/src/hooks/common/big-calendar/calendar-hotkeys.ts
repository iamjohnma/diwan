import { type RefObject, useCallback, useMemo } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import type { CalendarView, RangeDays } from '@/@types/common/big-calendar';
import { VIEWPORT_SELECTOR } from '@/constants/common/big-calendar';

interface CalendarHotkeysPropsHook {
  enabled?: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  view: CalendarView;
  isFullScreen: boolean | undefined;
  onFullScreenToggle: (() => void) | undefined;
  getIsEventInteractionActive: () => boolean;
  scrollStepPx: number;
  hasEscapeCancelAction: boolean;
  cancelEscapeCancelAction: () => boolean;
  goToToday: () => void;
  setRangeDays: (days: RangeDays) => void;
  hasSelection: boolean;
  deleteSelectedEvents: () => void;
}

const INPUT_HOTKEY_OPTIONS = { ignoreInputs: true } as const;

const ESCAPE_HOTKEY_OPTIONS = {
  preventDefault: false,
  stopPropagation: false,
  conflictBehavior: 'allow'
} as const;

const RANGE_DAY_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const;
const ARROW_SCROLL_KEYS = ['arrowup', 'arrowdown'] as const;

type RangeDayHotkeyIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function runUnlessPrevented(action: () => void) {
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }
    action();
  };
}

function useRangeDayHotkeyAt(
  index: RangeDayHotkeyIndex,
  rangeEnabled: boolean,
  view: CalendarView,
  setRangeDays: (days: RangeDays) => void
) {
  const days = (index + 1) as RangeDays;

  useHotkey(
    RANGE_DAY_KEYS[index],
    (event: KeyboardEvent) => {
      if (event.defaultPrevented || view !== 'range') {
        return;
      }
      setRangeDays(days);
    },
    {
      enabled: rangeEnabled,
      ...INPUT_HOTKEY_OPTIONS
    }
  );
}

function useRangeDayHotkeys(
  enabled: boolean,
  view: CalendarView,
  setRangeDays: (days: RangeDays) => void
) {
  const rangeEnabled = enabled && view === 'range';

  useRangeDayHotkeyAt(0, rangeEnabled, view, setRangeDays);
  useRangeDayHotkeyAt(1, rangeEnabled, view, setRangeDays);
  useRangeDayHotkeyAt(2, rangeEnabled, view, setRangeDays);
  useRangeDayHotkeyAt(3, rangeEnabled, view, setRangeDays);
  useRangeDayHotkeyAt(4, rangeEnabled, view, setRangeDays);
  useRangeDayHotkeyAt(5, rangeEnabled, view, setRangeDays);
  useRangeDayHotkeyAt(6, rangeEnabled, view, setRangeDays);
}

function getCalendarVerticalScrollViewport(
  root: HTMLDivElement | null
): HTMLElement | null {
  if (!root) {
    return null;
  }

  for (const viewport of root.querySelectorAll<HTMLElement>(
    VIEWPORT_SELECTOR
  )) {
    if (viewport.scrollHeight > viewport.clientHeight) {
      return viewport;
    }
  }

  return null;
}

export function useCalendarHotkeys(props: CalendarHotkeysPropsHook) {
  const {
    enabled = true,
    rootRef,
    view,
    isFullScreen,
    onFullScreenToggle,
    getIsEventInteractionActive,
    scrollStepPx,
    hasEscapeCancelAction,
    cancelEscapeCancelAction,
    goToToday,
    setRangeDays,
    hasSelection,
    deleteSelectedEvents
  } = props;

  const reservedKeys = useMemo(
    () =>
      [
        'f',
        't',
        ...ARROW_SCROLL_KEYS,
        ...(view === 'range' ? RANGE_DAY_KEYS : [])
      ].join(','),
    [view]
  );

  const scrollCalendarVertically = useCallback(
    (event: KeyboardEvent, direction: -1 | 1) => {
      if (event.defaultPrevented) {
        return;
      }

      const viewport = getCalendarVerticalScrollViewport(rootRef.current);
      if (!viewport) {
        return;
      }

      const maxScrollTop = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight
      );
      const nextScrollTop = Math.max(
        0,
        Math.min(maxScrollTop, viewport.scrollTop + direction * scrollStepPx)
      );

      event.preventDefault();
      event.stopPropagation();

      viewport.scrollTo({
        top: nextScrollTop,
        behavior: event.repeat ? 'auto' : 'smooth'
      });
    },
    [rootRef, scrollStepPx]
  );

  useHotkey(
    'Escape',
    (event: KeyboardEvent) => {
      if (cancelEscapeCancelAction()) {
        event.preventDefault();
        event.stopPropagation();

        return;
      }

      if (getIsEventInteractionActive() || !isFullScreen) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onFullScreenToggle?.();
    },
    {
      enabled: enabled && (isFullScreen || hasEscapeCancelAction),
      ignoreInputs: false,
      ...ESCAPE_HOTKEY_OPTIONS
    }
  );

  useHotkey(
    'F',
    runUnlessPrevented(() => onFullScreenToggle?.()),
    { enabled, ...INPUT_HOTKEY_OPTIONS }
  );
  useHotkey('T', runUnlessPrevented(goToToday), {
    enabled,
    ...INPUT_HOTKEY_OPTIONS
  });
  useHotkey(
    'ArrowUp',
    (event: KeyboardEvent) => {
      if (getIsEventInteractionActive()) return;
      scrollCalendarVertically(event, -1);
    },
    {
      enabled,
      ...INPUT_HOTKEY_OPTIONS
    }
  );
  useHotkey(
    'ArrowDown',
    (event: KeyboardEvent) => {
      if (getIsEventInteractionActive()) return;
      scrollCalendarVertically(event, 1);
    },
    {
      enabled,
      ...INPUT_HOTKEY_OPTIONS
    }
  );

  // Windows-style "delete the selected items". Backspace is included so the
  // Mac Delete key works too. Only active while something is selected.
  const deleteSelectionEnabled = enabled && hasSelection;
  useHotkey('Delete', runUnlessPrevented(deleteSelectedEvents), {
    enabled: deleteSelectionEnabled,
    ...INPUT_HOTKEY_OPTIONS
  });
  useHotkey('Backspace', runUnlessPrevented(deleteSelectedEvents), {
    enabled: deleteSelectionEnabled,
    ...INPUT_HOTKEY_OPTIONS
  });

  useRangeDayHotkeys(enabled, view, setRangeDays);

  return enabled ? reservedKeys : undefined;
}
