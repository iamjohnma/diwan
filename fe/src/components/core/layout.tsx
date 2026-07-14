import type { ReactNode } from 'react';
import { WifiSlashIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/core/app-header';
import { AiAssistantManager } from '@/components/core/ai-assistant';
import { CommandPaletteManager } from '@/components/core/command-palette/command-palette-manager';
import { KeyboardShortcutsDialog } from '@/components/dialogts/core/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog';
import { Sidebar } from '@/components/pages/_app';
import {
  MockNotificationsProvider,
  useIsOnline
} from '@/hooks/core';
import { useCommandPaletteHotkeys } from '@/hooks/core/command-palette-hotkeys';

function OfflineIndicator() {
  const { t } = useTranslation();
  const isOnline = useIsOnline();

  if (isOnline) {
    return null;
  }

  return (
    <p className="pointer-events-none absolute inset-x-0 top-full z-20 flex justify-center px-app-lg py-app-xs">
      <span className="flex items-center gap-x-app-xs rounded-md bg-warning-bg px-app-sm py-app-xs text-sm text-warning shadow-xs">
        <WifiSlashIcon className="size-4" />
        {t('common.offline')}
      </span>
    </p>
  );
}

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout(props: AppLayoutProps) {
  const { t } = useTranslation();
  useCommandPaletteHotkeys();

  return (
    <MockNotificationsProvider>
      <div className="flex h-dvh overflow-x-hidden overflow-y-hidden bg-background-base">
        <a
          className="absolute start-app-lg top-0 z-50 -translate-y-full rounded-md bg-primary px-app-md py-app-sm text-primary-foreground focus:translate-y-0"
          href="#main-content"
        >
          {t('common.skipToContent')}
        </a>
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-hidden">
          <div className="relative shrink-0">
            <AppHeader />
            <OfflineIndicator />
          </div>
          <main
            className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
            id="main-content"
            tabIndex={-1}
          >
            {props.children}
          </main>
        </div>
        <CommandPaletteManager />
        <KeyboardShortcutsDialog />
        <AiAssistantManager />
      </div>
    </MockNotificationsProvider>
  );
}
