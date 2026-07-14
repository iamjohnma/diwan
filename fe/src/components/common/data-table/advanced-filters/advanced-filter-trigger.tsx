import { useCallback, useEffect, useRef } from 'react';
import { FunnelIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { AdvancedFilterBuilder } from './advanced-filter-builder';
import {
  IconButton,
  useDynamicPopover,
  useDynamicPopoverTrigger
} from '@/components/ui';
import type { AdvancedFiltersResultHook } from '@/hooks/common/advanced-filters';
import { useAdvancedFiltersSelector } from '@/hooks/common/advanced-filters';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { cn } from '@/lib/utils';

export function AdvancedFilterTrigger(props: {
  advancedFilters: AdvancedFiltersResultHook;
}) {
  const translation = useTranslation();
  const { t } = translation;
  const breakpoint = useBreakpoint();
  const dynamicPopover = useDynamicPopover();
  const dynamicPopoverTrigger = useDynamicPopoverTrigger('filters', 0);
  const { ref, isActive: isOpen, toggle, triggerProps } = dynamicPopoverTrigger;
  const pointerToggleRef = useRef(false);
  const isHidden = breakpoint.isBelow('lg');
  const isActive = useAdvancedFiltersSelector(
    props.advancedFilters,
    (snapshot) => snapshot.isActive
  );
  const count = useAdvancedFiltersSelector(
    props.advancedFilters,
    (snapshot) => snapshot.activeRuleCount
  );
  const open = useCallback(() => {
    if (!isOpen) {
      props.advancedFilters.initialize();
      if (props.advancedFilters.root.items.length === 0) {
        props.advancedFilters.addRule(props.advancedFilters.root.id);
      }
    }
    toggle();
  }, [isOpen, props.advancedFilters, toggle]);

  useEffect(() => {
    if (isHidden && isOpen) dynamicPopover.close();
  }, [dynamicPopover, isHidden, isOpen]);
  if (isHidden) return null;

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="relative inline-flex"
    >
      <IconButton
        aria-label={t('common.advancedFilter.filter')}
        variant="outline"
        size="equal"
        className={cn(
          'relative size-10 shrink-0 overflow-visible',
          (isOpen || isActive) && 'border-primary/40 bg-background-elevated'
        )}
        tooltip={t('common.advancedFilter.filter')}
        icon={FunnelIcon}
        iconProps={{
          weight: isActive ? 'fill' : 'regular',
          className: cn('size-4.5', isActive && 'text-primary')
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointerToggleRef.current = true;
          open();
        }}
        onClick={(event) => {
          if (pointerToggleRef.current) {
            pointerToggleRef.current = false;
            return;
          }
          if (event.button === 0) open();
        }}
        {...triggerProps}
      />
      {isActive && count > 0 ? (
        <span className="pointer-events-none absolute -top-1 -end-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-background-base bg-primary px-1 text-[10px] leading-none text-primary-foreground tabular-nums">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export function AdvancedFilterPanelContent(props: {
  advancedFilters: AdvancedFiltersResultHook;
}) {
  const dynamicPopover = useDynamicPopover();
  return (
    <AdvancedFilterBuilder
      advancedFilters={props.advancedFilters}
      onClose={dynamicPopover.close}
    />
  );
}
