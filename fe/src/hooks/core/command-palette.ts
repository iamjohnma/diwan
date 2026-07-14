import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  type CommandPaletteNavItem,
  buildCommandPaletteNavItems
} from '@/constants/core/navigation-links';
import { useDialogsStore } from '@/stores/dialogs/store';

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function itemMatches(item: CommandPaletteNavItem, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  const haystack = [item.label, item.groupLabel, ...item.keywords]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

interface CommandPaletteGroupView {
  label: string;
  items: CommandPaletteNavItem[];
}

export function useCommandPalette() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isOpen = useDialogsStore((state) => state.isOpen('commandPalette'));
  const options = useDialogsStore((state) => state.getData('commandPalette'));
  const closeCommandPalette = useCallback(() => {
    useDialogsStore.getState().close('commandPalette');
  }, []);
  const [query, setQuery] = useState(options?.initialQuery ?? '');

  useEffect(() => {
    if (isOpen) {
      setQuery(options?.initialQuery ?? '');
    }
  }, [isOpen, options?.initialQuery]);

  const allItems = useMemo(
    () => buildCommandPaletteNavItems(t),
    [i18n.language, t]
  );
  const normalizedQuery = normalizeQuery(query);
  const groups = useMemo((): CommandPaletteGroupView[] => {
    const matching = allItems.filter((item) =>
      itemMatches(item, normalizedQuery)
    );
    const byGroup = new Map<string, CommandPaletteNavItem[]>();

    for (const item of matching) {
      const existing = byGroup.get(item.groupLabel) ?? [];
      existing.push(item);
      byGroup.set(item.groupLabel, existing);
    }

    return [...byGroup.entries()].map(([label, items]) => ({ label, items }));
  }, [allItems, normalizedQuery]);

  const selectItem = useCallback(
    (item: CommandPaletteNavItem) => {
      closeCommandPalette();
      void navigate({ to: item.href });
    },
    [closeCommandPalette, navigate]
  );

  return {
    isOpen,
    query,
    setQuery,
    groups,
    hasResults: groups.some((group) => group.items.length > 0),
    selectItem,
    close: closeCommandPalette
  };
}

export type CommandPaletteHook = ReturnType<typeof useCommandPalette>;
