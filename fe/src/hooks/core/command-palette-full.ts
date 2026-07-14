import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { FileTextIcon, ScalesIcon, UserIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { makeFunctionReference } from 'convex/server';
import { useTranslation } from 'react-i18next';
import type {
  CommandPaletteGroup,
  CommandPaletteItem,
  CommandPaletteScope
} from '@/constants/core/command-palette';
import {
  type CommandPaletteNavItem,
  buildCommandPaletteNavItems
} from '@/constants/core/navigation-links';
import { useDialogsStore } from '@/stores/dialogs/store';

function itemMatches(item: CommandPaletteNavItem, query: string): boolean {
  if (!query) return true;
  return [item.label, item.groupLabel, ...item.keywords]
    .join(' ')
    .toLocaleLowerCase()
    .includes(query);
}

interface Level {
  scope: CommandPaletteScope;
  query: string;
}

interface PaletteSearchResult {
  cases: Array<{
    id: string;
    internalNumber: string;
    courtNumber?: string;
    courtName?: string;
    status: string;
  }>;
  parties: Array<{
    id: string;
    nationalId: string;
    fullName: string;
    phone?: string;
  }>;
  documents: Array<{ id: string; caseId: string; title: string; kind: string }>;
}

const searchCommandPalette = makeFunctionReference<
  'query',
  {
    queryText: string;
    scope?: 'all' | 'cases' | 'parties' | 'documents';
    limit?: number;
    firmId?: string;
  },
  PaletteSearchResult
>('commandPalette:search');

export function useCommandPaletteFull() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isOpen = useDialogsStore((state) => state.isOpen('commandPalette'));
  const options = useDialogsStore((state) => state.getData('commandPalette'));
  const close = useCallback(() => {
    useDialogsStore.getState().close('commandPalette');
  }, []);
  const [levels, setLevels] = useState<Level[]>([{ scope: 'root', query: '' }]);
  const wasOpen = useRef(false);
  const current = levels.at(-1) ?? { scope: 'root', query: '' };

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setLevels([{ scope: 'root', query: options?.initialQuery ?? '' }]);
    }
    wasOpen.current = isOpen;
  }, [isOpen, options?.initialQuery]);

  const navItems = useMemo(
    () => buildCommandPaletteNavItems(t),
    [i18n.language, t]
  );
  const normalizedQuery = current.query.trim().toLocaleLowerCase();
  const deferredQuery = useDeferredValue(current.query);
  const isRoot = current.scope === 'root';
  const shouldSearch = isOpen && (!isRoot || normalizedQuery.length > 0);
  const backend = useQuery({
    ...convexQuery(searchCommandPalette, {
      queryText: deferredQuery,
      scope: isRoot
        ? 'all'
        : (current.scope as Exclude<CommandPaletteScope, 'root'>),
      limit: 8
    }),
    enabled: shouldSearch
  });

  const setQuery = useCallback((query: string) => {
    setLevels((previous) =>
      previous.map((level, index) =>
        index === previous.length - 1 ? { ...level, query } : level
      )
    );
  }, []);

  const openSubLevel = useCallback(
    (scope: Exclude<CommandPaletteScope, 'root'>) => {
      setLevels((previous) => [...previous, { scope, query: '' }]);
    },
    []
  );

  const navigationItems = useMemo((): CommandPaletteItem[] => {
    return navItems
      .filter((item) => itemMatches(item, normalizedQuery))
      .map((item) => {
        const scope = item.href.slice(1) as CommandPaletteScope;
        return {
          ...item,
          ...(scope === 'cases' || scope === 'parties' || scope === 'documents'
            ? { onOpenSubLevel: () => openSubLevel(scope) }
            : {})
        };
      });
  }, [navItems, normalizedQuery, openSubLevel]);

  const groups = useMemo((): CommandPaletteGroup[] => {
    const output: CommandPaletteGroup[] = [];
    if (isRoot) {
      const grouped = new Map<string, CommandPaletteItem[]>();
      for (const item of navigationItems) {
        const label = navItems.find(
          (entry) => entry.id === item.id
        )?.groupLabel;
        if (label) grouped.set(label, [...(grouped.get(label) ?? []), item]);
      }
      for (const [label, items] of grouped) {
        output.push({ id: `navigation.${label}`, label, items });
      }
    }

    const results = backend.data;
    if (!results) return output;

    if (results.cases.length) {
      output.push({
        id: 'cases',
        label: t('commandPalette.groups.cases'),
        items: results.cases.map((row) => ({
          id: `case.${row.id}`,
          icon: ScalesIcon,
          label: row.internalNumber,
          keywords: [
            row.internalNumber,
            row.courtNumber ?? '',
            row.courtName ?? ''
          ],
          href: '/cases'
        }))
      });
    }
    if (results.parties.length) {
      output.push({
        id: 'parties',
        label: t('commandPalette.groups.parties'),
        items: results.parties.map((row) => ({
          id: `party.${row.id}`,
          icon: UserIcon,
          label: row.fullName,
          keywords: [row.fullName, row.nationalId, row.phone ?? ''],
          href: '/parties'
        }))
      });
    }
    if (results.documents.length) {
      output.push({
        id: 'documents',
        label: t('commandPalette.groups.documents'),
        items: results.documents.map((row) => ({
          id: `document.${row.id}`,
          icon: FileTextIcon,
          label: row.title,
          keywords: [row.title, row.kind],
          href: '/documents'
        }))
      });
    }
    return output;
  }, [backend.data, isRoot, navItems, navigationItems, t]);

  const selectItem = useCallback(
    (item: CommandPaletteItem) => {
      close();
      void navigate({ to: item.href });
    },
    [close, navigate]
  );
  const goBack = useCallback(() => {
    setLevels((previous) =>
      previous.length > 1 ? previous.slice(0, -1) : previous
    );
  }, []);
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        const selected = document.querySelector<HTMLElement>(
          '[cmdk-item][data-selected="true"]'
        );
        const selectedItem = groups
          .flatMap((group) => group.items)
          .find((item) => item.id === selected?.dataset.value);
        if (selectedItem?.onOpenSubLevel) {
          event.preventDefault();
          selectedItem.onOpenSubLevel();
        }
        return;
      }
      if (
        levels.length > 1 &&
        (event.key === 'ArrowRight' ||
          (event.key === 'Backspace' && current.query.length === 0))
      ) {
        event.preventDefault();
        goBack();
      }
    },
    [current.query.length, goBack, groups, levels.length]
  );

  const breadcrumb =
    current.scope === 'root'
      ? null
      : [
          current.scope === 'cases'
            ? t('commandPalette.groups.cases')
            : current.scope === 'parties'
              ? t('commandPalette.groups.parties')
              : t('commandPalette.groups.documents')
        ];

  return {
    query: current.query,
    setQuery,
    groups,
    hasResults: groups.some((group) => group.items.length > 0),
    isResolvingVisibleResults:
      shouldSearch &&
      (backend.data === undefined ||
        backend.isFetching ||
        deferredQuery !== current.query),
    breadcrumb,
    canGoBack: levels.length > 1,
    onKeyDown,
    selectItem
  };
}

export type CommandPaletteFullHook = ReturnType<typeof useCommandPaletteFull>;
