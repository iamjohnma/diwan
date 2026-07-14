import { useTranslation } from 'react-i18next';
import { TruncateText } from '@/components/common/truncate-text';
import { SettingsDescriptionRow } from '@/components/pages/_app/settings/settings-row';
import { ColorPreference } from '@/components/pages/_app/settings/tab-appearance/color-preference';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Tabs,
  TabsList,
  TabsTab
} from '@/components/ui';
import { useBreakpoint } from '@/hooks/common';
import type { AppearanceSettingsHook } from '@/hooks/pages/_app/settings';
import type { AppearancePreferences } from '@/stores/user-preferences';

interface PickerOption {
  value: string;
  label: string;
}

interface AppearanceOptionPickerProps {
  value: string;
  options: PickerOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  animatedTabs?: boolean;
}

function AppearanceOptionPicker(props: AppearanceOptionPickerProps) {
  const breakpoint = useBreakpoint();

  if (breakpoint.isBelow('lg')) {
    return (
      <Select
        value={props.value}
        onValueChange={props.onValueChange}
        disabled={props.disabled}
      >
        <SelectTrigger className="h-8 min-w-28 text-xs lg:h-10 lg:min-w-36 lg:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              itemLabel={option.label}
            >
              <TruncateText className="text-inherit">
                {option.label}
              </TruncateText>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const handleTabChange = (value: string | number | null) => {
    if (value) {
      props.onValueChange(String(value));
    }
  };

  return (
    <Tabs value={props.value} onValueChange={handleTabChange}>
      <TabsList animated={props.animatedTabs}>
        {props.options.map((option) => (
          <TabsTab
            key={option.value}
            value={option.value}
            disabled={props.disabled}
          >
            <TruncateText className="text-inherit">{option.label}</TruncateText>
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  );
}

interface PreferenceRowProps {
  title: string;
  description: string;
  value: string;
  options: PickerOption[];
  onValueChange: (value: string) => void;
}

function PreferenceRow(props: PreferenceRowProps) {
  return (
    <SettingsDescriptionRow
      title={props.title}
      description={props.description}
      compact
    >
      <AppearanceOptionPicker
        value={props.value}
        options={props.options}
        onValueChange={props.onValueChange}
      />
    </SettingsDescriptionRow>
  );
}

interface AppearanceTabProps {
  settings: AppearanceSettingsHook;
}

export function AppearanceTab(props: AppearanceTabProps) {
  const translation = useTranslation();
  const t = translation.t;
  const update = <K extends keyof AppearancePreferences>(
    key: K,
    value: AppearancePreferences[K]
  ) => props.settings.update({ [key]: value });
  const yesNoOptions = (
    prefix: string,
    trueValue: string,
    falseValue: string
  ): PickerOption[] => [
    {
      value: trueValue,
      label: String(t(`${prefix}.${trueValue}` as never))
    },
    {
      value: falseValue,
      label: String(t(`${prefix}.${falseValue}` as never))
    }
  ];
  const rows = [
    <ColorPreference key="color" settings={props.settings} />,
    <PreferenceRow
      key="font"
      title={t('settings.appearance.fontSize.title')}
      description={t('settings.appearance.fontSize.description')}
      value={props.settings.draft.fontSize}
      options={(['small', 'medium', 'large'] as const).map((value) => ({
        value,
        label: t(`settings.appearance.fontSize.${value}`)
      }))}
      onValueChange={(value) =>
        update('fontSize', value as AppearancePreferences['fontSize'])
      }
    />,
    <PreferenceRow
      key="language"
      title={t('settings.appearance.language.title')}
      description={t('settings.appearance.language.description')}
      value={props.settings.draft.language}
      options={[
        { value: 'ar', label: 'العربية' },
        { value: 'en', label: 'English' },
        { value: 'system', label: t('settings.appearance.language.system') }
      ]}
      onValueChange={(value) =>
        update('language', value as AppearancePreferences['language'])
      }
    />,
    <PreferenceRow
      key="hide-numbers"
      title={t('settings.appearance.hideNumbers.title')}
      description={t('settings.appearance.hideNumbers.description')}
      value={props.settings.draft.hideNumbers ? 'hidden' : 'visible'}
      options={yesNoOptions(
        'settings.appearance.hideNumbers',
        'hidden',
        'visible'
      )}
      onValueChange={(value) => update('hideNumbers', value === 'hidden')}
    />,
    <PreferenceRow
      key="dashboard-top-cards"
      title={t('settings.appearance.fastAccessButtons.title')}
      description={t('settings.appearance.fastAccessButtons.description')}
      value={props.settings.draft.showFastAccessButtons ? 'actions' : 'kpis'}
      options={yesNoOptions(
        'settings.appearance.fastAccessButtons',
        'actions',
        'kpis'
      )}
      onValueChange={(value) =>
        update('showFastAccessButtons', value === 'actions')
      }
    />,
    <PreferenceRow
      key="palette"
      title={t('settings.appearance.commandPaletteOnType.title')}
      description={t('settings.appearance.commandPaletteOnType.description')}
      value={
        props.settings.draft.openCommandPaletteOnType ? 'enabled' : 'disabled'
      }
      options={yesNoOptions(
        'settings.appearance.commandPaletteOnType',
        'enabled',
        'disabled'
      )}
      onValueChange={(value) =>
        update('openCommandPaletteOnType', value === 'enabled')
      }
    />,
    <PreferenceRow
      key="unsaved"
      title={t('settings.appearance.unsavedChangesBehaviour.title')}
      description={t('settings.appearance.unsavedChangesBehaviour.description')}
      value={props.settings.draft.unsavedChangesBehaviour}
      options={(['ask', 'discard'] as const).map((value) => ({
        value,
        label: t(`settings.appearance.unsavedChangesBehaviour.${value}`)
      }))}
      onValueChange={(value) =>
        update(
          'unsavedChangesBehaviour',
          value as AppearancePreferences['unsavedChangesBehaviour']
        )
      }
    />,
    <PreferenceRow
      key="rows"
      title={t('settings.appearance.tableRowsFill.title')}
      description={t('settings.appearance.tableRowsFill.description')}
      value={props.settings.draft.tableRowsFill ? 'fill' : 'fixed'}
      options={yesNoOptions(
        'settings.appearance.tableRowsFill',
        'fill',
        'fixed'
      )}
      onValueChange={(value) => update('tableRowsFill', value === 'fill')}
    />,
    <PreferenceRow
      key="sidebar"
      title={t('settings.appearance.sidebar.title')}
      description={t('settings.appearance.sidebar.description')}
      value={props.settings.draft.sidebar}
      options={(['open', 'closed', 'remember'] as const).map((value) => ({
        value,
        label: t(`settings.appearance.sidebar.${value}`)
      }))}
      onValueChange={(value) =>
        update('sidebar', value as AppearancePreferences['sidebar'])
      }
    />
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-3 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_[data-slot=tabs-trigger]]:focus-visible:ring-0 [&_[data-slot=tabs-trigger]]:focus-visible:ring-offset-0">
        <div className="flex min-w-168 flex-col gap-1 py-3 md:py-4">
          {rows.map((row, index) => (
            <div key={row.key}>
              {index > 0 ? <Separator /> : null}
              {row}
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-border-default bg-background-base px-3 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          {props.settings.isDirty ? (
            <Button
              type="button"
              variant="ghost"
              size="lgTall"
              onClick={props.settings.cancel}
            >
              {t('settings.cancel')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="lgTall"
            disabled={!props.settings.isDirty}
            onClick={props.settings.save}
          >
            {t('settings.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  );
}
