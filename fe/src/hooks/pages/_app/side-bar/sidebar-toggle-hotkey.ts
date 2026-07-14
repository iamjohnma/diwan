import { useCallback } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import type { SidebarHook } from '@/hooks/pages/_app/sidebar';

interface SidebarToggleHotkeyProps {
  sidebar: SidebarHook;
}

const hotkeyOptions = {
  preventDefault: true,
  ignoreInputs: false
} as const;

export function useSidebarToggleHotkey(props: SidebarToggleHotkeyProps) {
  const onToggle = useCallback(
    (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        props.sidebar.isMobile ||
        props.sidebar.isTablet
      ) {
        return;
      }

      event.preventDefault();
      props.sidebar.toggleWithHotkey();
    },
    [
      props.sidebar.isMobile,
      props.sidebar.isTablet,
      props.sidebar.toggleWithHotkey
    ]
  );

  useHotkey({ key: '.', ctrl: true }, onToggle, hotkeyOptions);
}
