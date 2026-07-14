import * as React from 'react';
import { Slot as SlotPrimitive } from 'radix-ui';
import {
  FloatingListSlabLayer,
  type FloatingSlabState,
  isSlabOverItem
} from '@/components/ui/floating-list-slab';
import {
  FLOATING_LIST_HIGHLIGHT_ITEM_ATTR,
  shouldHighlightFromPointer
} from '@/hooks/common/floating-list-highlight';
import { cn } from '@/utils/common/cn';

const Slot = SlotPrimitive.Root;

interface FloatingListHighlightContextValue {
  slab: FloatingSlabState | null;
}

interface FloatingListHighlightItemContext {
  isHighlighted: boolean;
}

interface FloatingListHighlightLayerProps {
  slab: FloatingSlabState | null;
  show?: boolean;
  motionKey: string;
  roundedClassName?: string;
  children: React.ReactNode;
}

interface FloatingListHighlightItemProps {
  itemKey: string | number;
  onRequestHighlight: (event: React.PointerEvent) => void;
  asChild?: boolean;
  className?: string;
  children:
    | React.ReactNode
    | ((context: FloatingListHighlightItemContext) => React.ReactNode);
}

const FloatingListHighlightContext =
  React.createContext<FloatingListHighlightContextValue | null>(null);

function FloatingListHighlightLayer(props: FloatingListHighlightLayerProps) {
  const {
    slab,
    show = true,
    motionKey,
    roundedClassName = 'rounded-sm',
    children
  } = props;

  const value = React.useMemo(() => ({ slab }), [slab]);

  return (
    <FloatingListHighlightContext.Provider value={value}>
      <FloatingListSlabLayer
        motionKey={motionKey}
        roundedClassName={roundedClassName}
        show={show}
        slab={slab}
      />
      {children}
    </FloatingListHighlightContext.Provider>
  );
}

function FloatingListHighlightItem(props: FloatingListHighlightItemProps) {
  const { itemKey, onRequestHighlight, asChild = false, className } = props;
  const highlightContext = React.useContext(FloatingListHighlightContext);
  const keyStr = String(itemKey);
  const isHighlighted = isSlabOverItem(highlightContext?.slab, keyStr);

  const handlePointer = React.useCallback(
    (event: React.PointerEvent) => {
      // Only a real mouse should drive the hover highlight. On touch (and pen),
      // pointerenter/pointermove fire while tapping or scrolling the list, which
      // would drag the highlight slab around to "follow the finger" — a hover
      // affordance that makes no sense on a device with no cursor.
      if (event.pointerType !== 'mouse') {
        return;
      }
      if (!shouldHighlightFromPointer(event.clientX, event.clientY)) {
        return;
      }
      onRequestHighlight(event);
    },
    [onRequestHighlight]
  );

  const Comp = asChild ? Slot : 'div';
  const children =
    typeof props.children === 'function'
      ? props.children({ isHighlighted })
      : props.children;

  return (
    <Comp
      {...{ [FLOATING_LIST_HIGHLIGHT_ITEM_ATTR]: keyStr }}
      onPointerEnter={handlePointer}
      onPointerMove={handlePointer}
      className={cn(
        !asChild && 'relative z-10 w-full rounded-sm transition-none',
        className
      )}
    >
      {children}
    </Comp>
  );
}

export { FloatingListHighlightItem, FloatingListHighlightLayer };
