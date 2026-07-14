import * as React from 'react';
import { createPortal } from 'react-dom';
import { useHotkey } from '@tanstack/react-hotkeys';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import {
  resolveDynamicPopoverIsLayerVisible,
  useDynamicPopover
} from '@/components/ui/dynamic-popover/dynamic-popover-context';
import { useTopFloatingLayerDismiss } from '@/components/ui/floating-layer';
import { useDirection } from '@/hooks/common';
import { cn } from '@/lib/utils';

type PanelId = string;

interface DynamicPopoverPanelProps {
  panelId: PanelId;
  children: React.ReactNode;
  className?: string;
  /**
   * Pre-mounts this panel in a hidden measuring layer once the popover has
   * settled open, so the first switch to it animates without paying the
   * mount + measure cost mid-animation. Only enable for panels whose content
   * has no mount side effects like autofocus.
   */
  warmup?: boolean;
}

export function DynamicPopoverPanel(props: DynamicPopoverPanelProps) {
  return <>{props.children}</>;
}

interface DynamicPopoverContentProps {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  className?: string;
}

export function DynamicPopoverContent(props: DynamicPopoverContentProps) {
  const context = useDynamicPopover();

  if (context.isMobile) {
    return <DynamicPopoverMobileContent props={props} />;
  }

  return <DynamicPopoverDesktopContent props={props} />;
}

const CONTENT_VARIANTS = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * 50,
    filter: direction === 0 ? 'blur(0px)' : 'blur(4px)'
  }),
  animate: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)'
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction * -50,
    filter: direction === 0 ? 'blur(0px)' : 'blur(4px)'
  })
};

const CONTENT_TRANSITION = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number]
};

const INSTANT_TRANSITION = {
  duration: 0
} as const;

const ENTER_Y_OFFSET = -6;
// Wait for the open animation to finish before warm-mounting inactive panels,
// so the warmup work never competes with the entrance frames.
const PANEL_WARMUP_DELAY_MS = 300;
const FLOATING_LAYER_IGNORE_SELECTOR = [
  '[data-slot^="context-menu-"]',
  '[data-dms-floating-overlay]',
  '[data-slot="dialog-content"]',
  '[data-slot="dialog-floating-layer"]',
  '[data-slot="dialog-overlay"]',
  '[data-slot="menu-positioner"]',
  '[data-slot="select-content"]',
  '[data-slot="select-content-mobile"]'
].join(',');

// A dialog's overlay/content/floating-layer are siblings inside the shared
// `dialog-layer` wrapper, so none of them ever `contains()` a trigger that
// lives in the dialog content. Judge dialog clicks by the whole dialog layer
// instead — otherwise a dynamic popover opened from INSIDE a dialog could
// never be dismissed by clicking the gray overlay: the click matched the
// ignore selector and was misread as a foreign layer, so nothing closed.
// Dialogs opened ABOVE the popover (their layer does not contain the trigger)
// are still ignored so the popover stays open behind them.
function resolveIgnoredFloatingLayerScope(layer: Element) {
  if (
    layer.matches(
      '[data-slot="dialog-overlay"], [data-slot="dialog-content"], [data-slot="dialog-floating-layer"]'
    )
  ) {
    return layer.closest('[data-slot="dialog-layer"]') ?? layer;
  }

  return layer;
}

function extractPanels(
  children: React.ReactNode
): React.ReactElement<DynamicPopoverPanelProps>[] {
  return React.Children.toArray(children).filter(
    (child): child is React.ReactElement<DynamicPopoverPanelProps> =>
      React.isValidElement(child) && child.type === DynamicPopoverPanel
  );
}

function calculatePosition(
  triggerRect: DOMRect,
  contentWidth: number,
  align: 'start' | 'center' | 'end',
  sideOffset: number,
  isRTL: boolean
): { left: number; top: number } {
  let left: number;

  if (align === 'end') {
    left = isRTL ? triggerRect.left : triggerRect.right - contentWidth;
  } else if (align === 'start') {
    left = isRTL ? triggerRect.right - contentWidth : triggerRect.left;
  } else {
    left = triggerRect.left + triggerRect.width / 2 - contentWidth / 2;
  }

  left = Math.max(8, Math.min(left, window.innerWidth - contentWidth - 8));

  return { left, top: triggerRect.bottom + sideOffset };
}

function measurePanelSize(panelElement: HTMLDivElement): {
  width: number;
  height: number;
} {
  const rect = panelElement.getBoundingClientRect();

  return {
    width: Math.ceil(Math.max(rect.width, panelElement.scrollWidth)),
    height: Math.ceil(Math.max(rect.height, panelElement.scrollHeight))
  };
}

interface PanelLayout {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface MeasuredPanelLayout extends PanelLayout {
  panelId: PanelId;
}

interface PanelAnimationItem {
  key: string;
  panelId: PanelId;
  direction: number;
  className?: string;
  children: React.ReactNode;
  phase: 'active' | 'exiting' | 'measuring';
}

interface DesktopContentInternalProps {
  props: DynamicPopoverContentProps;
}

interface DynamicPopoverWarmupPanelProps {
  panelId: PanelId;
  className?: string;
  children: React.ReactNode;
  onMeasure: (panelId: PanelId, node: HTMLDivElement) => void;
}

function DynamicPopoverWarmupPanel(props: DynamicPopoverWarmupPanelProps) {
  const { panelId, onMeasure } = props;
  const nodeRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }

    onMeasure(panelId, node);

    const resizeObserver = new ResizeObserver(() => {
      onMeasure(panelId, node);
    });
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [panelId, onMeasure]);

  return (
    <div ref={nodeRef} className={props.className}>
      {props.children}
    </div>
  );
}

function DynamicPopoverDesktopContent(
  internalProps: DesktopContentInternalProps
) {
  const { state, triggersRef, close } = useDynamicPopover();
  const textDirection = useDirection();
  const isRTL = textDirection === 'rtl';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activePanelRef = React.useRef<HTMLDivElement | null>(null);
  const activePanelIdRef = React.useRef<PanelId | null>(null);
  const activePanelElementRef =
    React.useRef<React.ReactElement<DynamicPopoverPanelProps> | null>(null);
  const panelSnapshotsRef = React.useRef<
    Map<PanelId, React.ReactElement<DynamicPopoverPanelProps>>
  >(new Map());
  const panelLayoutCacheRef = React.useRef<Map<PanelId, PanelLayout>>(
    new Map()
  );
  const panelAnimationSequenceRef = React.useRef(0);
  const [panelAnimationItems, setPanelAnimationItems] = React.useState<
    PanelAnimationItem[]
  >([]);
  const [measuredLayout, setMeasuredLayout] =
    React.useState<MeasuredPanelLayout | null>(null);
  const [isLayoutReady, setIsLayoutReady] = React.useState(false);
  const [isWarmupReady, setIsWarmupReady] = React.useState(false);
  const hasBeenMeasured = React.useRef(false);
  const hasCompletedInitialPlacement = React.useRef(false);
  const resizeRafRef = React.useRef<number | null>(null);
  const previousActivePanelRef = React.useRef<PanelId | null>(null);
  const containerLayoutTransitionRef = React.useRef<{
    from: PanelId;
    to: PanelId;
  } | null>(null);

  const align = internalProps.props.align ?? 'end';
  const sideOffset = internalProps.props.sideOffset ?? 0;
  const isOpen = resolveDynamicPopoverIsLayerVisible(state);
  const panels = extractPanels(internalProps.props.children);
  const activePanelElement = panels.find(
    (p) => p.props.panelId === state.activePanel
  );

  activePanelElementRef.current = activePanelElement ?? null;
  if (state.activePanel && activePanelElement) {
    panelSnapshotsRef.current.set(state.activePanel, activePanelElement);
  }

  const updateLayout = React.useCallback(() => {
    if (!state.activePanel) {
      return;
    }

    const activePanel = state.activePanel;

    if (activePanelIdRef.current !== activePanel) {
      return;
    }

    const triggerEntry = triggersRef.current.get(activePanel);
    if (!triggerEntry?.ref.current) {
      return;
    }

    const panelElement = activePanelRef.current;
    if (!panelElement) {
      return;
    }

    const nextSize = measurePanelSize(panelElement);
    const nextWidth = nextSize.width;
    const nextHeight = nextSize.height;

    if (nextWidth <= 0 || nextHeight <= 0) {
      return;
    }

    const triggerRect = triggerEntry.ref.current.getBoundingClientRect();
    const nextPosition = calculatePosition(
      triggerRect,
      nextWidth,
      align,
      sideOffset,
      isRTL
    );

    const nextLayout: MeasuredPanelLayout = {
      panelId: activePanel,
      width: nextWidth,
      height: nextHeight,
      left: nextPosition.left,
      top: nextPosition.top
    };

    panelLayoutCacheRef.current.set(activePanel, {
      width: nextLayout.width,
      height: nextLayout.height,
      left: nextLayout.left,
      top: nextLayout.top
    });

    setMeasuredLayout((previous) => {
      if (
        previous &&
        previous.panelId === nextLayout.panelId &&
        previous.width === nextLayout.width &&
        previous.height === nextLayout.height &&
        previous.left === nextLayout.left &&
        previous.top === nextLayout.top
      ) {
        return previous;
      }

      return nextLayout;
    });
    setPanelAnimationItems((previousItems) => {
      let didPromoteMeasuringItem = false;
      const nextItems = previousItems.map((item) => {
        if (item.phase !== 'measuring' || item.panelId !== activePanel) {
          return item;
        }

        didPromoteMeasuringItem = true;

        return {
          ...item,
          phase: 'active' as const
        };
      });

      return didPromoteMeasuringItem ? nextItems : previousItems;
    });
    if (!isLayoutReady) {
      setIsLayoutReady(true);
      requestAnimationFrame(() => {
        hasCompletedInitialPlacement.current = true;
      });
    }
    hasBeenMeasured.current = true;
  }, [state.activePanel, triggersRef, align, sideOffset, isRTL, isLayoutReady]);

  const scheduleLayoutUpdate = React.useCallback(() => {
    if (!state.activePanel) {
      return;
    }

    const panelElement = activePanelRef.current;
    if (!panelElement) {
      return;
    }

    if (activePanelIdRef.current !== state.activePanel) {
      return;
    }

    if (resizeRafRef.current !== null) {
      window.cancelAnimationFrame(resizeRafRef.current);
    }

    resizeRafRef.current = window.requestAnimationFrame(() => {
      resizeRafRef.current = null;
      updateLayout();
    });
  }, [state.activePanel, updateLayout]);

  const cacheWarmupPanelLayout = React.useCallback(
    (panelId: PanelId, node: HTMLDivElement) => {
      if (panelId === activePanelIdRef.current) {
        return;
      }

      const size = measurePanelSize(node);
      if (size.width <= 0 || size.height <= 0) {
        return;
      }

      const triggerElement = triggersRef.current.get(panelId)?.ref.current;
      if (!triggerElement) {
        return;
      }

      const position = calculatePosition(
        triggerElement.getBoundingClientRect(),
        size.width,
        align,
        sideOffset,
        isRTL
      );

      panelLayoutCacheRef.current.set(panelId, {
        width: size.width,
        height: size.height,
        left: position.left,
        top: position.top
      });
    },
    [triggersRef, align, sideOffset, isRTL]
  );

  React.useEffect(() => {
    if (!state.activePanel) {
      setIsWarmupReady(false);

      return;
    }

    if (isWarmupReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsWarmupReady(true);
    }, PANEL_WARMUP_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [state.activePanel, isWarmupReady]);

  const activePanelCallbackRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      const panelId = state.activePanel;

      if (node && panelId) {
        activePanelIdRef.current = panelId;
        activePanelRef.current = node;
        updateLayout();

        return;
      }

      if (panelId && activePanelIdRef.current === panelId) {
        activePanelIdRef.current = null;
        activePanelRef.current = null;
      }
    },
    [state.activePanel, updateLayout]
  );

  React.useLayoutEffect(() => {
    const currentPanel = state.activePanel;
    const currentPanelElement = activePanelElementRef.current;

    setPanelAnimationItems((previousItems) => {
      const previousActiveItem = previousItems.find(
        (item) => item.phase === 'active' && item.panelId !== currentPanel
      );
      const exitingItems: PanelAnimationItem[] = [];

      if (previousActiveItem) {
        const item = previousActiveItem;
        const snapshot = panelSnapshotsRef.current.get(item.panelId);

        exitingItems.push({
          ...item,
          direction: state.direction,
          className: snapshot?.props.className ?? item.className,
          children: snapshot?.props.children ?? item.children,
          phase: 'exiting'
        });
      }

      if (!currentPanel || !currentPanelElement) {
        return [];
      }

      panelAnimationSequenceRef.current += 1;
      const shouldMeasureBeforeEnter =
        state.previousPanel !== null &&
        state.previousPanel !== currentPanel &&
        !panelLayoutCacheRef.current.has(currentPanel);

      return [
        ...exitingItems,
        {
          key: `${currentPanel}:${panelAnimationSequenceRef.current}`,
          panelId: currentPanel,
          direction: state.direction,
          className: currentPanelElement.props.className,
          children: currentPanelElement.props.children,
          phase: shouldMeasureBeforeEnter
            ? ('measuring' as const)
            : ('active' as const)
        }
      ];
    });
  }, [state.activePanel, state.direction, state.previousPanel]);

  const handlePanelAnimationComplete = React.useCallback(
    (item: PanelAnimationItem) => {
      if (item.phase !== 'exiting') {
        return;
      }

      setPanelAnimationItems((previousItems) =>
        previousItems.filter((previousItem) => previousItem.key !== item.key)
      );
    },
    []
  );

  React.useEffect(() => {
    const previousPanel = previousActivePanelRef.current;
    const currentPanel = state.activePanel;

    if (!currentPanel) {
      setIsLayoutReady(false);
      setMeasuredLayout(null);
      panelLayoutCacheRef.current.clear();
      hasBeenMeasured.current = false;
      hasCompletedInitialPlacement.current = false;
      activePanelIdRef.current = null;
      activePanelRef.current = null;
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    } else if (!previousPanel) {
      setIsLayoutReady(false);
    }

    previousActivePanelRef.current = currentPanel;
  }, [state.activePanel]);

  React.useEffect(() => {
    if (!isOpen) {
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }

      return;
    }

    const panelElement = activePanelRef.current;
    if (!panelElement) {
      return;
    }

    scheduleLayoutUpdate();

    const resizeObserver = new ResizeObserver(() => {
      scheduleLayoutUpdate();
    });
    const mutationObserver = new MutationObserver(() => {
      scheduleLayoutUpdate();
    });

    resizeObserver.observe(panelElement);
    mutationObserver.observe(panelElement, {
      childList: true,
      characterData: true,
      subtree: true
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, [isOpen, scheduleLayoutUpdate]);

  React.useEffect(() => {
    if (!state.activePanel) {
      return;
    }

    window.addEventListener('resize', scheduleLayoutUpdate);
    window.addEventListener('scroll', scheduleLayoutUpdate, true);

    return () => {
      window.removeEventListener('resize', scheduleLayoutUpdate);
      window.removeEventListener('scroll', scheduleLayoutUpdate, true);
    };
  }, [state.activePanel, scheduleLayoutUpdate]);

  useHotkey(
    'Escape',
    () => {
      close();
    },
    {
      enabled: resolveDynamicPopoverIsLayerVisible(state),
      preventDefault: true,
      ignoreInputs: false,
      conflictBehavior: 'allow'
    }
  );

  useTopFloatingLayerDismiss({
    enabled: isOpen,
    getElements: () => [
      containerRef.current,
      ...Array.from(triggersRef.current.values(), (entry) => entry.ref.current)
    ],
    close,
    ignoreOutsideEvent: (event) => {
      if (!(event.target instanceof Element)) {
        return false;
      }
      const layer = event.target.closest(FLOATING_LAYER_IGNORE_SELECTOR);
      if (!layer) {
        return false;
      }
      const scope = resolveIgnoredFloatingLayerScope(layer);

      return !Array.from(triggersRef.current.values()).some((entry) => {
        const trigger = entry.ref.current;

        return trigger !== null && scope.contains(trigger);
      });
    }
  });

  const cachedActiveLayout = state.activePanel
    ? panelLayoutCacheRef.current.get(state.activePanel)
    : null;
  const cachedPreviousLayout = state.previousPanel
    ? panelLayoutCacheRef.current.get(state.previousPanel)
    : null;
  const fallbackActiveLayout =
    state.activePanel &&
    state.previousPanel !== null &&
    state.previousPanel !== state.activePanel &&
    cachedPreviousLayout
      ? { panelId: state.activePanel, ...cachedPreviousLayout }
      : null;
  const activeLayout =
    measuredLayout?.panelId === state.activePanel
      ? measuredLayout
      : state.activePanel && cachedActiveLayout
        ? { panelId: state.activePanel, ...cachedActiveLayout }
        : fallbackActiveLayout;
  const layoutLeft = activeLayout?.left ?? 0;
  const layoutTop = activeLayout?.top ?? 0;
  const switchingFromPanel = previousActivePanelRef.current;
  const isStartingPanelSwitch =
    state.activePanel !== null &&
    switchingFromPanel !== null &&
    switchingFromPanel !== state.activePanel;

  if (!state.activePanel) {
    containerLayoutTransitionRef.current = null;
  } else if (isStartingPanelSwitch) {
    containerLayoutTransitionRef.current = {
      from: switchingFromPanel,
      to: state.activePanel
    };
  }

  const shouldAnimateSize =
    hasBeenMeasured.current &&
    activeLayout !== null &&
    activeLayout.panelId === state.activePanel;
  const shouldAnimateContainerLayout =
    shouldAnimateSize &&
    hasCompletedInitialPlacement.current &&
    containerLayoutTransitionRef.current?.to === state.activePanel;
  const containerLayoutTransitionConfig = shouldAnimateContainerLayout
    ? CONTENT_TRANSITION
    : INSTANT_TRANSITION;
  const warmupPanels =
    isWarmupReady && state.activePanel
      ? panels.filter(
          (panel) =>
            panel.props.warmup === true &&
            panel.props.panelId !== state.activePanel &&
            !panelAnimationItems.some(
              (item) => item.panelId === panel.props.panelId
            )
        )
      : [];

  return createPortal(
    <>
      <AnimatePresence>
        {state.activePanel && activePanelElement && (
          <motion.div
            ref={containerRef}
            key="dynamic-popover-container"
            data-dms-floating-overlay=""
            className={cn(
              'fixed z-50 box-content overflow-hidden rounded-xl border border-border-default bg-background-base shadow-lg',
              internalProps.props.className
            )}
            initial={{
              opacity: 0,
              y: ENTER_Y_OFFSET,
              left: layoutLeft,
              top: layoutTop
            }}
            animate={{
              opacity: isLayoutReady && !state.isTemporarilyHidden ? 1 : 0,
              y: isLayoutReady ? 0 : ENTER_Y_OFFSET,
              left: layoutLeft,
              top: layoutTop,
              ...(shouldAnimateSize
                ? { width: activeLayout.width, height: activeLayout.height }
                : {})
            }}
            exit={{
              opacity: 0,
              y: 0
            }}
            transition={{
              opacity: { duration: 0.18, ease: CONTENT_TRANSITION.ease },
              y: { duration: 0.18, ease: CONTENT_TRANSITION.ease },
              left: containerLayoutTransitionConfig,
              top: containerLayoutTransitionConfig,
              width: containerLayoutTransitionConfig,
              height: containerLayoutTransitionConfig
            }}
            style={{
              ...(!shouldAnimateSize ? { width: 'auto', height: 'auto' } : {}),
              ...(!isLayoutReady || state.isTemporarilyHidden
                ? { pointerEvents: 'none' as const }
                : { pointerEvents: 'auto' })
            }}
            onAnimationComplete={() => {
              if (
                containerLayoutTransitionRef.current?.to === state.activePanel
              ) {
                containerLayoutTransitionRef.current = null;
              }
            }}
          >
            <div className="relative">
              {panelAnimationItems.map((item) => {
                const isActiveItem =
                  item.phase !== 'exiting' &&
                  item.panelId === state.activePanel;
                const panelElementForItem = isActiveItem
                  ? activePanelElement
                  : null;
                const shouldMeasureItem = item.phase === 'measuring';

                return (
                  <motion.div
                    key={item.key}
                    ref={isActiveItem ? activePanelCallbackRef : undefined}
                    custom={item.direction}
                    className={cn(
                      panelElementForItem?.props.className ?? item.className,
                      item.phase === 'exiting' && 'absolute inset-x-0 top-0',
                      shouldMeasureItem && 'pointer-events-none'
                    )}
                    variants={CONTENT_VARIANTS}
                    initial={item.phase === 'active' ? 'initial' : false}
                    animate={
                      item.phase === 'exiting'
                        ? 'exit'
                        : shouldMeasureItem
                          ? 'initial'
                          : 'animate'
                    }
                    transition={
                      shouldMeasureItem
                        ? INSTANT_TRANSITION
                        : CONTENT_TRANSITION
                    }
                    onAnimationComplete={() =>
                      handlePanelAnimationComplete(item)
                    }
                  >
                    {panelElementForItem?.props.children ?? item.children}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {warmupPanels.length > 0 && (
        <div
          inert
          data-dms-popover-warmup=""
          className="invisible fixed start-0 top-0 -z-10 flex flex-col items-start"
        >
          {warmupPanels.map((panel) => (
            <DynamicPopoverWarmupPanel
              key={panel.props.panelId}
              panelId={panel.props.panelId}
              className={panel.props.className}
              onMeasure={cacheWarmupPanelLayout}
            >
              {panel.props.children}
            </DynamicPopoverWarmupPanel>
          ))}
        </div>
      )}
    </>,
    document.body
  );
}

interface MobileContentInternalProps {
  props: DynamicPopoverContentProps;
}

function DynamicPopoverMobileContent(
  internalProps: MobileContentInternalProps
) {
  const { t } = useTranslation();
  const { state, close } = useDynamicPopover();

  const [stashedPanelId, setStashedPanelId] = React.useState<string | null>(
    null
  );
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useLayoutEffect(() => {
    if (state.activePanel !== null) {
      setStashedPanelId(state.activePanel);
      setDrawerOpen(true);
    } else {
      setDrawerOpen(false);
    }
  }, [state.activePanel]);

  const handleAnimationEnd = React.useCallback((openAtEnd: boolean) => {
    if (!openAtEnd) {
      setStashedPanelId(null);
    }
  }, []);

  const panels = extractPanels(internalProps.props.children);
  const panelIdToRender = state.activePanel ?? stashedPanelId;
  const panelElementToRender = panels.find(
    (p) => p.props.panelId === panelIdToRender
  );

  return (
    <Drawer
      open={drawerOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      <DrawerContent
        side="bottom"
        fitContent
        accessibilityTitle={t('common.drawerAccessibility.dynamicPopoverTitle')}
        accessibilityDescription={t(
          'common.drawerAccessibility.dynamicPopoverDescription'
        )}
        className={cn(
          'w-full max-w-none p-0',
          state.isTemporarilyHidden && 'pointer-events-none opacity-0'
        )}
      >
        {panelElementToRender?.props.children}
      </DrawerContent>
    </Drawer>
  );
}
