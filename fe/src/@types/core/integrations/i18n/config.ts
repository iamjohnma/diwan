import type en from '@/integrations/i18n/locales/en.json';

export type TranslationResource = typeof en;

export type Locale = 'en' | 'ar';

export type LanguagePreference = Locale | 'system';
