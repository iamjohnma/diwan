import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/core/document-title';
import { ForgotPasswordPage } from '@/pages/_auth/forgot-password';

export const Route = createFileRoute('/_auth/forgot-password')({
  component: Page
});

function Page() {
  const translation = useTranslation();
  useDocumentTitle(translation.t('forgotPassword.pageHeader.title'));
  return <ForgotPasswordPage />;
}
