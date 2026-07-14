import type { TranslationResource } from '@/@types/core/integrations/i18n/config';
import type { defaultNS } from '@/integrations/i18n/config';
import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: { translation: TranslationResource };
  }
}
