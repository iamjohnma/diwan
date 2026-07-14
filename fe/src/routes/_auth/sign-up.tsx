import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/core/document-title';
import { SignUpPage } from '@/pages/_auth/sign-up';

export const Route = createFileRoute('/_auth/sign-up')({ component: Page });

function Page() {
  const translation = useTranslation();
  useDocumentTitle(translation.t('signUp.pageHeader.title'));
  return <SignUpPage />;
}
