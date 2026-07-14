import { createRouter } from '@tanstack/react-router';
import { NotFound, RouteErrorFallback } from '@/components/core';
import { queryClient } from '@/lib/convex/client';
import { routeTree } from '@/routeTree.gen';

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultErrorComponent: RouteErrorFallback,
  defaultNotFoundComponent: NotFound
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
