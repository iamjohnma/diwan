import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { Command } from 'cmdk';
import { useTranslation } from 'react-i18next';
import { CommandPaletteContent } from '@/components/core/command-palette/content-full';
import { PaletteLayout } from '@/components/core/command-palette/palette-layout';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { useBreakpoint } from '@/hooks/common/breakpoint';
import { useCommandPaletteFull } from '@/hooks/core/command-palette-full';

function Shortcut(props: { keyId: string; label: string }) {
  return (
    <div className="flex items-center gap-x-2">
      <KbdGroup>
        <Kbd keyId={props.keyId} size="md" variant="outline" />
      </KbdGroup>
      <span>{props.label}</span>
    </div>
  );
}

export function CommandPaletteFull() {
  const { t } = useTranslation();
  const commandPaletteFull = useCommandPaletteFull();
  const breakpoint = useBreakpoint();
  return (
    <PaletteLayout
      defaultView={
        !commandPaletteFull.canGoBack && !commandPaletteFull.query.trim()
      }
    >
      <Command
        className="flex min-h-0 w-full flex-1 flex-col"
        loop
        onKeyDown={commandPaletteFull.onKeyDown}
        shouldFilter={false}
        vimBindings={false}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border-default px-5">
          <MagnifyingGlassIcon className="size-5 shrink-0 text-text-tertiary" />
          <input
            autoComplete="off"
            autoCorrect="off"
            className="h-14 w-full bg-transparent text-lg outline-none placeholder:text-text-tertiary"
            onChange={(event) =>
              commandPaletteFull.setQuery(event.currentTarget.value)
            }
            placeholder={t('commandPalette.searchPlaceholder')}
            spellCheck={false}
            value={commandPaletteFull.query}
          />
        </div>
        <CommandPaletteContent palette={commandPaletteFull} />
        {!breakpoint.isMobile && (
          <div className="flex shrink-0 items-center gap-x-4 border-t border-border-subtle bg-background-surface px-5 py-3 text-xs text-text-tertiary">
            <div className="flex items-center gap-x-2">
              <KbdGroup>
                <Kbd keyId="arrowup" size="md" variant="outline" />
                <Kbd keyId="arrowdown" size="md" variant="outline" />
              </KbdGroup>
              <span>{t('commandPalette.footer.navigate')}</span>
            </div>
            <Shortcut
              keyId="enter"
              label={t('commandPalette.footer.select')}
            />
            <Shortcut
              keyId="escape"
              label={t('commandPalette.footer.close')}
            />
            {commandPaletteFull.canGoBack && (
              <Shortcut
                keyId="arrowright"
                label={t('commandPalette.footer.back')}
              />
            )}
          </div>
        )}
      </Command>
    </PaletteLayout>
  );
}
