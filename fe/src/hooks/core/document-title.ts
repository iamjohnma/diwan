import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function useDocumentTitle(pageTitle?: string): void {
  const { t, i18n } = useTranslation();
  const appName = t('common.appName');

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${appName}` : appName;

    return () => {
      document.title = appName;
    };
  }, [appName, i18n.language, pageTitle]);
}
