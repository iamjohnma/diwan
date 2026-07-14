import {
  CaretLeftIcon,
  CaretRightIcon,
  MagnifyingGlassIcon
} from '@phosphor-icons/react';
import { Command } from 'cmdk';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { TruncateText } from '@/components/common/truncate-text';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import { useDirection } from '@/hooks/common';
import type { CommandPaletteFullHook } from '@/hooks/core/command-palette-full';
import { useCommandPaletteItemPress } from '@/hooks/core/command-palette-item-press';

function ItemRow(props: {
  item: CommandPaletteFullHook['groups'][number]['items'][number];
  select: () => void;
}) {
  const direction = useDirection();
  const Icon = props.item.icon;
  const press = useCommandPaletteItemPress(props.select);
  const ChevronIcon = direction === 'rtl' ? CaretLeftIcon : CaretRightIcon;

  return (
    <Command.Item
      className="group flex cursor-pointer items-center justify-between gap-x-3 rounded-lg border border-transparent px-3 py-3 text-base font-medium data-[selected=true]:border-black/5 data-[selected=true]:bg-secondary"
      keywords={[...props.item.keywords, props.item.label]}
      onSelect={props.select}
      value={props.item.id}
      {...press}
    >
      <span className="flex min-w-0 items-center gap-x-3">
        <Icon
          className="size-5 shrink-0 text-text-secondary group-data-[selected=true]:text-secondary-foreground"
          weight="duotone"
        />
        <TruncateText className="text-text-secondary group-data-[selected=true]:text-secondary-foreground">
          {props.item.label}
        </TruncateText>
      </span>
      {props.item.onOpenSubLevel && (
        <ChevronIcon
          className="hidden size-4.5 shrink-0 text-text-tertiary group-data-[selected=true]:text-secondary-foreground tablet:block"
          weight="bold"
        />
      )}
    </Command.Item>
  );
}

export function CommandPaletteContent(props: {
  palette: CommandPaletteFullHook;
}) {
  const { t } = useTranslation();

  if (!props.palette.hasResults && props.palette.isResolvingVisibleResults) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center py-6"
        role="status"
      >
        <LoadingSpinner color="primary" size="sm" />
      </div>
    );
  }
  if (!props.palette.hasResults) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-6">
        <Empty className="!flex-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MagnifyingGlassIcon className="size-5" />
            </EmptyMedia>
            <EmptyTitle>{t('commandPalette.empty')}</EmptyTitle>
            <EmptyDescription>
              {t('commandPalette.emptyDescription')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <Command.List
      className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2"
      style={{ scrollbarGutter: 'stable both-edges' }}
    >
      {props.palette.groups.map((group) => (
        <Command.Group
          key={group.id}
          className="flex flex-col"
          heading={
            <div className="px-2 pt-2 pb-2 text-xs font-medium text-text-tertiary">
              {props.palette.breadcrumb?.[0] ?? group.label}
            </div>
          }
        >
          {group.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              select={() => props.palette.selectItem(item)}
            />
          ))}
        </Command.Group>
      ))}
    </Command.List>
  );
}
