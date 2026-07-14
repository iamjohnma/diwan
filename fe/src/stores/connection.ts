import { create } from 'zustand';

interface ConnectionState {
  isOnline: boolean;
  setIsOnline: (isOnline: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  setIsOnline: (isOnline) =>
    set((state) => (state.isOnline === isOnline ? state : { isOnline }))
}));
