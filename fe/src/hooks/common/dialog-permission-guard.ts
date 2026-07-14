import { useEffect, useRef } from 'react';
import { toast } from '@/components/ui/sonner';

interface UseDialogPermissionGuardParams {
  isOpen: boolean;
  /** While permissions are still loading the guard waits instead of closing. */
  isPermissionsReady: boolean;
  hasPermission: boolean;
  /** Closes the dialog and clears any related state. */
  onClose: () => void;
  /** Toast message shown when the dialog is force-closed. */
  message: string;
}

/**
 * Force-closes an open dialog when the user loses the permission it requires,
 * showing an error toast once per permission-loss episode (the toast re-arms
 * when the dialog closes or the permission comes back).
 */
export function useDialogPermissionGuard(
  params: UseDialogPermissionGuardParams
) {
  const toastShownRef = useRef(false);
  const latestRef = useRef(params);
  latestRef.current = params;

  useEffect(() => {
    if (!params.isOpen) {
      toastShownRef.current = false;

      return;
    }
    if (!params.isPermissionsReady) {
      return;
    }
    if (params.hasPermission) {
      toastShownRef.current = false;

      return;
    }

    latestRef.current.onClose();
    if (!toastShownRef.current) {
      toastShownRef.current = true;
      toast.error(latestRef.current.message);
    }
  }, [params.isOpen, params.isPermissionsReady, params.hasPermission]);
}
