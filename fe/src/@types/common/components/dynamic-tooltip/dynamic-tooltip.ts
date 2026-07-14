export type DynamicTooltipMotionAxis = 'horizontal' | 'vertical';

export interface DynamicTooltipHandle {
  open: (triggerId?: string) => void;
  close: () => void;
  readonly isOpen: boolean;
}
