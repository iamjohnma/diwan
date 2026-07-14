import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import { ConvexReactClient } from 'convex/react';
import { appEnv } from '@/config/env';
import { isUnauthenticatedError, toastAppError } from '@/lib/errors';

export const convexClient = new ConvexReactClient(appEnv.VITE_CONVEX_URL);

// Bridges Convex's reactive queries into TanStack Query: convexQueryClient
// hashes convex query keys and streams live updates into the cache, so
// feature code uses the standard useQuery(convexQuery(api.x.y, args)) shape.
const convexQueryClient = new ConvexQueryClient(convexClient);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn()
    },
    mutations: {
      onError: (error) => {
        // Session expiry is handled by the auth boundary redirect; every
        // other unhandled mutation failure surfaces as a toast.
        if (!isUnauthenticatedError(error)) {
          toastAppError(error);
        }
      }
    }
  }
});

convexQueryClient.connect(queryClient);
