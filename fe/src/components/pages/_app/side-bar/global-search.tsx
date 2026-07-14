import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button, Kbd, KbdGroup } from '@/components/ui';
import { usePointerToggle } from '@/hooks/core';
import type { SidebarHook } from '@/hooks/pages/_app';
import { requestOpenCommandPalette } from '@/utils/core/command-palette/open';

interface GlobalSearchProps {
  sidebar: SidebarHook;
  onOpen?: () => void;
}

export function GlobalSearch(props: GlobalSearchProps) {
  const { t } = useTranslation();
  const open = () => {
    props.onOpen?.();
    requestOpenCommandPalette();
  };
  const pointerToggle = usePointerToggle(open);
  const expanded = props.sidebar.isOpen || props.sidebar.isMobile;

  return (
    <Button
      aria-label={t('sidebar.globalSearch.ariaLabel')}
      className="overflow-hidden"
      inputSidebarExpanded={expanded}
      layout="full"
      onClick={pointerToggle.onClick}
      onPointerDown={pointerToggle.onPointerDown}
      prefixIcon={MagnifyingGlassIcon}
      prefixIconProps={{ className: 'size-4', weight: 'duotone' }}
      suffixIcon={
        <KbdGroup className="shrink-0">
          <Kbd keyId="mod" />
          <Kbd keyId="k" />
        </KbdGroup>
      }
      title={expanded ? undefined : t('sidebar.globalSearch.ariaLabel')}
      type="button"
      variant="input"
    >
      {t('sidebar.globalSearch.placeholder')}
    </Button>
  );
}
