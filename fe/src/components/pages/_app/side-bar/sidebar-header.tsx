import {
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  ScalesIcon
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/common';
import type { SidebarHook } from '@/hooks/pages/_app';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
  sidebar: SidebarHook;
}

// Mirrors Naab's SideBarHeader: the whole header toggles the sidebar, the
// logo square crossfades to an expand caret while collapsed, and the
// trailing collapse caret is a passive visual affordance.
export function SidebarHeader(props: SidebarHeaderProps) {
  const { t } = useTranslation();
  const direction = useDirection();
  const isRtl = direction === 'rtl';
  const isExpanded = props.sidebar.isOpen || props.sidebar.isTablet;
  const isCollapsedVisual = !isExpanded;
  const ExpandIcon = isRtl ? CaretDoubleLeftIcon : CaretDoubleRightIcon;
  const CollapseIcon = isRtl ? CaretDoubleRightIcon : CaretDoubleLeftIcon;

  return (
    <div
      className="group/header flex w-full cursor-pointer items-center justify-between overflow-hidden py-1"
      onClick={props.sidebar.toggleOpen}
    >
      <div className="flex min-w-0 flex-1 items-center justify-start gap-x-3 p-0.5">
        <div
          className={cn(
            'relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground',
            isCollapsedVisual &&
              'group-hover/header:bg-secondary-hover group-active/header:bg-secondary-active'
          )}
        >
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-out',
              isExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'
            )}
          >
            <span className="inline-flex">
              <ExpandIcon className="size-4" weight="regular" />
            </span>
          </span>
          <ScalesIcon
            className={cn(
              'size-7 transition-opacity duration-300',
              isExpanded ? 'opacity-100' : 'opacity-0'
            )}
            weight="duotone"
          />
        </div>
        <span className="font-display truncate text-lg font-bold text-primary">
          {t('common.appName')}
        </span>
      </div>
      <span className="pointer-events-none flex items-center justify-center p-0.5 text-text-secondary">
        <CollapseIcon className="size-4.5" weight="regular" />
      </span>
    </div>
  );
}
