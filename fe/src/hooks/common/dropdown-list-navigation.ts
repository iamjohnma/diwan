import * as React from 'react';
import {
  type FloatingListHighlightScrollReason,
  useFloatingListHighlight
} from '@/hooks/common/floating-list-highlight';

interface UseDropdownListNavigationProps<T> {
  isOpen: boolean;
  items: T[];
  getItemKey: (item: T) => string | number;
  listContainerElement: HTMLElement | null;
  resetKey?: string | number | boolean | null;
  initialIndex?: number;
  itemAttribute?: string;
  stopPropagationOnSelect?: boolean;
  onSelect: (item: T, index: number) => void;
  onClose?: () => void;
  onScrollToItem?: (
    item: T,
    index: number,
    reason: FloatingListHighlightScrollReason
  ) => void;
}

export function useDropdownListNavigation<T>(
  props: UseDropdownListNavigationProps<T>
) {
  const {
    onSelect,
    onClose,
    stopPropagationOnSelect,
    isOpen,
    ...highlightProps
  } = props;
  const itemsRef = React.useRef(props.items);
  itemsRef.current = props.items;

  const highlight = useFloatingListHighlight<T>({ isOpen, ...highlightProps });
  const { highlightedIndexRef, onArrowDown, onArrowUp } = highlight;

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) return false;

      const length = itemsRef.current.length;
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose?.();

          return true;
        case 'ArrowDown':
          if (length === 0) return false;
          event.preventDefault();
          onArrowDown();

          return true;
        case 'ArrowUp':
          if (length === 0) return false;
          event.preventDefault();
          onArrowUp();

          return true;
        case 'Enter': {
          if (length === 0) return false;
          if (event.repeat || event.nativeEvent.isComposing) return false;
          const index = highlightedIndexRef.current;
          const item = itemsRef.current[index];
          if (!item) return false;
          event.preventDefault();
          if (stopPropagationOnSelect) event.stopPropagation();
          onSelect(item, index);

          return true;
        }
        default:
          return false;
      }
    },
    [
      highlightedIndexRef,
      isOpen,
      onArrowDown,
      onArrowUp,
      onClose,
      onSelect,
      stopPropagationOnSelect
    ]
  );

  return React.useMemo(
    () => ({ ...highlight, handleKeyDown }),
    [handleKeyDown, highlight]
  );
}
