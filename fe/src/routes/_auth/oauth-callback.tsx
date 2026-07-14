import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/oauth-callback')({
  component: Page
});

function Page() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: '/sign-in', replace: true });
  }, [navigate]);
  return null;
}
