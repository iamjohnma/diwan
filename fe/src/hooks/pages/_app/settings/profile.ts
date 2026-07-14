import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  updateCurrentProfileName,
  useCurrentProfileQuery
} from '@/hooks/core/current-profile';
import { convexClient } from '@/lib/convex/client';

async function copyText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function useSettingsProfile() {
  const currentProfileQuery = useCurrentProfileQuery();
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const updateNameMutation = useMutation({
    mutationFn: (name: string) =>
      convexClient.mutation(updateCurrentProfileName, { name })
  });

  const copy = useCallback(async (value: string, message: string) => {
    const copied = await copyText(value);
    if (copied) toast.success(message);
    return copied;
  }, []);

  const updateName = useCallback(
    async (name: string) => {
      const updated = await updateNameMutation.mutateAsync(name);
      await currentProfileQuery.refetch();
      setIsEditNameOpen(false);
      return updated;
    },
    [currentProfileQuery, updateNameMutation]
  );

  return {
    profile: currentProfileQuery.data,
    isLoading: currentProfileQuery.isPending,
    isError: currentProfileQuery.isError,
    isEditNameOpen,
    setIsEditNameOpen,
    isUpdatingName: updateNameMutation.isPending,
    updateName,
    copy
  };
}

export type SettingsProfileHook = ReturnType<typeof useSettingsProfile>;
