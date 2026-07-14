import type { ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { cn } from '@/lib/utils';
import { useDialogsStore } from '@/stores/dialogs/store';

export function PaletteLayout(props: {
  children: ReactNode;
  defaultView: boolean;
}) {
  const { t } = useTranslation();
  const breakpoint = useBreakpoint();
  const isOpen = useDialogsStore((state) => state.isOpen('commandPalette'));
  const close = useCallback(() => {
    useDialogsStore.getState().close('commandPalette');
  }, []);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || breakpoint.isMobile) return;
    const attachedAt = performance.now();
    const outside = (event: PointerEvent) => {
      if (
        event.timeStamp > attachedAt &&
        !contentRef.current?.contains(event.target as Node)
      )
        close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [breakpoint.isMobile, close, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const focus = () =>
      contentRef.current
        ?.querySelector<HTMLInputElement>('input')
        ?.focus({ preventScroll: true });
    focus();
    const frame = window.requestAnimationFrame(focus);
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  if (breakpoint.isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && close()}>
        <DrawerContent
          accessibilityDescription={t('commandPalette.description')}
          accessibilityTitle={t('commandPalette.title')}
          className="z-[111] gap-0 rounded-t-2xl border-border-default bg-background-base p-0 shadow-2xl"
          fitContent
          overlayClassName="z-[110]"
          ref={contentRef}
          side="bottom"
        >
          <div className="flex w-full flex-col">{props.children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div
      aria-hidden={!isOpen}
      className="pointer-events-none fixed inset-0 z-[110]"
      inert={!isOpen}
    >
      <div
        className="command-palette-overlay-motion pointer-events-auto fixed inset-0 bg-black/40 backdrop-blur-[2px] data-[state=closed]:pointer-events-none"
        data-state={isOpen ? 'open' : 'closed'}
      />
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          aria-modal="true"
          className={cn(
            'command-palette-surface-motion pointer-events-auto flex max-h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border-default bg-background-base shadow-2xl data-[state=closed]:pointer-events-none',
            props.defaultView && 'min-h-80'
          )}
          data-reduced-motion={undefined}
          data-state={isOpen ? 'open' : 'closed'}
          ref={contentRef}
          role="dialog"
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}
