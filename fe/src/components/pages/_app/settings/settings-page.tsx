import { useTranslation } from 'react-i18next';
import {
  type SettingsTab,
  SettingsTabs
} from '@/components/pages/_app/settings/settings-tabs';
import { AppearanceTab } from '@/components/pages/_app/settings/tab-appearance/appearance-tab';
import { ProfileTab } from '@/components/pages/_app/settings/tab-profile/profile-tab';
import { useDocumentTitle } from '@/hooks/core';
import {
  useAppearanceSettings,
  useSettingsProfile
} from '@/hooks/pages/_app/settings';

interface SettingsPageProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsPage(props: SettingsPageProps) {
  const translation = useTranslation();
  const appearanceSettings = useAppearanceSettings();
  const settingsProfile = useSettingsProfile();
  useDocumentTitle(translation.t('settings.title'));

  return (
    <section
      aria-label={translation.t('settings.title')}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      <div className="shrink-0 px-3 md:px-6">
        <SettingsTabs
          activeTab={props.activeTab}
          onTabChange={props.onTabChange}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {props.activeTab === 'appearance' ? (
          <AppearanceTab settings={appearanceSettings} />
        ) : (
          <div className="h-full overflow-y-auto px-3 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ProfileTab profile={settingsProfile} />
          </div>
        )}
      </div>
    </section>
  );
}
