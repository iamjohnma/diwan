import { create } from 'zustand';

export interface PendingVisitCreateSelection {
  startDate: string;
  endDate: string;
  dentistId?: string | null;
}

interface PendingVisitCreateState {
  selection: PendingVisitCreateSelection | null;
  setSelection: (selection: PendingVisitCreateSelection) => void;
  clearSelection: () => void;
}

export const usePendingVisitCreateStore = create<PendingVisitCreateState>(
  (set) => ({
    selection: null,
    setSelection: (selection) => set({ selection }),
    clearSelection: () => set({ selection: null })
  })
);
