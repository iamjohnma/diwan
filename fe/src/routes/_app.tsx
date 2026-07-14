import { useEffect, useRef } from 'react';
import { api } from '@diwan-be/convex/_generated/api';
import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router';
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery
} from 'convex/react';
import { LoadingSpinner } from '@/components/common';
import { AppLayout } from '@/components/core';

export const Route = createFileRoute('/_app')({
  component: AppBoundary
});

// The authentication boundary for every protected page: pending sessions show
// a full-screen spinner, signed-out visitors are redirected to sign-in, and
// authenticated users get the application shell.
function AppBoundary() {
  return (
    <>
      <AuthLoading>
        <main className="full-center flex min-h-dvh bg-background-base">
          <LoadingSpinner />
        </main>
      </AuthLoading>
      <Unauthenticated>
        <Navigate replace to="/sign-in" />
      </Unauthenticated>
      <Authenticated>
        <AccountSetupBoundary />
      </Authenticated>
    </>
  );
}

function AccountSetupBoundary() {
  const status = useQuery(api.accountSetup.status);
  const ensureInitialFirm = useMutation(api.accountSetup.ensureInitialFirm);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (status === undefined || status.ready || requestedRef.current) return;
    requestedRef.current = true;
    void ensureInitialFirm({}).catch(() => {
      requestedRef.current = false;
    });
  }, [ensureInitialFirm, status]);

  if (status === undefined || !status.ready) {
    return (
      <main className="full-center flex min-h-dvh bg-background-base">
        <LoadingSpinner />
      </main>
    );
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
