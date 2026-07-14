import { useEffect, useState } from 'react';
import { CommandPaletteFull } from '@/components/core/command-palette/command-palette-full';
import { useDialogsStore } from '@/stores/dialogs/store';

export function CommandPaletteManager() {
  const isOpen = useDialogsStore((state) => state.isOpen('commandPalette'));
  const [mounted, setMounted] = useState(isOpen);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setMounted(isOpen),
      isOpen ? 0 : 220
    );

    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  return mounted ? <CommandPaletteFull /> : null;
}
