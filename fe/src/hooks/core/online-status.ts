import { useEffect } from 'react';
import { useConnectionStore } from '@/stores/connection';

// Mounted once by RootProviders so the connection store mirrors the browser's
// online/offline events for the whole app.
export function useOnlineStatusSync(): void {
  const setIsOnline = useConnectionStore((state) => state.setIsOnline);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);
}

export function useIsOnline(): boolean {
  return useConnectionStore((state) => state.isOnline);
}

export function hasBlockingConnectionIssue(): boolean {
  return !useConnectionStore.getState().isOnline;
}
