'use client';
import {
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import type {
  DynamicTooltipHandle,
  DynamicTooltipMotionAxis
} from '@/@types/common/components/dynamic-tooltip/dynamic-tooltip';
import { type VariantProps, cva } from 'class-variance-authority';
import {
  AnimatePresence,
  type TargetAndTransition,
  motion
} from 'motion/react';
import { useDirection } from '@/hooks/common';
import { assignRef } from '@/utils/common/assign-ref';
import { cn } from '@/lib/utils';
import { clamp } from '@/utils/common/math';

type TooltipSide =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'inline-start'
  | 'inline-end';
type TooltipAlign = 'start' | 'center' | 'end';
type DynamicTooltipTextMotionDirection = 'forward' | 'backward';
type DynamicTooltipWidthAnchor = 'left' | 'right' | 'center';

interface DynamicTooltipController {
  open: (triggerId?: string) => void;
  close: () => void;
  isOpen: () => boolean;
}

interface InternalDynamicTooltipHandle extends DynamicTooltipHandle {
  setController: (controller: DynamicTooltipController | null) => void;
}

interface TriggerRegistration {
  element: HTMLElement;
  label: ReactNode;
  width: number | undefined;
  height: number | undefined;
  disabled: boolean | undefined;
  variant: DynamicTooltipVariant;
}

interface ActiveTriggerInfo {
  triggerId: string;
  label: ReactNode;
  width: number;
  height: number;
  rect: DOMRect;
  variant: DynamicTooltipVariant;
}

interface TooltipLayout {
  width: number;
  height: number;
  top: number;
  left?: number;
  right?: number;
}

type DynamicTooltipStyle = CSSProperties & {
  '--transform-origin': string;
};

interface DynamicTooltipContextValue {
  handle: DynamicTooltipHandle;
  isOpen: boolean;
  activeTriggerId: string | null;
  openDelay: number;
  registerTrigger: (
    triggerId: string,
    registration: TriggerRegistration
  ) => void;
  unregisterTrigger: (triggerId: string, element: HTMLElement | null) => void;
  activateTrigger: (triggerId: string) => void;
  closeTooltip: () => void;
  scheduleClose: () => void;
  cancelClose: () => void;
  resetOpenDelayOnTriggerChange: boolean;
  getTriggerIdForTarget: (target: EventTarget | null) => string | null;
  containsInteractiveTarget: (target: EventTarget | null) => boolean;
}

interface MeasuredLabelSize {
  width: number | undefined;
  height: number | undefined;
}

interface DynamicTooltipLabelProps {
  activeTriggerInfo: ActiveTriggerInfo | null;
  textMotionDirection: DynamicTooltipTextMotionDirection;
  motionAxis: DynamicTooltipMotionAxis;
}

type DynamicTooltipTriggerProps = Omit<
  React.ComponentProps<'button'>,
  'children'
> & {
  label: ReactNode;
  disabled?: boolean;
  render?: ReactElement;
  children?: ReactNode;
  openDelay?: number;
  closeDelay?: number;
  variant?: DynamicTooltipVariant;
};

export interface DynamicTooltipProviderProps {
  children: ReactNode;
  handle?: DynamicTooltipHandle;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: TooltipSide;
  sideOffset?: number;
  align?: TooltipAlign;
  collisionPadding?: number;
  className?: string;
  positionerClassName?: string;
  variant?: VariantProps<typeof tooltipPopupVariants>['variant'];
  motionAxis?: DynamicTooltipMotionAxis;
  openDelay?: number;
  closeDelay?: number;
  resetOpenDelayOnTriggerChange?: boolean;
}

const SIZE_TRANSITION = { type: 'spring', bounce: 0, duration: 0.25 } as const;
const TEXT_TRANSITION = { duration: 0.16, ease: 'easeOut' } as const;
const POSITION_TRANSITION = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number]
} as const;
const DEFAULT_TOOLTIP_CLOSE_MS = 150;
const DEFAULT_TOOLTIP_OPEN_MS = 0;
const DEFAULT_COLLISION_PADDING = 16;
const TOOLTIP_HORIZONTAL_CHROME_PX = 14;
const TOOLTIP_VERTICAL_CHROME_PX = 6;
const DEFAULT_LABEL_WIDTH_PX = 48;
const DEFAULT_LABEL_HEIGHT_PX = 16;
const TEXT_MOTION_OFFSET_PX = 8;

const TEXT_MOTION_VARIANTS = {
  enter: (custom: TextMotionCustom) => ({
    opacity: 0,
    x: custom.axis === 'x' ? custom.offset : 0,
    y: custom.axis === 'y' ? custom.offset : 0
  }),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (custom: TextMotionCustom) => ({
    opacity: 0,
    x: custom.axis === 'x' ? custom.offset : 0,
    y: custom.axis === 'y' ? custom.offset : 0
  })
} as const;

interface TextMotionCustom {
  axis: 'x' | 'y';
  offset: number;
}

const tooltipPopupVariants = cva(
  'fixed z-50 flex origin-(--transform-origin) overflow-hidden text-balance rounded-md border bg-clip-padding text-xs shadow-black/5 shadow-md transition-[scale,opacity,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-sm data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0',
  {
    variants: {
      variant: {
        default: 'bg-popover text-popover-foreground',
        error: 'border-black/10 bg-[var(--error-bg)] text-[var(--error)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export type DynamicTooltipVariant = VariantProps<
  typeof tooltipPopupVariants
>['variant'];

const tooltipContentClassName =
  'relative size-full overflow-clip px-(--viewport-inline-padding) py-0.5 [--viewport-inline-padding:--spacing(1.5)]';

const DynamicTooltipContext = createContext<DynamicTooltipContextValue | null>(
  null
);

class DynamicTooltipHandleImpl implements InternalDynamicTooltipHandle {
  private controller: DynamicTooltipController | null = null;
  private openState = false;

  open(triggerId?: string) {
    this.openState = true;
    this.controller?.open(triggerId);
  }

  close() {
    this.openState = false;
    this.controller?.close();
  }

  get isOpen() {
    return this.controller?.isOpen() ?? this.openState;
  }

  setController(controller: DynamicTooltipController | null) {
    this.controller = controller;
    this.openState = controller?.isOpen() ?? false;
  }
}

function createDynamicTooltipHandle(): DynamicTooltipHandle {
  return new DynamicTooltipHandleImpl();
}

export function useOptionalDynamicTooltipHandleContext() {
  return useContext(DynamicTooltipContext)?.handle ?? null;
}

function useDynamicTooltipContext(): DynamicTooltipContextValue {
  const value = useContext(DynamicTooltipContext);

  if (value == null) {
    throw new Error(
      'DynamicTooltipTrigger must be used within DynamicTooltipProvider'
    );
  }

  return value;
}

function isInternalDynamicTooltipHandle(
  handle: DynamicTooltipHandle
): handle is InternalDynamicTooltipHandle {
  return 'setController' in handle;
}

function getPhysicalSide(
  side: TooltipSide,
  isRtl: boolean
): Exclude<TooltipSide, 'inline-start' | 'inline-end'> {
  if (side === 'inline-start') {
    return isRtl ? 'right' : 'left';
  }

  if (side === 'inline-end') {
    return isRtl ? 'left' : 'right';
  }

  return side;
}

function resolveMotionAxis(
  motionAxis: DynamicTooltipMotionAxis | undefined,
  side: TooltipSide
): DynamicTooltipMotionAxis {
  if (motionAxis) {
    return motionAxis;
  }

  return side === 'left' ||
    side === 'right' ||
    side === 'inline-start' ||
    side === 'inline-end'
    ? 'vertical'
    : 'horizontal';
}

function resolveWidthAnchor(
  side: TooltipSide,
  align: TooltipAlign,
  isRtl: boolean
): DynamicTooltipWidthAnchor {
  if (align === 'center' || (side !== 'top' && side !== 'bottom')) {
    return 'center';
  }

  if (align === 'start') {
    return isRtl ? 'right' : 'left';
  }

  return isRtl ? 'left' : 'right';
}

function isElementTarget(target: EventTarget | null): target is Element {
  return target instanceof Element;
}

function getAnchorAlignedX(props: {
  rect: DOMRect;
  width: number;
  align: TooltipAlign;
  isRtl: boolean;
  collisionPadding: number;
}): Pick<TooltipLayout, 'left' | 'right'> {
  const viewportWidth = window.innerWidth;
  const minEdge = props.collisionPadding;
  const maxLeft = viewportWidth - props.collisionPadding - props.width;

  if (props.align === 'center') {
    return {
      left: clamp(
        props.rect.left + props.rect.width / 2 - props.width / 2,
        minEdge,
        maxLeft
      )
    };
  }

  const anchorRight =
    (props.align === 'start' && props.isRtl) ||
    (props.align === 'end' && !props.isRtl);

  if (anchorRight) {
    const rightEdge = clamp(
      props.rect.right,
      props.collisionPadding + props.width,
      viewportWidth - props.collisionPadding
    );

    return { right: viewportWidth - rightEdge };
  }

  return {
    left: clamp(props.rect.left, minEdge, maxLeft)
  };
}

function getAnchorAlignedY(props: {
  rect: DOMRect;
  height: number;
  align: TooltipAlign;
  collisionPadding: number;
}): number {
  const maxTop = window.innerHeight - props.collisionPadding - props.height;

  if (props.align === 'start') {
    return clamp(props.rect.top, props.collisionPadding, maxTop);
  }

  if (props.align === 'end') {
    return clamp(
      props.rect.bottom - props.height,
      props.collisionPadding,
      maxTop
    );
  }

  return clamp(
    props.rect.top + props.rect.height / 2 - props.height / 2,
    props.collisionPadding,
    maxTop
  );
}

function getTooltipLayout(props: {
  activeTriggerInfo: ActiveTriggerInfo;
  side: TooltipSide;
  align: TooltipAlign;
  sideOffset: number;
  collisionPadding: number;
  isRtl: boolean;
}): TooltipLayout {
  const physicalSide = getPhysicalSide(props.side, props.isRtl);
  const width = props.activeTriggerInfo.width + TOOLTIP_HORIZONTAL_CHROME_PX;
  const height = props.activeTriggerInfo.height + TOOLTIP_VERTICAL_CHROME_PX;
  const rect = props.activeTriggerInfo.rect;
  const maxTop = window.innerHeight - props.collisionPadding - height;

  if (physicalSide === 'top' || physicalSide === 'bottom') {
    const top =
      physicalSide === 'top'
        ? rect.top - props.sideOffset - height
        : rect.bottom + props.sideOffset;

    return {
      width,
      height,
      top: clamp(top, props.collisionPadding, maxTop),
      ...getAnchorAlignedX({
        rect,
        width,
        align: props.align,
        isRtl: props.isRtl,
        collisionPadding: props.collisionPadding
      })
    };
  }

  const top = getAnchorAlignedY({
    rect,
    height,
    align: props.align,
    collisionPadding: props.collisionPadding
  });

  if (physicalSide === 'left') {
    const rightEdge = clamp(
      rect.left - props.sideOffset,
      props.collisionPadding + width,
      window.innerWidth - props.collisionPadding
    );

    return {
      width,
      height,
      top,
      right: window.innerWidth - rightEdge
    };
  }

  return {
    width,
    height,
    top,
    left: clamp(
      rect.right + props.sideOffset,
      props.collisionPadding,
      window.innerWidth - props.collisionPadding - width
    )
  };
}

function getPositionTarget(layout: TooltipLayout): TargetAndTransition {
  const target: TargetAndTransition = {
    top: layout.top,
    width: layout.width,
    height: layout.height
  };

  if (layout.left != null) {
    target.left = layout.left;
  }

  if (layout.right != null) {
    target.right = layout.right;
  }

  return target;
}

function DynamicTooltipLabel(props: DynamicTooltipLabelProps) {
  const label = props.activeTriggerInfo?.label;
  const labelKey =
    props.activeTriggerInfo?.triggerId ??
    (typeof label === 'string' || typeof label === 'number'
      ? String(label)
      : 'dynamic-tooltip-label');
  const axisKey: 'x' | 'y' = props.motionAxis === 'vertical' ? 'y' : 'x';
  const offsetMagnitude =
    props.textMotionDirection === 'forward'
      ? TEXT_MOTION_OFFSET_PX
      : -TEXT_MOTION_OFFSET_PX;
  const textMotionCustom: TextMotionCustom = {
    axis: axisKey,
    offset: offsetMagnitude
  };

  return (
    <span className="relative block min-h-4 overflow-visible">
      <AnimatePresence
        custom={textMotionCustom}
        initial={false}
        mode="popLayout"
      >
        <motion.span
          key={labelKey}
          animate="center"
          className="block min-h-4 w-max whitespace-nowrap [font-family:inherit] text-xs font-normal leading-normal"
          custom={textMotionCustom}
          exit="exit"
          initial="enter"
          transition={TEXT_TRANSITION}
          variants={TEXT_MOTION_VARIANTS}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function DynamicTooltipProvider(props: DynamicTooltipProviderProps) {
  const internalDynamicTooltipHandle = useMemo(
    () => createDynamicTooltipHandle(),
    []
  );
  const dynamicTooltipHandle = props.handle ?? internalDynamicTooltipHandle;
  const direction = useDirection();
  const isRtl = direction === 'rtl';
  const side = props.side ?? 'top';
  const isBlockAxisSide = side === 'top' || side === 'bottom';
  const align = props.align ?? (isBlockAxisSide ? 'start' : 'center');
  const sideOffset = props.sideOffset ?? 4;
  const openDelay = props.openDelay ?? DEFAULT_TOOLTIP_OPEN_MS;
  const closeDelay = props.closeDelay ?? DEFAULT_TOOLTIP_CLOSE_MS;
  const resetOpenDelayOnTriggerChange =
    props.resetOpenDelayOnTriggerChange ?? false;
  const collisionPadding = props.collisionPadding ?? DEFAULT_COLLISION_PADDING;
  const motionAxis = resolveMotionAxis(props.motionAxis, side);
  const widthAnchor = resolveWidthAnchor(side, align, isRtl);
  const triggerRegistryRef = useRef<Map<string, TriggerRegistration>>(
    new Map()
  );
  const popupRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousTriggerCenterRef = useRef<{ x: number; y: number } | null>(
    null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTriggerInfo, setActiveTriggerInfo] =
    useState<ActiveTriggerInfo | null>(null);
  const [textMotionDirection, setTextMotionDirection] =
    useState<DynamicTooltipTextMotionDirection>('forward');

  const isOpenRef = useRef(isOpen);
  const activeTriggerInfoRef = useRef<ActiveTriggerInfo | null>(
    activeTriggerInfo
  );
  const onOpenChangeRef = useRef(props.onOpenChange);
  const disabledRef = useRef(props.disabled);
  const isRtlRef = useRef(isRtl);
  const motionAxisRef = useRef<DynamicTooltipMotionAxis>(motionAxis);
  const closeDelayRef = useRef(closeDelay);

  useLayoutEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useLayoutEffect(() => {
    activeTriggerInfoRef.current = activeTriggerInfo;
  }, [activeTriggerInfo]);

  useLayoutEffect(() => {
    onOpenChangeRef.current = props.onOpenChange;
    disabledRef.current = props.disabled;
    isRtlRef.current = isRtl;
    motionAxisRef.current = motionAxis;
    closeDelayRef.current = closeDelay;
  });

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeTooltip = useCallback(() => {
    clearCloseTimer();
    setIsOpen((currentOpen) => {
      if (currentOpen) {
        onOpenChangeRef.current?.(false);
      }

      return false;
    });
    previousTriggerCenterRef.current = null;
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(closeTooltip, closeDelayRef.current);
  }, [clearCloseTimer, closeTooltip]);

  const updateActiveTrigger = useCallback(
    (triggerId: string) => {
      if (disabledRef.current) {
        return;
      }

      const registration = triggerRegistryRef.current.get(triggerId);

      if (!registration || registration.disabled) {
        return;
      }

      clearCloseTimer();

      const rect = registration.element.getBoundingClientRect();
      const triggerCenter = {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2)
      };
      const previous = previousTriggerCenterRef.current;

      if (previous) {
        const deltaX = triggerCenter.x - previous.x;
        const deltaY = triggerCenter.y - previous.y;
        const primaryDelta =
          motionAxisRef.current === 'vertical'
            ? deltaY
            : isRtlRef.current
              ? -deltaX
              : deltaX;

        if (primaryDelta !== 0) {
          setTextMotionDirection(primaryDelta > 0 ? 'forward' : 'backward');
        }
      }

      previousTriggerCenterRef.current = triggerCenter;
      setActiveTriggerInfo({
        triggerId,
        label: registration.label,
        width: registration.width ?? DEFAULT_LABEL_WIDTH_PX,
        height: registration.height ?? DEFAULT_LABEL_HEIGHT_PX,
        rect,
        variant: registration.variant
      });
      setIsMounted(true);
      setIsOpen((currentOpen) => {
        if (!currentOpen) {
          onOpenChangeRef.current?.(true);
        }

        return true;
      });
    },
    [clearCloseTimer]
  );

  const registerTrigger = useCallback(
    (triggerId: string, registration: TriggerRegistration) => {
      triggerRegistryRef.current.set(triggerId, registration);
      setActiveTriggerInfo((currentInfo) => {
        if (!currentInfo || currentInfo.triggerId !== triggerId) {
          return currentInfo;
        }

        const nextWidth = registration.width ?? currentInfo.width;
        const nextHeight = registration.height ?? currentInfo.height;

        if (
          currentInfo.label === registration.label &&
          currentInfo.width === nextWidth &&
          currentInfo.height === nextHeight &&
          currentInfo.variant === registration.variant
        ) {
          return currentInfo;
        }

        return {
          ...currentInfo,
          label: registration.label,
          width: nextWidth,
          height: nextHeight,
          rect: registration.element.getBoundingClientRect(),
          variant: registration.variant
        };
      });
    },
    []
  );

  const unregisterTrigger = useCallback(
    (triggerId: string, element: HTMLElement | null) => {
      const currentRegistration = triggerRegistryRef.current.get(triggerId);

      if (!currentRegistration || currentRegistration.element !== element) {
        return;
      }

      triggerRegistryRef.current.delete(triggerId);

      if (activeTriggerInfoRef.current?.triggerId === triggerId) {
        closeTooltip();
      }
    },
    [closeTooltip]
  );

  const getTriggerIdForTarget = useCallback((target: EventTarget | null) => {
    if (!isElementTarget(target)) {
      return null;
    }

    for (const [triggerId, registration] of triggerRegistryRef.current) {
      if (registration.element.contains(target)) {
        return triggerId;
      }
    }

    return null;
  }, []);

  const containsInteractiveTarget = useCallback(
    (target: EventTarget | null) => {
      if (!isElementTarget(target)) {
        return false;
      }

      if (popupRef.current?.contains(target)) {
        return true;
      }

      return getTriggerIdForTarget(target) != null;
    },
    [getTriggerIdForTarget]
  );

  const controller = useMemo<DynamicTooltipController>(
    () => ({
      open: (triggerId?: string) => {
        const fallbackTriggerId =
          triggerId ?? activeTriggerInfoRef.current?.triggerId ?? null;

        if (fallbackTriggerId) {
          updateActiveTrigger(fallbackTriggerId);
        }
      },
      close: closeTooltip,
      isOpen: () => isOpenRef.current
    }),
    [closeTooltip, updateActiveTrigger]
  );

  useLayoutEffect(() => {
    if (!isInternalDynamicTooltipHandle(dynamicTooltipHandle)) {
      return;
    }

    dynamicTooltipHandle.setController(controller);

    return () => {
      dynamicTooltipHandle.setController(null);
    };
  }, [controller, dynamicTooltipHandle]);

  useLayoutEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  useLayoutEffect(() => {
    if (props.disabled) {
      closeTooltip();
    }
  }, [closeTooltip, props.disabled]);

  const activeTriggerId = activeTriggerInfo?.triggerId ?? null;

  useLayoutEffect(() => {
    if (!isOpen || activeTriggerId == null) {
      return;
    }

    const updateLayout = () => {
      const registration = triggerRegistryRef.current.get(activeTriggerId);

      if (!registration) {
        return;
      }

      const newRect = registration.element.getBoundingClientRect();

      setActiveTriggerInfo((currentInfo) => {
        if (!currentInfo || currentInfo.triggerId !== activeTriggerId) {
          return currentInfo;
        }

        const previousRect = currentInfo.rect;

        if (
          previousRect.left === newRect.left &&
          previousRect.top === newRect.top &&
          previousRect.right === newRect.right &&
          previousRect.bottom === newRect.bottom &&
          previousRect.width === newRect.width &&
          previousRect.height === newRect.height
        ) {
          return currentInfo;
        }

        return { ...currentInfo, rect: newRect };
      });
    };

    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);

    const registration = triggerRegistryRef.current.get(activeTriggerId);
    const observer = new ResizeObserver(updateLayout);

    if (registration) {
      observer.observe(registration.element);
    }

    return () => {
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
      observer.disconnect();
    };
  }, [activeTriggerId, isOpen]);

  const contextValue = useMemo<DynamicTooltipContextValue>(
    () => ({
      handle: dynamicTooltipHandle,
      isOpen,
      activeTriggerId,
      openDelay,
      registerTrigger,
      unregisterTrigger,
      activateTrigger: updateActiveTrigger,
      closeTooltip,
      scheduleClose,
      cancelClose: clearCloseTimer,
      resetOpenDelayOnTriggerChange,
      getTriggerIdForTarget,
      containsInteractiveTarget
    }),
    [
      activeTriggerId,
      clearCloseTimer,
      closeTooltip,
      containsInteractiveTarget,
      dynamicTooltipHandle,
      getTriggerIdForTarget,
      isOpen,
      openDelay,
      registerTrigger,
      resetOpenDelayOnTriggerChange,
      scheduleClose,
      unregisterTrigger,
      updateActiveTrigger
    ]
  );

  const layout =
    isOpen && activeTriggerInfo && typeof window !== 'undefined'
      ? getTooltipLayout({
          activeTriggerInfo,
          side,
          align,
          sideOffset,
          collisionPadding,
          isRtl
        })
      : null;
  const positionTarget = layout ? getPositionTarget(layout) : undefined;
  const popupStyle: DynamicTooltipStyle = {
    '--transform-origin':
      widthAnchor === 'right'
        ? 'right center'
        : widthAnchor === 'left'
          ? 'left center'
          : 'center center'
  };

  return (
    <DynamicTooltipContext.Provider value={contextValue}>
      {props.children}
      {typeof document !== 'undefined' &&
        isMounted &&
        createPortal(
          <AnimatePresence
            initial={false}
            onExitComplete={() => setIsMounted(false)}
          >
            {isOpen && activeTriggerInfo && layout && (
              <motion.div
                ref={popupRef}
                animate={positionTarget}
                className={cn(
                  tooltipPopupVariants({
                    variant: activeTriggerInfo.variant ?? props.variant
                  }),
                  props.positionerClassName,
                  props.className
                )}
                data-slot="dynamic-tooltip-popup"
                exit={{ opacity: 0, scale: 0.98 }}
                initial={{ opacity: 0, scale: 0.98, ...positionTarget }}
                onPointerEnter={clearCloseTimer}
                onPointerLeave={(event) => {
                  if (!containsInteractiveTarget(event.relatedTarget)) {
                    scheduleClose();
                  }
                }}
                style={popupStyle}
                transition={{
                  left: POSITION_TRANSITION,
                  right: POSITION_TRANSITION,
                  top: POSITION_TRANSITION,
                  width: SIZE_TRANSITION,
                  height: SIZE_TRANSITION,
                  opacity: { duration: 0.12 },
                  scale: { duration: 0.12 }
                }}
              >
                <div
                  className={tooltipContentClassName}
                  data-slot="dynamic-tooltip-content"
                >
                  <DynamicTooltipLabel
                    activeTriggerInfo={activeTriggerInfo}
                    motionAxis={motionAxis}
                    textMotionDirection={textMotionDirection}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </DynamicTooltipContext.Provider>
  );
}

function getElementProps(
  element: ReactElement
): React.ComponentPropsWithoutRef<'button'> & {
  ref?: Ref<HTMLElement>;
} {
  return element.props as React.ComponentPropsWithoutRef<'button'> & {
    ref?: Ref<HTMLElement>;
  };
}

export function DynamicTooltipTrigger(props: DynamicTooltipTriggerProps) {
  const dynamicTooltipContext = useDynamicTooltipContext();
  const {
    activateTrigger,
    activeTriggerId,
    closeTooltip,
    containsInteractiveTarget,
    getTriggerIdForTarget,
    registerTrigger,
    resetOpenDelayOnTriggerChange,
    scheduleClose,
    unregisterTrigger
  } = dynamicTooltipContext;
  const generatedTriggerId = useId().replace(/:/g, '');
  const triggerId = props.id ?? generatedTriggerId;
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const widthMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [measuredSize, setMeasuredSize] = useState<MeasuredLabelSize>({
    width: undefined,
    height: undefined
  });
  const openDelay = props.openDelay ?? dynamicTooltipContext.openDelay;

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current != null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const labelRef = useRef(props.label);
  const sizeRef = useRef(measuredSize);
  const disabledRef = useRef(props.disabled);
  const variantRef = useRef(props.variant);
  const renderElementRefRef = useRef<Ref<HTMLElement> | undefined>(undefined);

  labelRef.current = props.label;
  sizeRef.current = measuredSize;
  disabledRef.current = props.disabled;
  variantRef.current = props.variant;
  renderElementRefRef.current =
    props.render && isValidElement(props.render)
      ? getElementProps(props.render).ref
      : undefined;

  const setTriggerRef = useCallback(
    (element: HTMLElement | null) => {
      const previousElement = triggerElementRef.current;
      triggerElementRef.current = element;

      if (element) {
        registerTrigger(triggerId, {
          element,
          label: labelRef.current,
          width: sizeRef.current.width,
          height: sizeRef.current.height,
          disabled: disabledRef.current,
          variant: variantRef.current
        });
      } else {
        unregisterTrigger(triggerId, previousElement);
      }

      assignRef(renderElementRefRef.current, element);
    },
    [registerTrigger, triggerId, unregisterTrigger]
  );

  useLayoutEffect(() => {
    const element = triggerElementRef.current;

    if (!element) {
      return;
    }

    registerTrigger(triggerId, {
      element,
      label: props.label,
      width: measuredSize.width,
      height: measuredSize.height,
      disabled: props.disabled,
      variant: props.variant
    });
  }, [
    measuredSize.height,
    measuredSize.width,
    props.disabled,
    props.label,
    props.variant,
    registerTrigger,
    triggerId
  ]);

  useLayoutEffect(() => {
    return () => {
      clearOpenTimer();
    };
  }, [clearOpenTimer]);

  useLayoutEffect(() => {
    if (props.disabled) {
      clearOpenTimer();

      return;
    }

    const element = widthMeasureRef.current;

    if (!element) {
      return;
    }

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const nextSize = {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height)
      };

      setMeasuredSize((currentSize) =>
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
          ? currentSize
          : nextSize
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [clearOpenTimer, props.disabled, props.label]);

  const activateTriggerWithDelay = useCallback(() => {
    clearOpenTimer();

    const isActiveTrigger = activeTriggerId === triggerId;
    const shouldResetOpenDelay =
      resetOpenDelayOnTriggerChange &&
      dynamicTooltipContext.isOpen &&
      !isActiveTrigger;

    if (
      openDelay <= 0 ||
      (dynamicTooltipContext.isOpen && !shouldResetOpenDelay)
    ) {
      activateTrigger(triggerId);

      return;
    }

    if (shouldResetOpenDelay) {
      scheduleClose();
    }

    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      activateTrigger(triggerId);
    }, openDelay);
  }, [
    activateTrigger,
    activeTriggerId,
    clearOpenTimer,
    dynamicTooltipContext.isOpen,
    openDelay,
    resetOpenDelayOnTriggerChange,
    scheduleClose,
    triggerId
  ]);

  const handlePointerEnter = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!props.disabled && event.pointerType !== 'touch') {
        activateTriggerWithDelay();
      }
    },
    [activateTriggerWithDelay, props.disabled]
  );

  const handlePointerLeave = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      clearOpenTimer();

      const relatedTriggerId = getTriggerIdForTarget(event.relatedTarget);

      if (
        resetOpenDelayOnTriggerChange &&
        relatedTriggerId != null &&
        relatedTriggerId !== triggerId
      ) {
        scheduleClose();

        return;
      }

      if (!containsInteractiveTarget(event.relatedTarget)) {
        scheduleClose();
      }
    },
    [
      clearOpenTimer,
      containsInteractiveTarget,
      getTriggerIdForTarget,
      resetOpenDelayOnTriggerChange,
      scheduleClose,
      triggerId
    ]
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (props.disabled) {
        return;
      }

      clearOpenTimer();

      if (!event.currentTarget.matches(':focus-visible')) {
        return;
      }

      activateTriggerWithDelay();
    },
    [activateTriggerWithDelay, clearOpenTimer, props.disabled]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      clearOpenTimer();
      if (!containsInteractiveTarget(event.relatedTarget)) {
        scheduleClose();
      }
    },
    [clearOpenTimer, containsInteractiveTarget, scheduleClose]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      clearOpenTimer();

      if (event.pointerType !== 'touch') {
        closeTooltip();
      }
    },
    [clearOpenTimer, closeTooltip]
  );

  const state = activeTriggerId === triggerId ? 'open' : 'closed';
  const composeHandlers = (
    elementProps?: ReturnType<typeof getElementProps>
  ) => ({
    onFocus: (event: FocusEvent<HTMLElement>) => {
      handleFocus(event);
      elementProps?.onFocus?.(event as FocusEvent<HTMLButtonElement>);
      props.onFocus?.(event as FocusEvent<HTMLButtonElement>);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      handleBlur(event);
      elementProps?.onBlur?.(event as FocusEvent<HTMLButtonElement>);
      props.onBlur?.(event as FocusEvent<HTMLButtonElement>);
    },
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      handlePointerEnter(event);
      elementProps?.onPointerEnter?.(event as PointerEvent<HTMLButtonElement>);
      props.onPointerEnter?.(event as PointerEvent<HTMLButtonElement>);
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      handlePointerLeave(event);
      elementProps?.onPointerLeave?.(event as PointerEvent<HTMLButtonElement>);
      props.onPointerLeave?.(event as PointerEvent<HTMLButtonElement>);
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      handlePointerDown(event);
      elementProps?.onPointerDown?.(event as PointerEvent<HTMLButtonElement>);
      props.onPointerDown?.(event as PointerEvent<HTMLButtonElement>);
    }
  });
  const {
    label: _label,
    render: _render,
    openDelay: _openDelay,
    closeDelay: _closeDelay,
    disabled: _disabled,
    variant: _variant,
    children,
    ...restProps
  } = props;
  const buttonProps = {
    ...restProps,
    ref: setTriggerRef,
    id: triggerId,
    'data-slot': 'dynamic-tooltip-trigger',
    'data-state': state,
    ...composeHandlers()
  };
  const measureSpan = (
    <span
      ref={widthMeasureRef}
      className="pointer-events-none fixed -z-10 m-0 block w-max whitespace-nowrap [font-family:inherit] text-xs font-normal leading-normal [inset-block-start:0] [inset-inline-start:-10000px]"
      hidden={props.disabled}
      style={{ visibility: 'hidden' }}
    >
      {props.label}
    </span>
  );

  if (props.render && isValidElement(props.render)) {
    const elementProps = getElementProps(props.render);

    return (
      <>
        {measureSpan}
        {cloneElement(props.render, {
          ...buttonProps,
          ...composeHandlers(elementProps),
          className: cn(elementProps.className, props.className)
        } as React.ComponentPropsWithoutRef<'button'>)}
      </>
    );
  }

  return (
    <>
      {measureSpan}
      <button disabled={props.disabled} {...buttonProps}>
        {children}
      </button>
    </>
  );
}
