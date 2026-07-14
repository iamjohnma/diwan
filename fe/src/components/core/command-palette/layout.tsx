import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useDialogsStore } from '@/stores/dialogs/store';
import { isCommandPaletteRoot } from '@/utils/core/command-palette/open';

interface CommandPaletteLayoutProps {
  children: ReactNode;
  isDefaultRootView: boolean;
}

// Desktop overlay + content panel. Animations are CSS (opacity/scale) so we
// stay free of motion/vaul while matching Naab's visual structure.
export function CommandPaletteLayout(props: CommandPaletteLayoutProps) {
  const isOpen = useDialogsStore((state) => state.isOpen('commandPalette'));
  const closeCommandPalette = useCallback(() => {
    useDialogsStore.getState().close('commandPalette');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (isCommandPaletteRoot(event.target)) {
        return;
      }
      closeCommandPalette();
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [closeCommandPalette, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center px-app-md',
        isOpen ? '' : 'pointer-events-none'
      )}
      style={{ paddingBlockStart: '12vh' }}
    >
      <div
        className={cn(
          'absolute inset-0 bg-background-inverted/40 transition-opacity duration-150',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        className={cn(
          'relative flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border-default bg-background-surface shadow-xs transition-[opacity,transform] duration-150',
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
          props.isDefaultRootView ? 'min-h-80' : undefined
        )}
        style={{ maxHeight: '70vh' }}
        data-diwan-command-palette-root="true"
      >
        {props.children}
      </div>
    </div>
  );
}
