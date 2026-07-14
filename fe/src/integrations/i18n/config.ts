import type {
  LanguagePreference,
  Locale,
  TranslationResource
} from '@/@types/core/integrations/i18n/config';
import { syncDocumentLocale } from '@/integrations/i18n/document-locale';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import {
  LANGUAGE_STORAGE_KEY,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES
} from '@/constants/core/i18n';

export const defaultNS = 'translation';

export type {
  LanguagePreference,
  Locale
} from '@/@types/core/integrations/i18n/config';

export { SUPPORTED_LANGUAGES } from '@/constants/core/i18n';

const FALLBACK_LOCALE: Locale = 'ar';

export function resolveLocale(language?: string | null): Locale {
  const normalized = language?.split('-')[0] as Locale | undefined;

  return normalized && SUPPORTED_LANGUAGES.includes(normalized)
    ? normalized
    : FALLBACK_LOCALE;
}

// Locale bundles are code-split so startup only downloads the active language;
// the other language is warmed in the background and on explicit switch.
const localeImporters: Record<
  Locale,
  () => Promise<{ default: TranslationResource }>
> = {
  ar: () => import('@/integrations/i18n/locales/ar.json'),
  en: () => import('@/integrations/i18n/locales/en.json')
};

const loadedLocales = new Set<Locale>();

async function loadLocaleResources(locale: Locale): Promise<void> {
  if (loadedLocales.has(locale)) {
    return;
  }

  const bundle = (await localeImporters[locale]()).default;

  loadedLocales.add(locale);
  i18n.addResourceBundle(locale, defaultNS, bundle, true, true);
}

// Mirrors the LanguageDetector order (localStorage -> navigator) with the same
// resolveLocale conversion, so the bundle fetched here is always the language
// the detector settles on during init.
function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return FALLBACK_LOCALE;
  }

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (stored) {
      return resolveLocale(stored);
    }
  } catch {
    // localStorage unavailable; fall through to navigator detection.
  }

  return resolveLocale(navigator.language);
}

const REMAINING_LOCALES_WARMUP_DELAY_MS = 2_500;

function warmRemainingLocales(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.setTimeout(() => {
    for (const locale of SUPPORTED_LANGUAGES) {
      void loadLocaleResources(locale).catch(() => undefined);
    }
  }, REMAINING_LOCALES_WARMUP_DELAY_MS);
}

const initializationPromise = i18n.isInitialized
  ? Promise.resolve()
  : (async () => {
      const initialLocale = detectInitialLocale();
      const bundle = (await localeImporters[initialLocale]()).default;

      loadedLocales.add(initialLocale);
      await i18n
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
          resources: { [initialLocale]: { translation: bundle } },
          fallbackLng: FALLBACK_LOCALE,
          supportedLngs: SUPPORTED_LANGUAGES,
          defaultNS,
          detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            lookupLocalStorage: LANGUAGE_STORAGE_KEY,
            caches: ['localStorage'],
            convertDetectedLanguage: resolveLocale
          },
          interpolation: { escapeValue: false },
          load: 'currentOnly',
          returnNull: false,
          react: { useSuspense: false }
        });
      warmRemainingLocales();
    })();

export function whenI18nReady(): Promise<void> {
  return initializationPromise;
}

export function resolveLanguagePreference(
  preference: LanguagePreference
): Locale {
  return preference === 'system'
    ? resolveLocale(navigator.language)
    : preference;
}

export function getDirection(language: Locale): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}

export async function changeAppLanguage(locale: Locale): Promise<void> {
  await initializationPromise;
  const resolvedLocale = resolveLocale(locale);
  await loadLocaleResources(resolvedLocale);
  await i18n.changeLanguage(resolvedLocale);
  syncDocumentLocale(resolvedLocale);
}

export { i18n };
