import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { Command } from 'cmdk';
import { useTranslation } from 'react-i18next';
import type { CommandPaletteHook } from '@/hooks/core';
import { cn } from '@/lib/utils';

interface ContentSectionProps {
  commandPalette: CommandPaletteHook;
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-y-app-sm px-app-lg py-app-xl text-center">
      <MagnifyingGlassIcon
        className="size-8 text-text-tertiary"
        weight="duotone"
      />
      <p className="text-base font-medium text-text-primary">
        {t('commandPalette.empty')}
      </p>
      <p className="text-sm text-text-secondary">
        {t('commandPalette.emptyDescription')}
      </p>
    </div>
  );
}

export function ContentSection(props: ContentSectionProps) {
  if (!props.commandPalette.hasResults) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-app-sm py-app-sm">
        <EmptyState />
      </div>
    );
  }

  return (
    <Command.List className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-app-sm py-app-sm">
      {props.commandPalette.groups.map((group) => (
        <Command.Group
          key={group.label}
          heading={group.label}
          className="[&_[cmdk-group-heading]]:px-app-sm [&_[cmdk-group-heading]]:py-app-xs [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-tertiary"
        >
          {group.items.map((item) => {
            const ItemIcon = item.icon;

            return (
              <Command.Item
                key={item.id}
                value={item.id}
                keywords={[...item.keywords, item.label]}
                onSelect={() => props.commandPalette.selectItem(item)}
                className={cn(
                  'group flex cursor-pointer items-center gap-x-3 rounded-lg border border-transparent px-3 py-3 text-sm font-medium outline-none',
                  'data-[selected=true]:border-border-subtle data-[selected=true]:bg-secondary'
                )}
              >
                <ItemIcon
                  className="size-5 shrink-0 text-text-secondary group-data-[selected=true]:text-secondary-foreground"
                  weight="duotone"
                />
                <span className="truncate text-text-secondary group-data-[selected=true]:text-secondary-foreground">
                  {item.label}
                </span>
              </Command.Item>
            );
          })}
        </Command.Group>
      ))}
    </Command.List>
  );
}
