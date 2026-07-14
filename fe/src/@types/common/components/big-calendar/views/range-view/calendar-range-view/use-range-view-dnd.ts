import type { WorkingHours } from '@/@types/common/big-calendar';

export interface RangeViewDndPropsHook {
  pixelsPerHour: number;
  rangeDays: number;
  selectedTimeZone: string;
  workingHours: WorkingHours;
  gridRef: React.RefObject<HTMLDivElement | null>;
  direction: 'ltr' | 'rtl';
}
