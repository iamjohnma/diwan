import { Navigate, createFileRoute } from '@tanstack/react-router';
import { AuthLoading, Authenticated, Unauthenticated } from 'convex/react';
import { LoadingSpinner } from '@/components/common';
import { AuthLayout } from '@/components/pages/_auth';

export const Route = createFileRoute('/_auth')({
  component: AuthBoundary
});

// Signed-in users never see auth pages: they are bounced to the application
// root while pending sessions keep a neutral spinner.
function AuthBoundary() {
  return (
    <>
      <AuthLoading>
        <main className="full-center flex min-h-dvh bg-background-base">
          <LoadingSpinner />
        </main>
      </AuthLoading>
      <Authenticated>
        <Navigate replace to="/" />
      </Authenticated>
      <Unauthenticated>
        <AuthLayout />
      </Unauthenticated>
    </>
  );
}
