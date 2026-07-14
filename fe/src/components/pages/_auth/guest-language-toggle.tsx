import { TranslateIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui';
import {
  type Locale,
  SUPPORTED_LANGUAGES,
  changeAppLanguage,
  resolveLocale
} from '@/integrations/i18n/config';

function nextLocale(current: Locale): Locale {
  const index = SUPPORTED_LANGUAGES.indexOf(current);
  return SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length]!;
}

export function GuestLanguageToggle() {
  const translation = useTranslation();
  const current = resolveLocale(
    translation.i18n.resolvedLanguage ?? translation.i18n.language
  );
  const upcoming = nextLocale(current);
  const upcomingLabel =
    upcoming === 'ar'
      ? translation.t('common.language.arabic')
      : translation.t('common.language.english');
  const actionLabel = `${translation.t('common.tooltips.changeLanguage')}: ${upcomingLabel}`;

  return (
    <IconButton
      aria-label={actionLabel}
      icon={TranslateIcon}
      size="equal"
      variant="ghost"
      tooltip={actionLabel}
      onClick={() => {
        void changeAppLanguage(upcoming);
      }}
    />
  );
}
