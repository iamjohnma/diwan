import { getDirection, i18n, resolveLocale } from '@/integrations/i18n/config';

function setMetaContent(selector: string, content: string): void {
  document.querySelector(selector)?.setAttribute('content', content);
}

export function syncDocumentLocale(language: string | undefined): void {
  if (typeof document === 'undefined') {
    return;
  }

  const locale = resolveLocale(language);
  const direction = getDirection(locale);

  for (const target of [document.documentElement, document.body]) {
    if (target) {
      target.lang = locale;
      target.dir = direction;
    }
  }

  const title = i18n.t('meta.appTitle');
  const description = i18n.t('meta.appDescription');

  document.title = title;
  setMetaContent('meta[name="title"]', title);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[name="twitter:description"]', description);
  setMetaContent(
    'meta[property="og:locale"]',
    locale === 'ar' ? 'ar_EG' : 'en_US'
  );
}
