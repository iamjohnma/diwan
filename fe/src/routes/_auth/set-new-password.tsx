import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SetNewPasswordPage } from '@/pages/_auth/set-new-password';
import { readResetPasswordContext } from '@/utils/core/auth/auth-flow';

export const Route = createFileRoute('/_auth/set-new-password')({
  component: Page
});

function Page() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!readResetPasswordContext()) {
      void navigate({ to: '/forgot-password', replace: true });
    }
  }, [navigate]);
  return <SetNewPasswordPage />;
}
