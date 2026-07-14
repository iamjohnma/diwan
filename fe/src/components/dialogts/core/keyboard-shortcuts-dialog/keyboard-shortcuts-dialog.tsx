import { useMemo } from 'react';
import type { ShortcutGroup } from '@/@types/core/dialogts/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog';
import { KeyboardIcon } from '@phosphor-icons/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { DialogWrapper } from '@/components/dialogts/common/dialog-wrapper/dialog-wrapper';
import { ShortcutRow } from '@/components/dialogts/core/keyboard-shortcuts-dialog/shortcut-row';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsOnline } from '@/hooks/core';
import { useDialogsStore } from '@/stores/dialogs/store';

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: 'keyboardShortcuts.groups.general',
    shortcuts: [
      {
        labelKey: 'keyboardShortcuts.shortcuts.openSearch',
        keys: ['ctrl', 'K']
      },
      {
        labelKey: 'keyboardShortcuts.shortcuts.openAiAssistant',
        keys: ['ctrl', 'shift', 'G']
      },
      {
        labelKey: 'keyboardShortcuts.shortcuts.toggleAiAssistantVoice',
        keys: ['ctrl', 'G']
      },
      {
        labelKey: 'keyboardShortcuts.shortcuts.openKeyboardShortcuts',
        keys: ['ctrl', '/']
      },
      {
        labelKey: 'keyboardShortcuts.shortcuts.toggleSidebar',
        keys: ['ctrl', '.']
      }
    ]
  }
];

const CALENDAR_SHORTCUT_GROUP: ShortcutGroup = {
  titleKey: 'keyboardShortcuts.groups.calendar',
  shortcuts: [
    {
      labelKey: 'keyboardShortcuts.shortcuts.toggleFullscreen',
      keys: ['F']
    },
    {
      labelKey: 'keyboardShortcuts.shortcuts.goToToday',
      keys: ['T']
    },
    {
      labelKey: 'keyboardShortcuts.shortcuts.scrollCalendar',
      keys: ['arrowup', 'arrowdown']
    },
    {
      labelKey: 'keyboardShortcuts.shortcuts.deleteSelected',
      keys: ['delete']
    },
    {
      labelKey: 'keyboardShortcuts.shortcuts.setRangeDays',
      keys: ['1', '…', '7']
    },
    {
      labelKey: 'keyboardShortcuts.shortcuts.exitFullscreen',
      keys: ['escape']
    }
  ]
};

export function KeyboardShortcutsDialog() {
  const { t } = useTranslation();
  const isOpen = useDialogsStore((state) => state.isOpen('keyboardShortcuts'));
  const isCommandPaletteOpen = useDialogsStore((state) =>
    state.isOpen('commandPalette')
  );
  const close = useDialogsStore((state) => state.close);
  const isOnline = useIsOnline();
  const isCalendarPage = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) =>
          match.routeId === '/_app/calendar' ||
          match.routeId.startsWith('/_app/calendar/')
      )
  });
  const areGlobalShortcutsEnabled = isOnline && !isCommandPaletteOpen;
  const visibleGroups = useMemo(() => {
    const groups = [...SHORTCUT_GROUPS];
    if (isCalendarPage) {
      groups.push(CALENDAR_SHORTCUT_GROUP);
    }

    return groups;
  }, [isCalendarPage]);

  useHotkey(
    { key: '/', ctrl: true },
    () => {
      useDialogsStore.getState().toggle('keyboardShortcuts');
    },
    {
      enabled: areGlobalShortcutsEnabled,
      preventDefault: true,
      ignoreInputs: true
    }
  );

  return (
    <DialogWrapper
      open={isOpen}
      onOpenChange={(openState) => !openState && close('keyboardShortcuts')}
      title={t('keyboardShortcuts.title')}
      icon={KeyboardIcon}
      maxWidth="md:max-w-[480px]"
      showCloseButton
      hideFooter
      footerHint={
        <span className="inline-flex items-center gap-1.5">
          {t('keyboardShortcuts.hint')}
          <KbdGroup>
            <Kbd keyId="mod" variant="outline" size="sm" />
            <Kbd keyId="/" variant="outline" size="sm" />
          </KbdGroup>
        </span>
      }
    >
      <ScrollArea className="max-h-[60vh]">
        <div className="px-6 py-0">
          {visibleGroups.map((group, groupIndex) => (
            <div
              key={group.titleKey}
              className={groupIndex > 0 ? 'mt-6' : undefined}
            >
              <h3 className="mb-1 text-xs font-semibold tracking-wider text-text-tertiary uppercase">
                {t(group.titleKey as never)}
              </h3>
              <div className="divide-y divide-border-subtle">
                {group.shortcuts.map((shortcut) => (
                  <ShortcutRow
                    key={shortcut.labelKey}
                    shortcutRow={{
                      label: t(shortcut.labelKey as never),
                      keys: shortcut.keys
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </DialogWrapper>
  );
}
