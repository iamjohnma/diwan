import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/core/document-title';
import { SignInPage } from '@/pages/_auth/sign-in';

export const Route = createFileRoute('/_auth/sign-in')({ component: Page });

function Page() {
  const translation = useTranslation();
  useDocumentTitle(translation.t('signIn.pageHeader.title'));
  return <SignInPage />;
}
