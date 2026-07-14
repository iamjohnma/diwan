import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type SettingsTab = 'profile' | 'appearance';

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsTabs(props: SettingsTabsProps) {
  const translation = useTranslation();
  const tabs: Array<{ value: SettingsTab; label: string }> = [
    { value: 'profile', label: translation.t('settings.tabs.profile') },
    {
      value: 'appearance',
      label: translation.t('settings.tabs.appearance')
    }
  ];

  return (
    <div className="relative min-w-0 border-b border-border-default">
      <div className="flex min-w-max gap-x-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={cn(
              'relative border-0 bg-transparent pt-2 pb-3 text-sm font-medium transition-colors focus-visible:outline-none',
              props.activeTab === tab.value
                ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary'
                : 'text-text-secondary hover:text-text-primary'
            )}
            onClick={() => props.onTabChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
