'use client';

import * as React from 'react';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { hapticTap } from '@/utils/common/haptics';
import {
  getPressPreviewIndicatorPosition,
  isPointWithinRect
} from '@/utils/common/tab-indicator-preview';

type TabsVariant = 'default' | 'underline';

type TabsSize = 'default' | 'dense';

const TabsSizeContext = React.createContext<TabsSize>('default');

interface IndicatorPosition {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom: number;
}

const INDICATOR_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35
};
const POINTER_MOVE_CANCEL_THRESHOLD_PX = 10;
const POINTER_UP_COMMIT_GRACE_MS = 180;

function Tabs(props: TabsPrimitive.Root.Props) {
  const { className, ...rootProps } = props;

  return (
    <TabsPrimitive.Root
      className={cn(
        'flex flex-col gap-2 data-[orientation=vertical]:flex-row',
        className
      )}
      data-slot="tabs"
      {...rootProps}
    />
  );
}

function TabsList(
  props: TabsPrimitive.List.Props & {
    variant?: TabsVariant;
    animated?: boolean;
    size?: TabsSize;
  }
) {
  const {
    variant = 'default',
    animated = true,
    size = 'default',
    className,
    children,
    ...listProps
  } = props;

  const listRef = React.useRef<HTMLDivElement>(null);
  const [indicatorPosition, setIndicatorPosition] =
    React.useState<IndicatorPosition | null>(null);
  const [previewIndicatorPosition, setPreviewIndicatorPosition] =
    React.useState<IndicatorPosition | null>(null);
  const [shouldAnimate, setShouldAnimate] = React.useState(false);
  const previewCleanupTimeoutRef = React.useRef<number | null>(null);
  const pressedPreviewRef = React.useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    tabElement: HTMLElement;
  } | null>(null);
  const pressPreviewEnabled = animated;

  const clearScheduledPreviewCleanup = React.useCallback(() => {
    if (previewCleanupTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(previewCleanupTimeoutRef.current);
    previewCleanupTimeoutRef.current = null;
  }, []);

  const clearPreview = React.useCallback(() => {
    pressedPreviewRef.current = null;
    clearScheduledPreviewCleanup();
    setPreviewIndicatorPosition(null);
  }, [clearScheduledPreviewCleanup]);

  const measureIndicatorPosition = React.useCallback(
    (tabElement: HTMLElement | null): IndicatorPosition | null => {
      const listElement = listRef.current;

      if (!listElement || !tabElement) {
        return null;
      }

      const listRect = listElement.getBoundingClientRect();
      const tabRect = tabElement.getBoundingClientRect();

      return {
        left: tabRect.left - listRect.left,
        top: tabRect.top - listRect.top,
        width: tabRect.width,
        height: tabRect.height,
        bottom: listRect.bottom - tabRect.bottom
      };
    },
    []
  );

  const updateIndicatorPosition = React.useCallback(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const activeTab = listElement.querySelector(
      '[data-slot="tabs-trigger"][data-active]'
    ) as HTMLElement | null;

    if (!activeTab) {
      setIndicatorPosition(null);
      setPreviewIndicatorPosition(null);

      return;
    }

    const measuredActiveIndicator = measureIndicatorPosition(activeTab);

    setIndicatorPosition(measuredActiveIndicator);

    if (!pressPreviewEnabled || !measuredActiveIndicator) {
      setPreviewIndicatorPosition(null);

      return;
    }

    const pressedPreview = pressedPreviewRef.current;

    if (!pressedPreview || !listElement.contains(pressedPreview.tabElement)) {
      setPreviewIndicatorPosition(null);

      return;
    }

    const measuredPressedIndicator = measureIndicatorPosition(
      pressedPreview.tabElement
    );

    if (!measuredPressedIndicator) {
      setPreviewIndicatorPosition(null);

      return;
    }

    const previewPosition = getPressPreviewIndicatorPosition({
      activePosition: measuredActiveIndicator,
      targetPosition: measuredPressedIndicator
    });

    setPreviewIndicatorPosition({
      ...measuredActiveIndicator,
      left: previewPosition.left,
      width: previewPosition.width
    });
  }, [measureIndicatorPosition, pressPreviewEnabled]);

  React.useEffect(() => {
    updateIndicatorPosition();

    const listElement = listRef.current;
    if (!listElement) {
      return;
    }

    const observer = new MutationObserver(() => {
      setShouldAnimate(true);
      updateIndicatorPosition();
      clearPreview();
    });
    observer.observe(listElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-active']
    });

    const resizeObserver = new ResizeObserver(() => {
      setShouldAnimate(false);
      updateIndicatorPosition();
    });
    resizeObserver.observe(listElement);
    listElement
      .querySelectorAll('[data-slot="tabs-trigger"]')
      .forEach((element) => {
        resizeObserver.observe(element);
      });

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [clearPreview, updateIndicatorPosition]);

  React.useEffect(() => {
    if (pressPreviewEnabled) {
      return;
    }

    clearPreview();
  }, [clearPreview, pressPreviewEnabled]);

  React.useEffect(() => {
    if (!pressPreviewEnabled || !previewIndicatorPosition) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const pressedPreview = pressedPreviewRef.current;

      if (
        !pressedPreview ||
        pressedPreview.pointerId === null ||
        event.pointerId !== pressedPreview.pointerId
      ) {
        return;
      }

      const movedX = Math.abs(event.clientX - pressedPreview.startX);
      const movedY = Math.abs(event.clientY - pressedPreview.startY);

      if (
        movedX > POINTER_MOVE_CANCEL_THRESHOLD_PX ||
        movedY > POINTER_MOVE_CANCEL_THRESHOLD_PX
      ) {
        clearPreview();
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const pressedPreview = pressedPreviewRef.current;

      if (
        !pressedPreview ||
        pressedPreview.pointerId === null ||
        event.pointerId !== pressedPreview.pointerId
      ) {
        return;
      }

      const releasedOnPressedTab = isPointWithinRect(
        pressedPreview.tabElement.getBoundingClientRect(),
        event.clientX,
        event.clientY
      );

      if (!releasedOnPressedTab) {
        clearPreview();

        return;
      }

      pressedPreviewRef.current = {
        ...pressedPreview,
        pointerId: null
      };
      previewCleanupTimeoutRef.current = window.setTimeout(() => {
        clearPreview();
      }, POINTER_UP_COMMIT_GRACE_MS);
    };

    const handlePointerCancel = () => {
      clearPreview();
    };

    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener('pointercancel', handlePointerCancel, true);
    window.addEventListener('blur', handlePointerCancel);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener('pointercancel', handlePointerCancel, true);
      window.removeEventListener('blur', handlePointerCancel);
    };
  }, [clearPreview, pressPreviewEnabled, previewIndicatorPosition]);

  React.useEffect(() => {
    return () => {
      clearScheduledPreviewCleanup();
    };
  }, [clearScheduledPreviewCleanup]);

  const handlePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!pressPreviewEnabled || event.button !== 0) {
        return;
      }

      const listElement = listRef.current;
      const target = event.target as HTMLElement | null;
      const pressedTab = target?.closest(
        '[data-slot="tabs-trigger"]'
      ) as HTMLElement | null;

      if (
        !listElement ||
        !pressedTab ||
        !listElement.contains(pressedTab) ||
        pressedTab.matches('[data-active], [data-disabled]')
      ) {
        return;
      }

      const activeTab = listElement.querySelector(
        '[data-slot="tabs-trigger"][data-active]'
      ) as HTMLElement | null;
      const measuredActiveIndicator = measureIndicatorPosition(activeTab);
      const measuredPressedIndicator = measureIndicatorPosition(pressedTab);

      if (!measuredActiveIndicator || !measuredPressedIndicator) {
        return;
      }

      clearScheduledPreviewCleanup();
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        hapticTap('selection');
      }
      pressedPreviewRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        tabElement: pressedTab
      };
      setShouldAnimate(true);

      const previewPosition = getPressPreviewIndicatorPosition({
        activePosition: measuredActiveIndicator,
        targetPosition: measuredPressedIndicator
      });

      setPreviewIndicatorPosition({
        ...measuredActiveIndicator,
        left: previewPosition.left,
        width: previewPosition.width
      });
    },
    [
      clearScheduledPreviewCleanup,
      measureIndicatorPosition,
      pressPreviewEnabled
    ]
  );
  const displayIndicatorPosition =
    previewIndicatorPosition ?? indicatorPosition;

  return (
    <TabsSizeContext.Provider value={size}>
      <TabsPrimitive.List
        ref={listRef}
        onPointerDownCapture={handlePointerDownCapture}
        className={cn(
          'relative z-0 flex w-fit items-stretch justify-center text-text-secondary',
          size === 'dense' ? 'gap-x-px' : 'gap-x-0.5',
          'data-[orientation=vertical]:flex-col',
          variant === 'default'
            ? cn(
                'overflow-hidden bg-background-elevated',
                size === 'dense' ? 'rounded-md p-px' : 'rounded-lg p-0.5'
              )
            : 'data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 *:data-[slot=tabs-trigger]:hover:bg-background-elevated',
          className
        )}
        data-slot="tabs-list"
        {...listProps}
      >
        {children}
        {displayIndicatorPosition && (
          <motion.div
            className={cn(
              'absolute left-0',
              variant === 'underline' ? 'bottom-0' : 'top-0',
              variant === 'underline'
                ? 'z-10 h-0.5 bg-primary'
                : cn(
                    '-z-1 bg-background-base shadow-xs',
                    size === 'dense' ? 'rounded-sm' : 'rounded-md'
                  )
            )}
            initial={false}
            animate={{
              x: displayIndicatorPosition.left,
              y:
                variant === 'underline'
                  ? -displayIndicatorPosition.bottom
                  : displayIndicatorPosition.top,
              width: displayIndicatorPosition.width,
              height:
                variant === 'underline'
                  ? undefined
                  : displayIndicatorPosition.height
            }}
            transition={
              shouldAnimate && pressPreviewEnabled
                ? INDICATOR_TRANSITION
                : { duration: 0 }
            }
            data-slot="tab-indicator"
          />
        )}
      </TabsPrimitive.List>
    </TabsSizeContext.Provider>
  );
}

function TabsTab(props: TabsPrimitive.Tab.Props) {
  const { className, ...tabProps } = props;
  const size = React.useContext(TabsSizeContext);

  return (
    <TabsPrimitive.Tab
      className={cn(
        'flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent outline-none transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary data-disabled:pointer-events-none data-disabled:opacity-64',
        size === 'dense'
          ? 'min-h-6 gap-0.5 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none sm:min-h-6 sm:gap-0.5 sm:px-2 sm:text-xs'
          : "[&_svg]:-mx-0.5 font-medium text-sm leading-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 box-border min-h-8 h-full gap-1 px-3 py-0 sm:min-h-9 sm:gap-1.5 sm:px-3.5",
        'hover:text-text-secondary data-active:text-text-primary',
        'data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start',
        className
      )}
      data-slot="tabs-trigger"
      {...tabProps}
    />
  );
}

export { Tabs, TabsList, TabsTab };
