import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { defaultNS, i18n } from '@/integrations/i18n/config';
import { syncDocumentLocale } from '@/integrations/i18n/document-locale';
import { I18nextProvider, useTranslation } from 'react-i18next';

function LocaleDocumentSynchronizer() {
  const { i18n: runtimeI18n } = useTranslation();

  useEffect(() => {
    syncDocumentLocale(runtimeI18n.language);
    runtimeI18n.on('languageChanged', syncDocumentLocale);

    return () => runtimeI18n.off('languageChanged', syncDocumentLocale);
  }, [runtimeI18n]);

  return null;
}

interface ProviderProps {
  children: ReactNode;
}

export function Provider(props: ProviderProps) {
  return (
    <I18nextProvider i18n={i18n} defaultNS={defaultNS}>
      <LocaleDocumentSynchronizer />
      {props.children}
    </I18nextProvider>
  );
}
