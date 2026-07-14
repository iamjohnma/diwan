import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { makeFunctionReference } from 'convex/server';

export interface CurrentProfile {
  id: string;
  createdAt: number;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

export const currentProfile = makeFunctionReference<
  'query',
  Record<string, never>,
  CurrentProfile
>('profile:current');

export const updateCurrentProfileName = makeFunctionReference<
  'mutation',
  { name: string },
  CurrentProfile
>('profile:updateName');

const currentProfileQueryOptions = convexQuery(currentProfile, {});

export function useCurrentProfileQuery() {
  return useQuery(currentProfileQueryOptions);
}
