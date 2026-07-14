import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { VerifyOtpPage } from '@/pages/_auth/verify-otp';

type Flow = 'email-verification' | 'reset-password';

export const Route = createFileRoute('/_auth/verify-otp')({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === 'string' ? search.email.trim() : '',
    type: (search.type === 'reset-password'
      ? 'reset-password'
      : 'email-verification') as Flow
  }),
  component: Page
});

function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!search.email) void navigate({ to: '/sign-in', replace: true });
  }, [navigate, search.email]);
  return search.email ? (
    <VerifyOtpPage email={search.email} type={search.type} />
  ) : null;
}
