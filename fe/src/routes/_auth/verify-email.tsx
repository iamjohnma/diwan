import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/verify-email')({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === 'string' ? search.email.trim() : ''
  }),
  component: Page
});

function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    void navigate(
      search.email
        ? {
            to: '/verify-otp',
            search: { email: search.email, type: 'email-verification' },
            replace: true
          }
        : { to: '/sign-in', replace: true }
    );
  }, [navigate, search.email]);
  return null;
}
